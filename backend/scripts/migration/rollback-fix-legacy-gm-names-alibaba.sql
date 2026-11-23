-- Undo fix-legacy-gm-names-alibaba.sql on migrated (old-DRM) GM entries: clears the
-- names / sales person id / alibaba status filled from the old tables.
-- Note: also clears any of these fields edited in the app on those rows.
BEGIN;
UPDATE drm.gm_entries g
SET sales_person_name = NULL, added_by_name = NULL, sales_person_id = NULL,
    alibaba_status = NULL, updated_at = now()
FROM migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text;
COMMIT;
