-- Rollback for fix-legacy-loan-requests.sql: restore the pre-repair values.
BEGIN;
UPDATE drm.loan_requests l
SET status = b.status, created_at = b.created_at, updated_at = b.updated_at,
    manager_approved_at = b.manager_approved_at, hod_approved_at = b.hod_approved_at,
    rejection_reason = b.rejection_reason
FROM migration_meta.loan_requests_repair_backup b
WHERE b.id = l.id;
DROP TABLE migration_meta.loan_requests_repair_backup;
COMMIT;
