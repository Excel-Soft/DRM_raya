-- Undo migrate-legacy-chart-of-accounts.sql
-- 1) expense heads back to the first migration's placeholder "Head <legacy head_id>"
-- 2) remove account heads created from the old DRM (children first), then the mappings.
BEGIN;
UPDATE drm.office_expenses o
SET expense_head = 'Head ' || e.head_id
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_expense e ON e.id = m.legacy_id
WHERE m.entity_type = 'expense_row' AND m.legacy_table = 'webxl_expense' AND m.modern_id = o.id;

DELETE FROM drm.account_heads a USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'account_head' AND m.legacy_table = 'webxl_coa_sub_transactional_heads' AND m.modern_id = a.id;
DELETE FROM drm.account_heads a USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'account_head' AND m.legacy_table = 'webxl_coa_transactional_heads' AND m.modern_id = a.id;
DELETE FROM drm.account_heads a USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'account_head' AND m.legacy_table = 'webxl_coa_child_heads' AND m.modern_id = a.id;
DELETE FROM drm.account_heads a USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'account_head' AND m.legacy_table = 'webxl_coa_parent_heads' AND m.modern_id = a.id;
DELETE FROM migration_meta.migration_legacy_ids WHERE entity_type = 'account_head';
COMMIT;
