-- Account -> Create GM: LOAN GM / Partial GM tabs for old-DRM GM entries.
-- Old DRM (webxl_verify_gm.webxl_behalf):  'Delay' -> loan GM,  'Installment' -> partial
-- (installment) GM. Their repayments are in webxl_verify_gm_delay_amount
-- (copied to drm.legacy_verify_gm_delay). The first migration left is_loan /
-- is_partial_payment = 0 for everyone, so both tabs showed 0.
-- Only migrated rows; idempotent. Rollback: rollback-fix-legacy-gm-loan-partial-flags.sql
BEGIN;
UPDATE drm.gm_entries g
SET is_loan = CASE WHEN lower(btrim(l.webxl_behalf)) = 'delay' THEN 1 ELSE g.is_loan END,
    is_partial_payment = CASE WHEN lower(btrim(l.webxl_behalf)) = 'installment' THEN 1 ELSE g.is_partial_payment END,
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_verify_gm l ON l.id = m.legacy_id
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text
  AND lower(btrim(coalesce(l.webxl_behalf, ''))) IN ('delay', 'installment')
  AND NOT (
    (lower(btrim(l.webxl_behalf)) = 'delay' AND coalesce(g.is_loan, 0) = 1) OR
    (lower(btrim(l.webxl_behalf)) = 'installment' AND coalesce(g.is_partial_payment, 0) = 1)
  );
COMMIT;
