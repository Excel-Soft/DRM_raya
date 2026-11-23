-- Rollback for create-incremental-sync-functions.sql. Roll back applied imports first
-- (Admin -> Old Data Import), otherwise their drm.* changes can no longer be undone.
BEGIN;
DROP TABLE IF EXISTS migration_meta.import_modern_history;
DROP FUNCTION IF EXISTS migration_meta.tf_followup(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_company(jsonb);
DROP FUNCTION IF EXISTS migration_meta.mig_user(text);
DROP FUNCTION IF EXISTS migration_meta.mig_ts(text);
DROP FUNCTION IF EXISTS migration_meta.mig_trim(text);
COMMIT;
