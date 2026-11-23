-- Undo the data part of migrate-legacy-temp-gm.sql (rows copied from webxl_tem_gm).
-- The added columns are additive and left in place (the app needs them).
BEGIN;
DELETE FROM drm.temp_gm_entries t USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'temp_gm' AND m.legacy_table = 'webxl_tem_gm' AND m.modern_id = t.id;
DELETE FROM migration_meta.migration_legacy_ids WHERE entity_type = 'temp_gm' AND legacy_table = 'webxl_tem_gm';
COMMIT;
