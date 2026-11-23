-- Rollback of add-vas-comm-final-verify-columns.sql. The id sequence is left
-- where it is (moving it back would make new inserts collide with existing ids).
BEGIN;
ALTER TABLE drm.webxl_vas_comm_final DROP COLUMN IF EXISTS user_status_date;
ALTER TABLE drm.webxl_vas_comm_final DROP COLUMN IF EXISTS total_amount;
COMMIT;
