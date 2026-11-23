-- drm.global_invoice_number_seq was only created by db/ensure.ts
-- (ensureGlobalInvoiceNumberSchema), which is skipped on this server
-- (SKIP_SCHEMA_ENSURE=true). GET /api/account/invoices/next-number and the
-- product-posting workflow (nextval('drm.global_invoice_number_seq')) failed with
-- "relation drm.global_invoice_number_seq does not exist".
-- DDL copied verbatim from src/server/db/ensure.ts. Additive: creates the sequence,
-- seeds it past the highest existing INV-number, and sets the column DEFAULTs
-- (no existing rows are modified).
-- Rollback: create-global-invoice-number-seq.rollback.sql
CREATE SEQUENCE IF NOT EXISTS drm.global_invoice_number_seq START 1001;
SELECT setval(
       'drm.global_invoice_number_seq',
       GREATEST(1001, (
         SELECT COALESCE(MAX(val), 1000) FROM (
           SELECT CASE 
             WHEN invoice_number ~ '^INV-[0-9]+$' THEN substring(invoice_number from '^INV-([0-9]+)')::int
             WHEN invoice_number ~ '^[0-9]+$' THEN invoice_number::int
             WHEN invoice_number ~ '^AUTO-[0-9]+$' THEN substring(invoice_number from 'AUTO-([0-9]+)')::int
             ELSE NULL
           END as val
           FROM drm.product_posting_invoices
           UNION ALL
           SELECT CASE 
             WHEN invoice_number ~ '^INV-[0-9]+$' THEN substring(invoice_number from '^INV-([0-9]+)')::int
             WHEN invoice_number ~ '^[0-9]+$' THEN invoice_number::int
             ELSE NULL
           END as val
           FROM drm.invoices
         ) combined
       ))
     );
ALTER TABLE drm.product_posting_invoices
       ALTER COLUMN invoice_number SET DEFAULT 'INV-' || LPAD(nextval('drm.global_invoice_number_seq')::text, 5, '0');
ALTER TABLE drm.invoices
       ALTER COLUMN invoice_number SET DEFAULT 'INV-' || LPAD(nextval('drm.global_invoice_number_seq')::text, 5, '0');
