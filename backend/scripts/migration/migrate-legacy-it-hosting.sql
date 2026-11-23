-- Domain Hosting (Add Server / Add Domain page): copy the old DRM lists into the
-- new IT tables, which were empty, so the Registry / Hosting dropdowns have data.
--   webxl_servers  (13) -> drm.it_servers          name=title, ip=server_name (nameservers),
--                                                   capacity_mb=space, years=year, buying_date
--   webxl_registry  (9) -> drm.it_registries       name=title
--   webxl_package   (6) -> drm.it_hosting_packages name=title, capacity_mb=space ("Unlimited" when 0)
-- created_at = archive ingest time + legacy id (ms) so lists keep the old order.
-- Legacy domain list was empty (no rows to copy). Idempotent via mapping rows.
-- Rollback: rollback-legacy-it-hosting.sql
BEGIN;

-- Servers
CREATE TEMP TABLE _srv ON COMMIT DROP AS
SELECT s.server_id AS legacy_id, gen_random_uuid() AS new_id,
       btrim(s.title) AS name,
       COALESCE(NULLIF(btrim(regexp_replace(s.server_name, '\s*[\r\n]+\s*', ', ', 'g')), ''), btrim(s.title)) AS ip,
       NULLIF(s.space, '')::int AS capacity_mb,
       NULLIF(s.year, '')::int AS years,
       CASE WHEN s.buying_date ~ '^\d{4}-\d{2}-\d{2}$' AND s.buying_date <> '0000-00-00' THEN s.buying_date::date END AS buying_date,
       s._ingested_at::timestamp + (s.server_id::int * interval '1 millisecond') AS created_at
FROM legacy_archive.webxl_servers s
WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'it_server' AND m.legacy_table = 'webxl_servers' AND m.legacy_id = s.server_id);

INSERT INTO drm.it_servers (id, name, ip, capacity_mb, years, buying_date, notes, created_at, updated_at)
SELECT new_id, name, ip, capacity_mb, years, buying_date, 'Imported from old DRM', created_at, created_at FROM _srv;
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'it_server', 'webxl_servers', legacy_id, new_id::text, 'it_servers' FROM _srv;

-- Registries
CREATE TEMP TABLE _reg ON COMMIT DROP AS
SELECT r.registry_id AS legacy_id, gen_random_uuid() AS new_id, btrim(r.title) AS name,
       r._ingested_at::timestamp + (r.registry_id::int * interval '1 millisecond') AS created_at
FROM legacy_archive.webxl_registry r
WHERE NULLIF(btrim(r.title), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'it_registry' AND m.legacy_table = 'webxl_registry' AND m.legacy_id = r.registry_id);
INSERT INTO drm.it_registries (id, name, created_at) SELECT new_id, name, created_at FROM _reg;
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'it_registry', 'webxl_registry', legacy_id, new_id::text, 'it_registries' FROM _reg;

-- Hosting packages
CREATE TEMP TABLE _pkg ON COMMIT DROP AS
SELECT p.pack_id AS legacy_id, gen_random_uuid() AS new_id, btrim(p.title) AS name,
       NULLIF(p.space, '')::int AS capacity_mb,
       CASE WHEN COALESCE(NULLIF(p.space, '')::int, 0) > 0 THEN p.space || 'MB' ELSE 'Unlimited' END AS capacity,
       p._ingested_at::timestamp + (p.pack_id::int * interval '1 millisecond') AS created_at
FROM legacy_archive.webxl_package p
WHERE NULLIF(btrim(p.title), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'it_hosting_package' AND m.legacy_table = 'webxl_package' AND m.legacy_id = p.pack_id);
INSERT INTO drm.it_hosting_packages (id, name, capacity, capacity_mb, created_at)
SELECT new_id, name, capacity, capacity_mb, created_at FROM _pkg;
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'it_hosting_package', 'webxl_package', legacy_id, new_id::text, 'it_hosting_packages' FROM _pkg;

COMMIT;
