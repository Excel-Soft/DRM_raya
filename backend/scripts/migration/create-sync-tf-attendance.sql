-- SQL ports of the first-migration attendance transforms, for the incremental old-DRM import
-- (same style as create-incremental-sync-functions.sql: input = to_jsonb(legacy_archive row),
-- output = jsonb of the drm.* columns the original INSERT set, except id; '_reject' = row skipped).
--   tf_attendance(row)               = run-attendance-transform.mjs transform()
--                                      webxl_attendance               -> drm.attendance
--   tf_attendance_month(row)         = run-attendance-month-transform.mjs transform() (withBranch)
--                                      webxl_attendance_month         -> drm.attendance_month
--   tf_attendance_month_history(row) = run-attendance-month-transform.mjs transform() (timeCols)
--                                      webxl_attendance_month_history -> drm.attendance_month_history
--   tf_raw_punch(row)                = run-wave5-highvolume-transform.mjs migrateRawAttendence()
--                                      webxl_raw_attendence           -> drm.attendance_raw_punches
-- Server time zone of the original run: Europe/Berlin (JS Dates built from local wall clock).
-- Rollback: create-sync-tf-attendance.rollback.sql
BEGIN;

-- JS Number(String(v).trim()) truncated (safeInt): NULL when JS gives NaN / +-Infinity
-- (caller applies the fallback). '' / NULL -> NULL.
CREATE OR REPLACE FUNCTION migration_meta.mig_js_int(v text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text := migration_meta.mig_trim(v);
  f float8;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  IF s ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$' THEN
    f := s::float8;                      -- out of double range -> exception -> Infinity -> NULL
    RETURN trunc(f::numeric);
  ELSIF s ~ '^0[xX][0-9a-fA-F]+$' THEN
    RETURN trunc((SELECT sum((strpos('0123456789abcdef', c) - 1)::numeric * 16::numeric ^ (length(s) - 2 - o))
              FROM regexp_split_to_table(lower(substr(s, 3)), '') WITH ORDINALITY AS t(c, o)));
  ELSIF s ~ '^0[oO][0-7]+$' THEN
    RETURN trunc((SELECT sum(c::numeric * 8::numeric ^ (length(s) - 2 - o))
              FROM regexp_split_to_table(substr(s, 3), '') WITH ORDINALITY AS t(c, o)));
  ELSIF s ~ '^0[bB][01]+$' THEN
    RETURN trunc((SELECT sum(c::numeric * 2::numeric ^ (length(s) - 2 - o))
              FROM regexp_split_to_table(substr(s, 3), '') WITH ORDINALITY AS t(c, o)));
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- webxl_attendance -> drm.attendance (run-attendance-transform.mjs transform)
CREATE OR REPLACE FUNCTION migration_meta.tf_attendance(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  usr uuid;
  ds text := migration_meta.mig_trim(j->>'date');
  day timestamp;                      -- parseDateOnly(date): local wall clock
  cin timestamp;
  cout timestamp;
  tin text := migration_meta.mig_trim(j->>'timeIn');
  tout text := migration_meta.mig_trim(j->>'timeOut');
  la text := coalesce(migration_meta.mig_trim(j->>'late_absent'), '');
  m text[];
  late_min numeric := 0;
  st text;
  is_late boolean;
  wh numeric;
  notes text[] := '{}';
BEGIN
  -- userMap.get(String(row.user_id)): exact (untrimmed) legacy id, no fallback
  SELECT u.modern_id::uuid INTO usr FROM migration_meta.migration_legacy_ids u
   WHERE u.entity_type = 'user' AND u.legacy_table = 'webxl_user'
     AND u.legacy_id = coalesce(j->>'user_id', 'null') LIMIT 1;
  IF usr IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;

  -- parseDateOnly: 'YYYY-MM-DD' -> new Date(s+'T00:00:00') (day 1..31 rolls over like V8);
  -- longer strings -> new Date(s.replace(' ','T')) (= mig_ts wall clock)
  BEGIN
    IF ds IS NULL OR ds LIKE '0000-00-00%' THEN
      day := NULL;
    ELSIF length(ds) <= 10 THEN
      m := regexp_match(ds, '^([0-9]{4})-([0-9]{2})-([0-9]{2})$');
      IF m IS NOT NULL AND m[2]::int BETWEEN 1 AND 12 AND m[3]::int BETWEEN 1 AND 31 THEN
        day := make_date(m[1]::int, m[2]::int, 1)::timestamp + (m[3]::int - 1) * interval '1 day';
      END IF;
    ELSE
      day := migration_meta.mig_ts(ds);
    END IF;
  EXCEPTION WHEN others THEN day := NULL;
  END;
  IF day IS NULL THEN RETURN jsonb_build_object('_reject', 'missing_date'); END IF;

  -- combineDateTime: base.setHours(h, m, 0, 0) in Europe/Berlin (overflow rolls, DST gap -> +1h)
  cin := day;
  m := regexp_match(coalesce(tin, ''), '^([0-9]{1,2}):([0-9]{2})');
  IF m IS NOT NULL THEN
    cin := ((date_trunc('day', day) + make_interval(hours => m[1]::int, mins => m[2]::int))
            AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
  END IF;
  cout := day;
  m := regexp_match(coalesce(tout, ''), '^([0-9]{1,2}):([0-9]{2})');
  IF m IS NOT NULL THEN
    cout := ((date_trunc('day', day) + make_interval(hours => m[1]::int, mins => m[2]::int))
             AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
  END IF;

  -- parseLateMinutes
  IF la <> '' AND lower(la) <> 'true' THEN
    m := regexp_match(la, '^([0-9]+):([0-9]+)');
    IF m IS NOT NULL THEN late_min := m[1]::numeric * 60 + m[2]::numeric; END IF;
  END IF;

  -- mapStatus
  IF lower(la) = 'true' THEN st := 'Absent';
  ELSIF la ~* '(eid|holiday|leave|weekend|off day)' THEN st := 'Leave';
  ELSIF tin IS NULL AND tout IS NULL THEN
    IF la IN ('0:0', '0:00') THEN st := 'Absent';
    ELSIF la <> '' AND la !~ '^[0-9]+:[0-9]+$' THEN st := 'Leave';
    ELSE st := 'Absent';
    END IF;
  ELSIF late_min > 0 THEN st := 'Late';
  ELSE st := 'Present';
  END IF;
  is_late := st = 'Late' OR late_min > 0;

  -- workingHours: real elapsed hours (Berlin instants), 0..24, toFixed(2)
  wh := extract(epoch FROM (cout AT TIME ZONE 'Europe/Berlin') - (cin AT TIME ZONE 'Europe/Berlin')) / 3600;
  IF wh < 0 OR wh > 24 THEN wh := NULL; ELSE wh := round(wh, 2); END IF;

  -- buildNotes (branch / meeting appended untrimmed, as in the template string)
  IF migration_meta.mig_trim(j->>'branch') IS NOT NULL THEN notes := notes || ('branch=' || (j->>'branch')); END IF;
  IF migration_meta.mig_trim(j->>'meeting') IS NOT NULL THEN notes := notes || ('meeting=' || (j->>'meeting')); END IF;
  IF la <> '' AND la NOT IN ('0:0', '0:00') AND lower(la) <> 'true' THEN notes := notes || ('late_absent=' || la); END IF;

  RETURN jsonb_build_object(
    'user_id', usr,
    'date', day,
    'check_in', cin,
    'check_out', cout,
    'status', st,
    'late_checkin', is_late,
    'late_checkout', false,
    'is_late', is_late,
    'working_hours', wh,
    'notes', CASE WHEN cardinality(notes) > 0 THEN left(array_to_string(notes, '; '), 2000) END,
    'created_at', day,
    'updated_at', day
  );
END $$;

-- shared body of run-attendance-month-transform.mjs transform() for both month tables
CREATE OR REPLACE FUNCTION migration_meta.tf_attendance_month_common(j jsonb, with_branch boolean, time_cols boolean)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw_uid text := migration_meta.mig_trim(j->>'user_id');
  usr uuid;
  fallback uuid;
  mon numeric := migration_meta.mig_js_int(j->>'month');
  yr numeric := migration_meta.mig_js_int(j->>'year');
  upd timestamptz;
  s text;
BEGIN
  -- fallbackUser = SELECT id FROM drm.users ORDER BY created_at LIMIT 1 (non-row-local).
  -- Several users share the minimum created_at, so that query is not deterministic; the
  -- first migration got 5e27b8fb-... (seen on all fallback rows), pinned here while it exists.
  SELECT id INTO fallback FROM drm.users WHERE id = '5e27b8fb-b68b-4a2f-beee-50f14197cba3';
  IF fallback IS NULL THEN
    SELECT id INTO fallback FROM drm.users ORDER BY created_at LIMIT 1;
  END IF;
  IF raw_uid IS NOT NULL AND raw_uid <> '0' THEN
    SELECT u.modern_id::uuid INTO usr FROM migration_meta.migration_legacy_ids u
     WHERE u.entity_type = 'user' AND u.legacy_table = 'webxl_user' AND u.legacy_id = raw_uid LIMIT 1;
  END IF;
  usr := coalesce(usr, fallback);
  IF usr IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;
  IF mon IS NULL OR mon < 1 OR mon > 12 THEN RETURN jsonb_build_object('_reject', 'invalid_month'); END IF;
  IF yr IS NULL OR yr < 1970 OR yr > 2100 THEN yr := 2000; END IF;

  IF time_cols THEN
    -- local parseTs: new Date(s.replace(' ','T')) on a Berlin server -> timestamptz instant
    s := migration_meta.mig_trim(j->>'last_update');
    upd := migration_meta.mig_ts(s) AT TIME ZONE 'Europe/Berlin';
  END IF;

  RETURN jsonb_build_object(
    'user_id', usr,
    'late_hour', coalesce(migration_meta.mig_js_int(j->>'lateHour'), 0),
    'late_min', coalesce(migration_meta.mig_js_int(j->>'lateMin'), 0),
    'half_leave', coalesce(migration_meta.mig_js_int(j->>'halfLeave'), 0),
    'leaves', coalesce(migration_meta.mig_js_int(j->>'leaves'), 0),
    'month', mon,
    'year', yr,
    -- now = parseTs(last_update) ?? new Date(): migration run time when NULL (month table: always)
    'created_at', coalesce(upd, now()),
    'updated_at', coalesce(upd, now())
  ) || CASE WHEN with_branch THEN jsonb_build_object('branch', migration_meta.mig_trim(j->>'branch'))
            ELSE '{}'::jsonb END;
END $$;

-- webxl_attendance_month -> drm.attendance_month
-- Original: INSERT ... ON CONFLICT (user_id, month, year) DO UPDATE SET late_hour, late_min,
-- half_leave, leaves, branch = COALESCE(EXCLUDED.branch, existing), updated_at (created_at kept).
CREATE OR REPLACE FUNCTION migration_meta.tf_attendance_month(j jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT migration_meta.tf_attendance_month_common(j, true, false)
$$;

-- webxl_attendance_month_history -> drm.attendance_month_history
-- Original: same ON CONFLICT (user_id, month, year) upsert (late_hour, late_min, half_leave,
-- leaves, updated_at; created_at kept). No branch column.
CREATE OR REPLACE FUNCTION migration_meta.tf_attendance_month_history(j jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT migration_meta.tf_attendance_month_common(j, false, true)
$$;

-- webxl_raw_attendence -> drm.attendance_raw_punches (run-wave5-highvolume-transform.mjs)
CREATE OR REPLACE FUNCTION migration_meta.tf_raw_punch(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  legacy_user text := coalesce(migration_meta.mig_trim(j->>'user_id'), migration_meta.mig_trim(j->>'uid'));
  usr uuid;
  raw text := j->>'raw_json';
  rj jsonb;
BEGIN
  IF legacy_user IS NOT NULL AND legacy_user <> '0' THEN
    SELECT u.modern_id::uuid INTO usr FROM migration_meta.migration_legacy_ids u
     WHERE u.entity_type = 'user' AND u.legacy_table = 'webxl_user' AND u.legacy_id = legacy_user LIMIT 1;
  END IF;
  -- JSON.parse(raw_json); falsy result (null/false/0/"") -> NULL; parse error -> {"raw": text}
  IF migration_meta.mig_trim(raw) IS NOT NULL THEN
    BEGIN
      rj := raw::jsonb;
    EXCEPTION WHEN others THEN
      rj := jsonb_build_object('raw', raw);
    END;
    IF rj IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb) THEN rj := NULL; END IF;
  END IF;
  RETURN jsonb_build_object(
    'user_id', usr,
    'legacy_uid', legacy_user,
    'office', migration_meta.mig_trim(j->>'office'),
    'device_ip', migration_meta.mig_trim(j->>'device_ip'),
    'state', migration_meta.mig_trim(j->>'state'),
    'punch_type', migration_meta.mig_trim(j->>'type'),
    -- helpers parseTs on a Berlin server -> timestamptz instant
    'att_timestamp', migration_meta.mig_ts(j->>'att_timestamp') AT TIME ZONE 'Europe/Berlin',
    'received_at', migration_meta.mig_ts(j->>'received_at') AT TIME ZONE 'Europe/Berlin'
  ) || jsonb_build_object('raw_json', rj);
END $$;

COMMIT;
