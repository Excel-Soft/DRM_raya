-- Undo add-gm-entries-final-comm.sql (drops the edited commissions).
ALTER TABLE drm.gm_entries DROP COLUMN IF EXISTS final_comm_at;
ALTER TABLE drm.gm_entries DROP COLUMN IF EXISTS final_comm_by;
ALTER TABLE drm.gm_entries DROP COLUMN IF EXISTS final_comm;
