-- Undo fix-legacy-gm-entry-approvals.sql: clears the approval fields again on migrated
-- (old-DRM) GM entries. Note: also clears any approval done in the app on those rows.
BEGIN;
UPDATE drm.gm_entries g
SET account_manager_status = NULL, hod_status = NULL, approval_status = NULL, updated_at = now()
FROM migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text;
COMMIT;
