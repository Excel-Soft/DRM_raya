-- Undo migrate-legacy-gm-installments.sql: removes receipts created from old-DRM
-- installments and clears schedules built from them (rows tagged with legacyId).
-- The screenshot_url column is additive and left in place.
BEGIN;
DELETE FROM drm.gm_partial_receipts r USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'gm_partial_receipt' AND m.legacy_table = 'webxl_verify_gm_delay_amount'
   AND m.modern_id = r.id;
DELETE FROM migration_meta.migration_legacy_ids
 WHERE entity_type = 'gm_partial_receipt' AND legacy_table = 'webxl_verify_gm_delay_amount';
UPDATE drm.gm_entries g
SET installments = '[]'::jsonb, updated_at = now()
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(g.installments, '[]'::jsonb)) e WHERE e ? 'legacyId');
COMMIT;
