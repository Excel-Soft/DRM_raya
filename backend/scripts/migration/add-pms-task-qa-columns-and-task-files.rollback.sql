-- Rollback for add-pms-task-qa-columns-and-task-files.sql
-- WARNING: removes drm.task_files and the added columns; anything written to them
-- after the forward migration ran is lost. Run only if the forward migration must be undone.
BEGIN;
DROP TABLE IF EXISTS drm.task_files;
ALTER TABLE drm.task_time_logs DROP COLUMN IF EXISTS time_spent_seconds;
ALTER TABLE drm.tasks
  DROP COLUMN IF EXISTS sent_to_qa_at,
  DROP COLUMN IF EXISTS qa_reviewed_at,
  DROP COLUMN IF EXISTS qa_level,
  DROP COLUMN IF EXISTS qa_remarks,
  DROP COLUMN IF EXISTS verification_reviewed_at,
  DROP COLUMN IF EXISTS verification_level,
  DROP COLUMN IF EXISTS verification_remarks,
  DROP COLUMN IF EXISTS remaining_seconds;
COMMIT;
