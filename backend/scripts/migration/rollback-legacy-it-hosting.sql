-- Undo migrate-legacy-it-hosting.sql (only rows created from the old DRM, via mapping rows).
-- Domains pointing at these rows keep existing; their server/registry/package link is cleared first.
BEGIN;
UPDATE drm.it_domains d SET server_id = NULL
  FROM migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_server' AND m.modern_id = d.server_id::text;
UPDATE drm.it_domains d SET registry_id = NULL
  FROM migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_registry' AND m.modern_id = d.registry_id::text;
UPDATE drm.it_domains d SET hosting_package_id = NULL
  FROM migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_hosting_package' AND m.modern_id = d.hosting_package_id::text;
DELETE FROM drm.it_servers s USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_server' AND m.modern_id = s.id::text;
DELETE FROM drm.it_registries r USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_registry' AND m.modern_id = r.id::text;
DELETE FROM drm.it_hosting_packages p USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'it_hosting_package' AND m.modern_id = p.id::text;
DELETE FROM migration_meta.migration_legacy_ids
 WHERE entity_type IN ('it_server', 'it_registry', 'it_hosting_package');
COMMIT;
