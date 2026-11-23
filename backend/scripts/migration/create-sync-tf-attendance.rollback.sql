-- Rollback for create-sync-tf-attendance.sql (drops only the functions it created)
BEGIN;
DROP FUNCTION IF EXISTS migration_meta.tf_raw_punch(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_attendance_month_history(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_attendance_month(jsonb);
DROP FUNCTION IF EXISTS migration_meta.tf_attendance_month_common(jsonb, boolean, boolean);
DROP FUNCTION IF EXISTS migration_meta.tf_attendance(jsonb);
DROP FUNCTION IF EXISTS migration_meta.mig_js_int(text);
COMMIT;
