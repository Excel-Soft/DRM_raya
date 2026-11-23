-- SQL ports of the first-migration transforms, used by the incremental old-DRM import
-- (scripts/migration/incremental/sync_modern.py) to copy new / changed old rows into drm.*
-- with exactly the rules the original Node scripts used:
--   tf_company(row)   = run-customers-transform.mjs  transformRow()   webxl_company  -> drm.customers
--   tf_followup(row)  = run-followups-transform.mjs  transformRow()   webxl_followup -> drm.follow_ups
-- Input is the archive row as jsonb (to_jsonb(legacy_archive.<t> row) or an
-- import_row_history.old_row), so "before" and "after" versions go through the same code.
-- Also: migration_meta.import_modern_history (what the sync changed in drm.*, for rollback).
-- Rollback: create-incremental-sync-functions.rollback.sql
BEGIN;

-- JS String(v).trim(); '' -> NULL
CREATE OR REPLACE FUNCTION migration_meta.mig_trim(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(regexp_replace(v, '^[\s ﻿  ]+|[\s ﻿  ]+$', '', 'g'), '')
$$;

-- parseTs(): JS new Date(s.replace(" ", "T")) on a server in Europe/Berlin, stored into a
-- timestamp-without-time-zone column (node-postgres sends local time) => wall clock kept.
-- A date-only string is UTC midnight in JS, i.e. 01:00/02:00 Berlin.
CREATE OR REPLACE FUNCTION migration_meta.mig_ts(v text) RETURNS timestamp
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text := migration_meta.mig_trim(v);
BEGIN
  IF s IS NULL OR s LIKE '0000-00-00%' THEN RETURN NULL; END IF;
  IF s ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN (s::date::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin';
  END IF;
  RETURN replace(s, 'T', ' ')::timestamp;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- old user id -> new user id (mapUserId: '' / '0' -> NULL)
CREATE OR REPLACE FUNCTION migration_meta.mig_user(v text) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT m.modern_id::uuid FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user'
     AND m.legacy_id = migration_meta.mig_trim(v) AND migration_meta.mig_trim(v) <> '0'
   LIMIT 1
$$;

-- webxl_company -> drm.customers columns (run-customers-transform.mjs transformRow)
CREATE OR REPLACE FUNCTION migration_meta.tf_company(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  com_id text := migration_meta.mig_trim(j->>'com_id');
  cname text := migration_meta.mig_trim(j->>'cname');
  contact text := migration_meta.mig_trim(j->>'contact');
  ab text := migration_meta.mig_trim(j->>'abAccount');
  country text := migration_meta.mig_trim(j->>'country');
  grade text := migration_meta.mig_trim(j->>'grade');
  st text := lower(coalesce(migration_meta.mig_trim(j->>'status'), ''));
  company_name text;
BEGIN
  IF com_id IS NULL THEN RETURN NULL; END IF;  -- rejected: missing_com_id
  company_name := coalesce(cname, com_id);
  RETURN jsonb_build_object(
    'company_name', left(company_name, 500),
    'account_name', left(coalesce(contact, company_name), 500),
    'email', 'legacy-' || coalesce(j->>'id', j->>'_legacy_pk') || '@drm.migrated.local',
    'phone', left(coalesce(contact, '0000000000'), 100),
    'region', CASE WHEN ab IS NOT NULL AND upper(ab) IN ('FM','GS','GM','HI','AK') THEN upper(ab)
                   WHEN country IS NOT NULL THEN left(country, 200) ELSE 'Other' END,
    'grade', CASE WHEN grade IN ('A+','A','A-','B+','B','B-','C+','C','C-','D') THEN grade ELSE 'C' END,
    'status', CASE WHEN st LIKE '%old%' OR st = 'active' THEN 'Renew'
                   WHEN st LIKE '%expir%' THEN 'Expire' ELSE 'New' END,
    'ntn', migration_meta.mig_trim(j->>'ntn'),
    'country', country,
    'city', migration_meta.mig_trim(j->>'city'),
    'address', migration_meta.mig_trim(j->>'address'),
    'crm_id', migration_meta.mig_trim(j->>'crm_id'),
    'crm_date', migration_meta.mig_ts(j->>'crm_date'),
    'company_type', migration_meta.mig_trim(j->>'comType'),
    'website', migration_meta.mig_trim(j->>'website'),
    'comment', migration_meta.mig_trim(j->>'comment'),
    'rc_link', migration_meta.mig_trim(j->>'rcLink'),
    'source', migration_meta.mig_trim(j->>'source'),
    'drm_id', com_id,
    'assignee', migration_meta.mig_user(j->>'assignId'),
    'created_by', migration_meta.mig_user(j->>'created_by'),
    'is_deleted', lower(coalesce(migration_meta.mig_trim(j->>'disable'), '')) = 'yes',
    'ab_type', ab,
    'created_at', migration_meta.mig_ts(j->>'create_date'),
    'updated_at', migration_meta.mig_ts(j->>'update_at')
  );
END $$;

-- webxl_followup -> drm.follow_ups columns (run-followups-transform.mjs transformRow)
CREATE OR REPLACE FUNCTION migration_meta.tf_followup(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  com text := migration_meta.mig_trim(j->>'com_id');
  cust uuid;
  due timestamp;
  dt timestamp;
  usr uuid;
  tk numeric;
  secs bigint := 0;
  note text := migration_meta.mig_trim(j->>'note');
  answer text := migration_meta.mig_trim(j->>'answer');
BEGIN
  IF com IS NULL THEN RETURN jsonb_build_object('_reject', 'missing_com_id'); END IF;
  SELECT m.modern_id::uuid INTO cust FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = com LIMIT 1;
  IF cust IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_customer'); END IF;
  due := coalesce(migration_meta.mig_ts(j->>'nc'), migration_meta.mig_ts(j->>'create_date'));
  IF due IS NULL THEN RETURN jsonb_build_object('_reject', 'missing_due_at'); END IF;
  dt := coalesce(migration_meta.mig_ts(j->>'create_date'), due);
  usr := migration_meta.mig_user(j->>'uid');
  -- JS Number(row.tk_mint ?? 0): '' -> 0, non-numeric -> NaN (-> 0)
  BEGIN
    tk := coalesce(nullif(btrim(coalesce(j->>'tk_mint', '0')), ''), '0')::numeric;
  EXCEPTION WHEN others THEN tk := NULL;
  END;
  IF tk IS NOT NULL AND tk >= 0 AND tk <= 50000 THEN secs := least(trunc(tk * 60), 2147483647); END IF;
  RETURN jsonb_build_object(
    'customer_id', cust,
    'assigned_to', usr,
    'created_by', usr,
    'due_at', due,
    'notes', left(CASE WHEN note IS NOT NULL AND answer IS NOT NULL THEN note || E'\n' || answer
                       ELSE coalesce(note, answer) END, 8000),
    'method', left(migration_meta.mig_trim(j->>'cm'), 200),
    'reservation_type', left(coalesce(migration_meta.mig_trim(j->>'ncm'), migration_meta.mig_trim(j->>'purpose_call')), 200),
    'talk_time_seconds', secs,
    'date_time', dt,
    'created_at', dt
  );
END $$;

-- What the incremental sync changed in drm.* (rollback restores old_values only where the
-- column still holds new_values, so later edits made in the new app are never overwritten).
CREATE TABLE IF NOT EXISTS migration_meta.import_modern_history (
  id           bigserial PRIMARY KEY,
  run_id       uuid NOT NULL REFERENCES migration_meta.import_runs(id),
  modern_table text NOT NULL,
  modern_id    text NOT NULL,  -- uuid or integer id, as text
  legacy_table text,
  legacy_id    text,
  action       text NOT NULL CHECK (action IN ('insert', 'update')),
  old_values   jsonb,
  new_values   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_modern_history_run ON migration_meta.import_modern_history (run_id, modern_table);

COMMIT;
