-- Undo fix-legacy-gm-loan-partial-flags.sql: old-DRM Delay / Installment GM entries
-- back to is_loan = 0 / is_partial_payment = 0 (as left by the first migration).
BEGIN;
UPDATE drm.gm_entries g
SET is_loan = 0, is_partial_payment = 0, updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_verify_gm l ON l.id = m.legacy_id
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text
  AND lower(btrim(coalesce(l.webxl_behalf, ''))) IN ('delay', 'installment');
COMMIT;
