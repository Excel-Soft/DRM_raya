-- Rollback for create-sync-tf-invoices.sql (functions only; no data touched).
BEGIN;
DROP FUNCTION IF EXISTS migration_meta.tf_quotation(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_invoice_item_pay(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_payment(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_invoice(jsonb);
DROP FUNCTION IF EXISTS migration_meta.mig_inv_items(text);
DROP FUNCTION IF EXISTS migration_meta.mig_jsnum_json(float8);
DROP FUNCTION IF EXISTS migration_meta.mig_money(text, text);
DROP FUNCTION IF EXISTS migration_meta.mig_jsnum(text);
COMMIT;
