ALTER TABLE drm.invoices DROP CONSTRAINT IF EXISTS invoices_quotation_id_fkey;
ALTER TABLE drm.invoices DROP COLUMN IF EXISTS quotation_id;
