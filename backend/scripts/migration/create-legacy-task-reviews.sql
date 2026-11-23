-- Manager review of old-DRM tasks from the new app (PMS -> Task Complete -> Pending My Review).
-- legacy_archive stays read-only. When a manager approves / rejects an old task (webxl_task_assign
-- row the executive ended, manager not yet reviewed), it is moved into the new flow: a drm.tasks
-- row (READY_FOR_QA, assignee = old executive, owner = manager) with the old links in task_files,
-- then the normal approve / reject runs on it — Send to QA, QA, VM and close work as for any task.
-- This table links the old task to that drm task so it is never shown / moved twice.
-- Rollback: create-legacy-task-reviews.rollback.sql
BEGIN;
CREATE TABLE IF NOT EXISTS drm.legacy_task_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_assign_id text NOT NULL UNIQUE,          -- legacy_archive.webxl_task_assign._legacy_pk
  project_id       uuid REFERENCES drm.projects(id),
  status           text NOT NULL DEFAULT 'moved',
  reviewed_by      uuid REFERENCES drm.users(id),
  reviewed_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE drm.legacy_task_reviews ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES drm.tasks(id) ON DELETE SET NULL;
ALTER TABLE drm.legacy_task_reviews DROP CONSTRAINT IF EXISTS legacy_task_reviews_status_check;
ALTER TABLE drm.legacy_task_reviews ADD CONSTRAINT legacy_task_reviews_status_check CHECK (status IN ('approved', 'moved'));
ALTER TABLE drm.legacy_task_reviews ALTER COLUMN status SET DEFAULT 'moved';
COMMIT;
