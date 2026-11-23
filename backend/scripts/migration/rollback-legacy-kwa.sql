-- Undo migrate-legacy-kwa.sql: deletes ONLY the KWA records/history rows it
-- copied (tracked in migration_meta) plus their mapping rows. Archive untouched.
-- WARNING: Use/Refund transactions added in the app against copied records stay
-- in history but lose their record; in-app edits to copied rows are lost.
BEGIN;
DELETE FROM drm.target_system_kwa_history
WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids
                   WHERE entity_type = 'target_system_kwa_history' AND legacy_table = 'webxl_kwa_history');
DELETE FROM drm.target_system_kwa_records
WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids
                   WHERE entity_type = 'target_system_kwa_record' AND legacy_table = 'webxl_kwa');
DELETE FROM migration_meta.migration_legacy_ids
WHERE (entity_type, legacy_table) IN (('target_system_kwa_history', 'webxl_kwa_history'),
                                      ('target_system_kwa_record', 'webxl_kwa'));
COMMIT;
