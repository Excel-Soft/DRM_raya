-- Account -> Create GM: PKR, Screenshot and package price for old-DRM GM entries
-- (webxl_verify_gm -> drm.gm_entries). The first migration left all three empty.
--   amount_pkr         = webxl_verify_gm.amount (customer PKR, the old "PKR" column)
--   payment_proof_url  = /api/legacy-assets/gm-screenshot?f=<screen_shot>
--                        (old file: assets/images/gm_payment_screen_short/<screen_shot>)
--   package_price_usd  = webxl_verify_gm.package_price; when empty, the package's usual
--                        price (most common package_price for that package name), which is
--                        what the old aliBabaPackage() lookup gave - used for Discount %.
-- Only fills empty fields on migrated rows. Idempotent.
-- Rollback: rollback-fix-legacy-gm-pkr-screenshot-price.sql
BEGIN;
WITH pkg AS (
  SELECT DISTINCT ON (lower(btrim(package))) lower(btrim(package)) AS pkg, package_price::numeric AS price
    FROM legacy_archive.webxl_verify_gm
   WHERE package_price ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' AND package_price::numeric > 0
   GROUP BY 1, 2
   ORDER BY lower(btrim(package)), count(*) DESC
)
UPDATE drm.gm_entries g
SET amount_pkr = COALESCE(NULLIF(g.amount_pkr, 0),
                   CASE WHEN l.amount ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' AND l.amount::numeric > 0 THEN l.amount::numeric END),
    payment_proof_url = COALESCE(NULLIF(btrim(g.payment_proof_url), ''),
                   CASE WHEN btrim(l.screen_shot) ~* '^[A-Za-z0-9][A-Za-z0-9._ :()+-]*\.(png|jpe?g|gif|webp|bmp|jfif)$'
                        THEN '/api/legacy-assets/gm-screenshot?f=' ||
                             replace(replace(replace(btrim(l.screen_shot), '%', '%25'), ' ', '%20'), ':', '%3A') END),
    package_price_usd = COALESCE(NULLIF(g.package_price_usd, 0),
                   CASE WHEN l.package_price ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' AND l.package_price::numeric > 0
                        THEN l.package_price::numeric END,
                   pkg.price),
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_verify_gm l ON l._source_table = 'webxl_verify_gm' AND l._legacy_pk = m.legacy_id
LEFT JOIN pkg ON pkg.pkg = lower(btrim(l.package))
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_table = 'gm_entries' AND m.modern_id = g.id::text
  AND (g.amount_pkr IS NULL OR g.amount_pkr = 0
       OR NULLIF(btrim(g.payment_proof_url), '') IS NULL
       OR g.package_price_usd IS NULL OR g.package_price_usd = 0);
COMMIT;
