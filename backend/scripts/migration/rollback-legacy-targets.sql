-- Undo migrate-legacy-targets.sql: deletes ONLY the target definitions it
-- created (tracked in migration_meta) plus their mapping rows. Archive untouched.
-- WARNING: in-app edits made to these copied rows are lost. Per-user assignments
-- (target_system_user_targets) store their own copied values and are not touched.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback-legacy-targets.sql
BEGIN;
DELETE FROM drm.target_system_targets
WHERE id IN (SELECT modern_id FROM migration_meta.migration_legacy_ids
             WHERE entity_type = 'target_system_target' AND legacy_table = 'webxl_terget');
DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'target_system_target' AND legacy_table = 'webxl_terget';
COMMIT;
