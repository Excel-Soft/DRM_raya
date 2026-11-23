-- Undo migrate-legacy-restricted-keywords.sql: removes only keywords created from
-- legacy webxl_attribute (refId 13) via their mapping rows, then the mappings.
BEGIN;
DELETE FROM drm.restricted_keywords r
USING migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'restricted_keyword' AND m.legacy_table = 'webxl_attribute'
  AND m.modern_id = r.id::text;
DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'restricted_keyword' AND legacy_table = 'webxl_attribute';
COMMIT;
