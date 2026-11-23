-- Rollback: remove the copied slots (and any allocations made against them must be reviewed first).
BEGIN;
DELETE FROM drm.dollar_buying b
 USING migration_meta.migration_legacy_ids m
 WHERE m.modern_table = 'dollar_buying' AND m.legacy_table = 'webxl_dollar_buyer_dollars' AND m.modern_id = b.id::text;
DELETE FROM migration_meta.migration_legacy_ids
 WHERE modern_table = 'dollar_buying' AND legacy_table = 'webxl_dollar_buyer_dollars';
COMMIT;
