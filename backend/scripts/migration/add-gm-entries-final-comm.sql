-- BV Report: editable commission per GM. Old DRM kept a manual override in
-- webxl_verify_gm.finalComm (used instead of the computed commission when set); the copied
-- archive is read-only, so edits made in the new app are stored here and win over both.
-- Additive only. Rollback: rollback-add-gm-entries-final-comm.sql
ALTER TABLE drm.gm_entries ADD COLUMN IF NOT EXISTS final_comm numeric(12,2);
ALTER TABLE drm.gm_entries ADD COLUMN IF NOT EXISTS final_comm_by uuid;
ALTER TABLE drm.gm_entries ADD COLUMN IF NOT EXISTS final_comm_at timestamptz;
