-- Rollback for create-bank-balance-entries.sql (drops entries added in the new app).
DROP TABLE IF EXISTS drm.bank_balance_entries;
