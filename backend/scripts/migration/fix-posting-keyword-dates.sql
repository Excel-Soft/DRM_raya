-- Restore the original date on migrated keyword rows (legacy
-- webxl_posting_keywords.date). The earlier ETL stamped created_at with the
-- migration run time (2026-11-05..10), so View Keywords' date column/filter
-- showed the wrong dates. Only rows listed in migration_legacy_ids
-- (entity posting_keyword_row) are touched; archive untouched; idempotent.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f fix-posting-keyword-dates.sql
BEGIN;
UPDATE drm.product_posting_data p
SET created_at = k.date::timestamp
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_posting_keywords k ON k.id = m.legacy_id
WHERE m.entity_type = 'posting_keyword_row'
  AND m.legacy_table = 'webxl_posting_keywords'
  AND p.id::text = m.modern_id
  AND k.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
  AND p.created_at IS DISTINCT FROM k.date::timestamp;
COMMIT;
