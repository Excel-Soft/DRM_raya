-- Repair the 523 drm.loan_requests rows copied from legacy webxl_addvance_salary.
-- The copy stamped every row with created_at = copy time and status = 'HODApproved'.
-- This restores the old create_date, old Pending/Complete/Cancel + manager/hod state.
-- Amount / instalment / remaining already match the archive and are not touched.
-- Original values are kept in migration_meta.loan_requests_repair_backup.
-- Rollback: fix-legacy-loan-requests.rollback.sql
--
-- created_at convention: loan_requests is read through drizzle as UTC, so the old
-- Pakistan wall-clock create_date is stored as (create_date - 5h) to display correctly.

BEGIN;

CREATE TABLE IF NOT EXISTS migration_meta.loan_requests_repair_backup AS
SELECT l.id, l.status, l.created_at, l.updated_at,
       l.manager_approved_at, l.hod_approved_at, l.rejection_reason, now() AS backed_up_at
FROM drm.loan_requests l
WHERE false;

INSERT INTO migration_meta.loan_requests_repair_backup
SELECT l.id, l.status, l.created_at, l.updated_at,
       l.manager_approved_at, l.hod_approved_at, l.rejection_reason, now()
FROM drm.loan_requests l
JOIN migration_meta.migration_legacy_ids m
  ON m.modern_table = 'loan_requests' AND m.modern_id = l.id AND m.legacy_table = 'webxl_addvance_salary'
WHERE NOT EXISTS (SELECT 1 FROM migration_meta.loan_requests_repair_backup b WHERE b.id = l.id);

WITH src AS (
  SELECT m.modern_id, a.*
  FROM migration_meta.migration_legacy_ids m
  JOIN legacy_archive.webxl_addvance_salary a
    ON a._source_table = 'webxl_addvance_salary' AND a._legacy_pk = m.legacy_id
  WHERE m.modern_table = 'loan_requests' AND m.legacy_table = 'webxl_addvance_salary'
)
UPDATE drm.loan_requests l
SET status = (CASE
      WHEN s.status = 'Complete' THEN 'Completed'
      WHEN s.status = 'Cancel' THEN 'Rejected'
      WHEN s.status = 'Pending' AND (s.manager = 'Cancel' OR s.hod = 'Cancel') THEN 'Rejected'
      WHEN s.status = 'Pending' AND s.hod = 'Approved' THEN 'HODApproved'
      WHEN s.status = 'Pending' AND s.manager = 'Approved' THEN 'ManagerApproved'
      WHEN s.status = 'Pending' THEN 'Pending'
      ELSE l.status::text
    END)::drm.loan_status,
    created_at = CASE WHEN s.create_date ~ '^\d{4}-\d{2}-\d{2}'
                      THEN s.create_date::timestamp - interval '5 hours' ELSE l.created_at END,
    updated_at = CASE WHEN s.create_date ~ '^\d{4}-\d{2}-\d{2}'
                      THEN s.create_date::timestamp - interval '5 hours' ELSE l.updated_at END,
    manager_approved_at = CASE WHEN s.manager = 'Approved' AND s.mng_update ~ '^\d{4}-\d{2}-\d{2}'
                               THEN s.mng_update::timestamp ELSE NULL END,
    hod_approved_at = CASE WHEN s.hod = 'Approved' AND s.hod_update ~ '^\d{4}-\d{2}-\d{2}'
                           THEN s.hod_update::timestamp ELSE NULL END,
    rejection_reason = CASE
      WHEN s.hod = 'Cancel' THEN NULLIF(s.hod_comm, '')
      WHEN s.manager = 'Cancel' THEN NULLIF(s.mng_comm, '')
      ELSE l.rejection_reason END
FROM src s
WHERE l.id = s.modern_id
  AND l.updated_at = l.created_at          -- only rows the app has not touched since the copy
  AND l.created_at = (SELECT b.created_at FROM migration_meta.loan_requests_repair_backup b WHERE b.id = l.id);

COMMIT;
