-- Dollar System list (/api/account/dollar-system/list) selects gm_entries.expiry_date, which
-- never existed -> every list call 500'd. Additive column + fill from the old DRM
-- (webxl_verify_gm.expire_date; '' / 0000-00-00 stay NULL). Only empty values are filled.
-- Rollback: rollback-add-gm-entries-expiry-date.sql
BEGIN;
ALTER TABLE drm.gm_entries ADD COLUMN IF NOT EXISTS expiry_date timestamp;

UPDATE drm.gm_entries g
   SET expiry_date = l.expire_date::date
  FROM migration_meta.migration_legacy_ids m
  JOIN legacy_archive.webxl_verify_gm l ON l._source_table = 'webxl_verify_gm' AND l._legacy_pk = m.legacy_id
 WHERE m.modern_table = 'gm_entries' AND m.legacy_table = 'webxl_verify_gm' AND m.modern_id = g.id::text
   AND g.expiry_date IS NULL
   AND l.expire_date ~ '^\d{4}-\d{2}-\d{2}' AND l.expire_date NOT LIKE '0000%';
COMMIT;
