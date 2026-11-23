-- Undo fix-legacy-gm-pkr-screenshot-price.sql on migrated (old-DRM) GM entries.
-- Clears only screenshot links that point at the legacy relay; PKR / package price
-- are reset to NULL (as left by the first migration).
BEGIN;
UPDATE drm.gm_entries g
SET amount_pkr = NULL,
    package_price_usd = NULL,
    payment_proof_url = CASE WHEN g.payment_proof_url LIKE '/api/legacy-assets/gm-screenshot?f=%' THEN NULL ELSE g.payment_proof_url END,
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_table = 'gm_entries' AND m.modern_id = g.id::text;
COMMIT;
