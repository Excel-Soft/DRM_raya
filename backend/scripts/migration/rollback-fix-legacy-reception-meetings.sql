-- Undo fix-legacy-reception-meetings.sql: restore the saved values.
BEGIN;
UPDATE drm.meetings mt
   SET user_id = b.user_id, person_type = b.person_type::drm.meeting_person_type, person_name = b.person_name,
       meeting_date = b.meeting_date, status = b.status::drm.meeting_status, start_time = b.start_time,
       end_time = b.end_time, total_duration_seconds = b.total_duration_seconds, updated_at = now()
  FROM migration_meta.meetings_repair_backup b
 WHERE b.meeting_id = mt.id;
DROP TABLE migration_meta.meetings_repair_backup;
COMMIT;
