-- Undo migrate-legacy-refund-gm.sql (rows copied from webxl_refund_gm).
BEGIN;
DELETE FROM drm.refund_gm_entries r USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'refund_gm' AND m.legacy_table = 'webxl_refund_gm' AND m.modern_id = r.id;
DELETE FROM migration_meta.migration_legacy_ids WHERE entity_type = 'refund_gm' AND legacy_table = 'webxl_refund_gm';
COMMIT;
