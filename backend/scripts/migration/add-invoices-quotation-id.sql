-- drm.invoices.quotation_id is referenced by HOD dashboard summary/approvals
-- (hod.repository.ts), invoice-project-threshold.service.ts and account-routes, but it was
-- only created lazily on first invoice creation (ensureInvoiceQuotationLink), so those
-- endpoints returned 500. Same DDL as that function. Additive.
-- Rollback: add-invoices-quotation-id.rollback.sql
ALTER TABLE drm.invoices ADD COLUMN IF NOT EXISTS quotation_id uuid NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_quotation_id_fkey') THEN
    ALTER TABLE drm.invoices ADD CONSTRAINT invoices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES drm.quotations(id) ON DELETE SET NULL;
  END IF;
END $$;
