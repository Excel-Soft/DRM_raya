ALTER TABLE drm.invoices ALTER COLUMN invoice_number DROP DEFAULT;
ALTER TABLE drm.product_posting_invoices ALTER COLUMN invoice_number DROP DEFAULT;
DROP SEQUENCE IF EXISTS drm.global_invoice_number_seq;
