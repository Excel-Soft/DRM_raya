-- Cheque System: repair the 435 cheques copied from the old DRM (webxl_cheque_system).
-- The first migration left every row as status 'Pending' (= "Un-used" on the page) and
-- put the old cheque_type into bank_name, so "CHEQUE USED PKR" showed 0.00.
--   legacy cheque_status 'used'    -> status 'Cleared' (page label "Used")
--   legacy cheque_status 'un-used' -> status 'Pending' (page label "Un-used")
--   legacy cheque_type ("For Dollar", "Closing", "Recovery", "For Expense") -> cheque_type
--   bank_name                      -> 'Askari Bank' (only where it holds the old type)
--   notes                          <- legacy comments when notes is empty
-- Only rows still untouched since the migration (status Pending, cheque_type NULL) are
-- updated, so a status changed in the app afterwards is never overwritten. Idempotent.
-- Rollback: rollback-fix-legacy-cheque-status-type.sql
BEGIN;
UPDATE drm.cheques c
SET status = CASE WHEN lower(btrim(l.cheque_status)) = 'used' THEN 'Cleared'::drm.cheque_status ELSE 'Pending'::drm.cheque_status END,
    cheque_type = NULLIF(btrim(l.cheque_type), ''),
    bank_name = CASE WHEN c.bank_name = COALESCE(NULLIF(btrim(l.cheque_type), ''), c.bank_name) THEN 'Askari Bank' ELSE c.bank_name END,
    notes = COALESCE(NULLIF(btrim(c.notes), ''), NULLIF(btrim(l.comments), '')),
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_cheque_system l ON l.id = m.legacy_id
WHERE m.legacy_table = 'webxl_cheque_system'
  AND m.modern_id = c.id
  AND c.status = 'Pending'
  AND c.cheque_type IS NULL;
COMMIT;
