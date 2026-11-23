-- Restricted Keywords: copy the old DRM list into drm.restricted_keywords.
-- Legacy kept them in webxl_attribute with refId = 13 (brand / restricted words:
-- NIKE, Gucci, Sony, ...). The generic attribute migration had copied them to
-- drm.attributes as "Portfolio Categories"; those rows are left untouched.
-- Keywords are trimmed; case-insensitive duplicates (e.g. "Balenciaga" twice) and
-- keywords already in the table are not inserted again - every legacy id still gets
-- a mapping row to the keyword it resolves to. created_at = archive ingest time.
-- Idempotent. Rollback: rollback-legacy-restricted-keywords.sql
BEGIN;

WITH src AS (
  SELECT l.id AS legacy_id, btrim(l.name) AS keyword, l._ingested_at
  FROM legacy_archive.webxl_attribute l
  WHERE l."refId" = '13' AND NULLIF(btrim(l.name), '') IS NOT NULL
),
firsts AS (
  SELECT DISTINCT ON (lower(keyword)) keyword, _ingested_at
  FROM src ORDER BY lower(keyword), legacy_id::int
)
INSERT INTO drm.restricted_keywords (keyword, created_at)
SELECT f.keyword, COALESCE(f._ingested_at::timestamp, now())
FROM firsts f
WHERE NOT EXISTS (SELECT 1 FROM drm.restricted_keywords r WHERE lower(r.keyword) = lower(f.keyword));

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'restricted_keyword', 'webxl_attribute', s.legacy_id, r.id::text, 'restricted_keywords'
FROM (SELECT l.id AS legacy_id, btrim(l.name) AS keyword
      FROM legacy_archive.webxl_attribute l
      WHERE l."refId" = '13' AND NULLIF(btrim(l.name), '') IS NOT NULL) s
JOIN LATERAL (SELECT id FROM drm.restricted_keywords r WHERE lower(r.keyword) = lower(s.keyword) ORDER BY created_at LIMIT 1) r ON true
ON CONFLICT DO NOTHING;

COMMIT;
