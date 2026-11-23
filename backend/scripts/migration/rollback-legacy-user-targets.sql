-- Undo migrate-legacy-user-targets.sql: deletes ONLY the assignments it copied
-- (tracked in migration_meta) plus their mapping rows. Archive untouched.
-- WARNING: in-app edits to those copied assignments are lost; rows created later
-- by "Assign Same Target" from them are separate rows and are NOT removed.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback-legacy-user-targets.sql
BEGIN;
DELETE FROM drm.target_system_user_targets
WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids
                   WHERE entity_type = 'target_system_user_target' AND legacy_table = 'webxl_setterget');
DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'target_system_user_target' AND legacy_table = 'webxl_setterget';
COMMIT;
