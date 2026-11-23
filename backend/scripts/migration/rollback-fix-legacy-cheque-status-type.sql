-- Undo fix-legacy-cheque-status-type.sql for migrated cheques: back to the first
-- migration's values (status Pending, cheque_type NULL, bank_name = old type).
-- Note: this also resets any status changed in the app on those migrated rows.
BEGIN;
UPDATE drm.cheques c
SET status = 'Pending'::drm.cheque_status,
    cheque_type = NULL,
    bank_name = COALESCE(NULLIF(btrim(l.cheque_type), ''), c.bank_name),
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_cheque_system l ON l.id = m.legacy_id
WHERE m.legacy_table = 'webxl_cheque_system'
  AND m.modern_id = c.id;
COMMIT;
