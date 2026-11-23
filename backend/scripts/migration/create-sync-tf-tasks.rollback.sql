-- Rollback for create-sync-tf-tasks.sql
BEGIN;
DROP FUNCTION IF EXISTS migration_meta.tf_task_log_history(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_task_link(jsonb);
COMMIT;
