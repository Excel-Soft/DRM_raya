-- Account -> Create GM: approval state for the 4,797 GM entries copied from the old DRM
-- (webxl_verify_gm -> drm.gm_entries). The first migration left hod_status /
-- account_manager_status / approval_status empty, so the page's Approved / HOD Rejected /
-- Account Rejected tabs (and the Full GM count) showed 0 for every old entry.
-- Old fields:
--   acc_disc_status  = account approval  (Approved / Pending / Rejected)
--   ceo_disc_status  = HOD (CEO) approval (Approved / Rejected)
--   status           = payment state (Cash Received / Online Paid / ...) - already in payment_status
-- Mapping:
--   account_manager_status = lower(acc_disc_status); both blank (entries from before the
--                            approval step, already completed) -> 'approved'
--   hod_status             = lower(ceo_disc_status) (approved / rejected / pending); blank -> 'approved'
--   approval_status        = 'pending_managers' while account is still Pending (same as the new
--                            flow, shown under Approved), otherwise 'approved' / 'rejected'
-- Only migrated rows whose approval fields are still empty are touched. Idempotent.
-- Rollback: rollback-fix-legacy-gm-entry-approvals.sql
BEGIN;
UPDATE drm.gm_entries g
SET account_manager_status = CASE
      WHEN lower(btrim(coalesce(l.acc_disc_status, ''))) IN ('approved', 'pending', 'rejected') THEN lower(btrim(l.acc_disc_status))
      ELSE 'approved' END,
    hod_status = CASE
      WHEN lower(btrim(coalesce(l.ceo_disc_status, ''))) IN ('approved', 'rejected', 'pending') THEN lower(btrim(l.ceo_disc_status))
      ELSE 'approved' END,
    approval_status = CASE
      WHEN lower(btrim(coalesce(l.ceo_disc_status, ''))) = 'rejected'
        OR lower(btrim(coalesce(l.acc_disc_status, ''))) = 'rejected' THEN 'rejected'
      WHEN lower(btrim(coalesce(l.acc_disc_status, ''))) = 'pending' THEN 'pending_managers'
      ELSE 'approved' END,
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_verify_gm l ON l.id = m.legacy_id
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text
  AND g.hod_status IS NULL AND g.account_manager_status IS NULL AND g.approval_status IS NULL;
COMMIT;
