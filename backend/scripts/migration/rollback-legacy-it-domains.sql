-- Undo migrate-legacy-it-domains.sql: removes only domains created from the old DRM
-- (via their mapping rows), then the mappings.
BEGIN;
DELETE FROM drm.it_domains d USING (
  SELECT DISTINCT modern_id FROM migration_meta.migration_legacy_ids
  WHERE entity_type = 'it_domain' AND legacy_table = 'webxl_sell'
) m
WHERE d.id::text = m.modern_id;
DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'it_domain' AND legacy_table = 'webxl_sell';
COMMIT;
