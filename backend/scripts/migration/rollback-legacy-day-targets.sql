-- Undo migrate-legacy-day-targets.sql: deletes ONLY the rows it copied (tracked
-- in migration_meta) plus their mapping rows. Archive untouched; in-app edits
-- to those rows are lost.
BEGIN;
DELETE FROM drm.target_system_daily_targets
WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids
                   WHERE entity_type = 'target_system_daily_target' AND legacy_table = 'webxl_day_target');
DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'target_system_daily_target' AND legacy_table = 'webxl_day_target';
COMMIT;
