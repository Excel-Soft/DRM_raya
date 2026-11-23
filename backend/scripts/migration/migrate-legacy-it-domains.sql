-- Domain Hosting -> Domains (IT DEPARTMENT / DOMAIN / HOSTING / SSL) from the old DRM.
-- Legacy domain-list = webxl_sell (one sale per domain: com_id, domain_name, cpanel user,
-- reg_date) + webxl_sell_products (pro_type domain / hosting / ssl with start/end dates;
-- domain.key_id = registry, hosting.key_id = hosting package, hosting.server_type = server).
--
-- -> drm.it_domains (one row per domain; domain_name is UNIQUE in the new table):
--    domain_name          trimmed; repeated names -> the latest sale (highest id) wins,
--                         every legacy sell id still gets a mapping row to that domain
--    customer_id          legacy com_id via migration_legacy_ids (webxl_company -> customers)
--    registry_id          domain product key_id   via it_registry mapping
--    hosting_package_id   hosting product key_id  via it_hosting_package mapping
--    server_id            hosting product server_type via it_server mapping (deleted
--                         legacy servers 0/16/18/20 -> NULL)
--    activation_date      reg_date ("Register" column)
--    expiry_date / hosting_expiry_date / ssl_expiry_date = end_date of the latest
--                         domain / hosting / ssl product row
--    status               domain product status: deactive -> Inactive, else Active
--    cpanel_username      username. The cPanel PASSWORD is NOT copied: the new app never
--                         stores plaintext credentials (it stays only in legacy_archive).
-- Requires migrate-legacy-it-hosting.sql (servers/registries/packages) first.
-- Domains already present in it_domains (same name) are left untouched.
-- Idempotent. Rollback: rollback-legacy-it-domains.sql
BEGIN;

CREATE TEMP TABLE _sell ON COMMIT DROP AS
SELECT s.id AS legacy_id, s.com_id, btrim(s.domain_name) AS domain_name,
       NULLIF(btrim(s.username), '') AS cpanel_username,
       CASE WHEN s.reg_date ~ '^\d{4}-\d{2}-\d{2}$' AND s.reg_date <> '0000-00-00' THEN s.reg_date::timestamp END AS reg_date,
       lower(btrim(s.domain_name)) AS name_key
FROM legacy_archive.webxl_sell s
WHERE NULLIF(btrim(s.domain_name), '') IS NOT NULL;

-- latest product row per sale and type
CREATE TEMP TABLE _prod ON COMMIT DROP AS
SELECT DISTINCT ON (p.sell_id, lower(p.pro_type))
       p.sell_id, lower(p.pro_type) AS pro_type, p.key_id, p.server_type, lower(coalesce(p.status, '')) AS status,
       CASE WHEN p.end_date ~ '^\d{4}-\d{2}-\d{2}$' AND p.end_date <> '0000-00-00' THEN p.end_date::timestamp END AS end_date
FROM legacy_archive.webxl_sell_products p
ORDER BY p.sell_id, lower(p.pro_type), p.end_date DESC NULLS LAST, p.id::int DESC;

-- one winner per domain name: latest sale
CREATE TEMP TABLE _dom ON COMMIT DROP AS
SELECT DISTINCT ON (name_key) _sell.*, gen_random_uuid() AS new_id
FROM _sell
WHERE NOT EXISTS (SELECT 1 FROM drm.it_domains d WHERE lower(btrim(d.domain_name)) = _sell.name_key)
  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'it_domain' AND m.legacy_table = 'webxl_sell' AND m.legacy_id = _sell.legacy_id)
ORDER BY name_key, legacy_id::int DESC;

INSERT INTO drm.it_domains (id, customer_id, domain_name, registry_id, server_id, hosting_package_id,
                            cpanel_username, activation_date, expiry_date, ssl_expiry_date, hosting_expiry_date,
                            status, created_at, updated_at)
SELECT d.new_id,
       (SELECT m.modern_id::uuid FROM migration_meta.migration_legacy_ids m
         WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = d.com_id
           AND EXISTS (SELECT 1 FROM drm.customers c WHERE c.id = m.modern_id::uuid) LIMIT 1),
       d.domain_name,
       (SELECT m.modern_id::uuid FROM migration_meta.migration_legacy_ids m
         WHERE m.entity_type = 'it_registry' AND m.legacy_table = 'webxl_registry' AND m.legacy_id = pd.key_id),
       (SELECT m.modern_id::uuid FROM migration_meta.migration_legacy_ids m
         WHERE m.entity_type = 'it_server' AND m.legacy_table = 'webxl_servers' AND m.legacy_id = ph.server_type),
       (SELECT m.modern_id::uuid FROM migration_meta.migration_legacy_ids m
         WHERE m.entity_type = 'it_hosting_package' AND m.legacy_table = 'webxl_package' AND m.legacy_id = ph.key_id),
       d.cpanel_username,
       COALESCE(d.reg_date, pd.end_date - interval '1 year'),
       pd.end_date, ps.end_date, ph.end_date,
       CASE WHEN COALESCE(pd.status, ph.status, '') = 'deactive' THEN 'Inactive' ELSE 'Active' END,
       COALESCE(d.reg_date, now()), now()
FROM _dom d
LEFT JOIN _prod pd ON pd.sell_id = d.legacy_id AND pd.pro_type = 'domain'
LEFT JOIN _prod ph ON ph.sell_id = d.legacy_id AND ph.pro_type = 'hosting'
LEFT JOIN _prod ps ON ps.sell_id = d.legacy_id AND ps.pro_type = 'ssl';

-- mapping: every legacy sale -> the domain row carrying its name
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'it_domain', 'webxl_sell', s.legacy_id, d.id::text, 'it_domains'
FROM _sell s
JOIN drm.it_domains d ON lower(btrim(d.domain_name)) = s.name_key
WHERE d.id IN (SELECT new_id FROM _dom)
ON CONFLICT DO NOTHING;

COMMIT;
