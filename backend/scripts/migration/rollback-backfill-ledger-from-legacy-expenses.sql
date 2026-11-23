-- Undo backfill-ledger-from-legacy-expenses.sql: removes the office_expense ledger
-- entries of migrated (old-DRM) expenses only. Entries for expenses created in the
-- new app are untouched.
BEGIN;
DELETE FROM drm.ledger_entries le
USING migration_meta.migration_legacy_ids m
WHERE le.reference_type = 'office_expense'
  AND m.entity_type = 'expense_row' AND m.legacy_table = 'webxl_expense'
  AND m.modern_id = le.reference_id;
COMMIT;
