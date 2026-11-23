-- Company Ledger / account history look up payments by invoice (reference_id).
-- Without it every invoice row scans ledger_entries. Additive only.
-- Rollback: rollback-add-ledger-reference-index.sql
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference_id ON drm.ledger_entries (reference_id);
