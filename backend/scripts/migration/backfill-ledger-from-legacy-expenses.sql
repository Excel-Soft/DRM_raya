-- General Ledger for old-DRM office expenses.
-- The app posts a Debit ledger entry on the expense's account head whenever an
-- office expense is created (office-account-routes.ts POST /expenses). The 15,388
-- expenses copied from the old DRM were inserted directly, so none of them had that
-- entry and the General Ledger was empty for every earlier date.
-- This posts exactly the same entry for each migrated expense that is booked on a
-- chart-of-accounts head (expense_head = account_heads.id; the 2025+ expenses, see
-- migrate-legacy-chart-of-accounts.sql). Pre-2025 expenses used the old expense-head
-- list, which has no chart-of-accounts head, so there is nothing to post them to.
-- Idempotent (skips expenses that already have an office_expense ledger entry).
-- Rollback: rollback-backfill-ledger-from-legacy-expenses.sql
BEGIN;
INSERT INTO drm.ledger_entries
  (account_head_id, entry_type, amount, currency, date, entry_date, description, category,
   reference_id, reference_type, branch, status, created_by_user_id, posted_at, created_at, updated_at)
SELECT o.expense_head, 'Debit', o.amount, COALESCE(NULLIF(o.currency, ''), 'PKR'),
       o.expense_date, o.expense_date::date,
       COALESCE(NULLIF(btrim(o.detail), ''), 'Office Expense - ' || o.office),
       'Expenses', o.id, 'office_expense', o.office, 'Posted', o.created_by_user_id,
       o.expense_date, now(), now()
FROM drm.office_expenses o
JOIN migration_meta.migration_legacy_ids m
  ON m.entity_type = 'expense_row' AND m.legacy_table = 'webxl_expense' AND m.modern_id = o.id
JOIN drm.account_heads a ON a.id = o.expense_head
WHERE NOT EXISTS (
  SELECT 1 FROM drm.ledger_entries le
   WHERE le.reference_type = 'office_expense' AND le.reference_id = o.id
);
COMMIT;
