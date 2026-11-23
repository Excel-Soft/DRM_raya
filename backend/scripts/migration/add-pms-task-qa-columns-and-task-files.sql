-- PMS / Product Posting task workflow columns that the code (shared/schema.ts `tasks`,
-- `taskTimeLogs`, `taskFiles`, task-execution-routes.ts, product-posting-workflow-routes.ts,
-- jobs/overdue-checker.ts) relies on but which were never created on this database
-- (the lazy ensure* blocks in tasks/task-time-logs repositories fail on legacy column
-- names and roll back). Caused 500s on:
--   GET /api/product-posting/verification/queue|stats  (t.qa_reviewed_at)
--   GET /api/pms/tasks/:id/time-logs                   (task_time_logs.time_spent_seconds)
--   GET /api/pms/project-tasks/:id, link-report, task QA (drm.task_files)
--   task pause (remaining_seconds) and [OverdueChecker] (sent_to_qa_at)
-- Shapes copied from src/shared/schema.ts + the lazy "alter table drm.task_files add column
-- if not exists ..." statements in the route files. Additive only (new nullable/defaulted
-- columns and one new table; no existing data touched).
-- Rollback: add-pms-task-qa-columns-and-task-files.rollback.sql
BEGIN;

ALTER TABLE drm.tasks
  ADD COLUMN IF NOT EXISTS sent_to_qa_at timestamptz,
  ADD COLUMN IF NOT EXISTS qa_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS qa_level text,
  ADD COLUMN IF NOT EXISTS qa_remarks text,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_level text,
  ADD COLUMN IF NOT EXISTS verification_remarks text,
  ADD COLUMN IF NOT EXISTS remaining_seconds integer;

ALTER TABLE drm.task_time_logs
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer;

CREATE TABLE IF NOT EXISTS drm.task_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL REFERENCES drm.tasks(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES drm.users(id),
  file_url text,
  file_name text,
  description text,
  created_at timestamp DEFAULT now() NOT NULL,
  send_to_qa boolean NOT NULL DEFAULT false,
  qa_status text,
  qa_comment text,
  qa_reject_image_url text,
  qa_reviewed_at timestamptz,
  qa_reviewed_by uuid,
  verify_status text,
  verify_note text,
  verified_by_user_id uuid REFERENCES drm.users(id),
  verified_at timestamptz
);
CREATE INDEX IF NOT EXISTS task_files_task_id_idx ON drm.task_files (task_id);

COMMIT;
