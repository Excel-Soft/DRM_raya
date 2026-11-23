-- Reports -> Reception Report: repair the 19,859 visits copied from the old DRM
-- (webxl_visit_meeting -> drm.meetings). The first copy left every row with
-- person_name 'Legacy visit', meeting_date = the copy time, no start/end/duration and
-- status 'ended'. From the old row:
--   meeting_date / start_time = start_time, end_time = end_time (old values are Pakistan
--   local time), total_duration_seconds = end - start,
--   user_id / person_name = the employee met (user_id -> mapped user), person_type 'user',
--   status: '0' + end time -> ended, '1' (no end) -> in_progress, blank -> expected.
-- The old system kept no receptionist, so created_by stays empty.
-- Current values are saved first in migration_meta.meetings_repair_backup.
-- Idempotent: only rows still holding the copy's placeholder ('Legacy visit') are changed.
-- Rollback: rollback-fix-legacy-reception-meetings.sql
BEGIN;

CREATE TABLE IF NOT EXISTS migration_meta.meetings_repair_backup (
  meeting_id uuid PRIMARY KEY,
  user_id uuid, person_type text, person_name text, meeting_date timestamptz, status text,
  start_time timestamptz, end_time timestamptz, total_duration_seconds integer,
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE _v ON COMMIT DROP AS
SELECT mt.id AS meeting_id,
       (v.start_time::timestamp AT TIME ZONE 'Asia/Karachi') AS start_at,
       CASE WHEN v.end_time ~ '^\d{4}-\d{2}-\d{2}' AND v.end_time NOT LIKE '0000%'
            THEN v.end_time::timestamp AT TIME ZONE 'Asia/Karachi' END AS end_at,
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = v.user_id
           AND EXISTS (SELECT 1 FROM drm.users x WHERE x.id = um.modern_id::uuid) LIMIT 1) AS met_user,
       v.status AS old_status
  FROM migration_meta.migration_legacy_ids m
  JOIN legacy_archive.webxl_visit_meeting v ON v._source_table = 'webxl_visit_meeting' AND v._legacy_pk = m.legacy_id
  JOIN drm.meetings mt ON mt.id = m.modern_id::uuid
 WHERE m.modern_table = 'meetings' AND m.legacy_table = 'webxl_visit_meeting'
   AND mt.person_name = 'Legacy visit'
   AND v.start_time ~ '^\d{4}-\d{2}-\d{2}' AND v.start_time NOT LIKE '0000%';

INSERT INTO migration_meta.meetings_repair_backup
  (meeting_id, user_id, person_type, person_name, meeting_date, status, start_time, end_time, total_duration_seconds)
SELECT mt.id, mt.user_id, mt.person_type::text, mt.person_name, mt.meeting_date, mt.status::text,
       mt.start_time, mt.end_time, mt.total_duration_seconds
  FROM drm.meetings mt JOIN _v ON _v.meeting_id = mt.id
ON CONFLICT (meeting_id) DO NOTHING;

UPDATE drm.meetings mt
   SET meeting_date = _v.start_at,
       start_time = _v.start_at,
       end_time = _v.end_at,
       total_duration_seconds = CASE WHEN _v.end_at >= _v.start_at
                                     THEN extract(epoch FROM _v.end_at - _v.start_at)::int END,
       user_id = coalesce(_v.met_user, mt.user_id),
       person_type = CASE WHEN _v.met_user IS NOT NULL THEN 'user'::drm.meeting_person_type ELSE mt.person_type END,
       person_name = coalesce((SELECT nullif(btrim(u.full_name), '') FROM drm.users u WHERE u.id = _v.met_user), '-'),
       status = CASE WHEN _v.end_at IS NOT NULL THEN 'ended'
                     WHEN btrim(coalesce(_v.old_status, '')) = '1' THEN 'in_progress'
                     ELSE 'expected' END::drm.meeting_status,
       updated_at = now()
  FROM _v
 WHERE mt.id = _v.meeting_id;

COMMIT;
