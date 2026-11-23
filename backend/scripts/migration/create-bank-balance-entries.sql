-- Balance Report "Add Bank Balance" (old func.php balance_head -> webxl_bank_balance).
-- The old rows were archived read-only in legacy_archive.webxl_bank_balance and were NOT
-- copied into a drm.* table, so entries added in the new app go here. The report lists and
-- sums legacy_archive.webxl_bank_balance + drm.bank_balance_entries together.
-- Used by backend/src/server/routes/balance-report-routes.ts (until this runs, Add returns 503).
-- Additive only. Rollback: create-bank-balance-entries.rollback.sql
CREATE TABLE IF NOT EXISTS drm.bank_balance_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES drm.users(id),
  head        text NOT NULL,
  detail      text,
  amount      numeric(16,2) NOT NULL,
  create_at   date NOT NULL,                 -- old create_at (Pakistan calendar date chosen in the form)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);
CREATE INDEX IF NOT EXISTS bank_balance_entries_create_at_idx ON drm.bank_balance_entries (create_at);
