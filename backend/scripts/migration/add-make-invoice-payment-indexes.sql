-- Make Invoice: lookups of item payments by old invoice / item id (list + Create Project).
-- Additive only. Rollback: rollback-add-make-invoice-payment-indexes.sql
CREATE INDEX IF NOT EXISTS idx_legacy_inv_item_pay_legacy_invoice ON drm.legacy_invoice_item_payments (legacy_invoice_id);
CREATE INDEX IF NOT EXISTS idx_legacy_inv_item_pay_legacy_item ON drm.legacy_invoice_item_payments (legacy_inv_item_id);
CREATE INDEX IF NOT EXISTS idx_projects_notes_make_invoice ON drm.projects (notes) WHERE notes LIKE 'make-invoice item %';
