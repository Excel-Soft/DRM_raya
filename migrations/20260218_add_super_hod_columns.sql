-- Add Super HOD approval columns to gm_entries
ALTER TABLE gm_entries ADD COLUMN IF NOT EXISTS super_hod_approved_at TIMESTAMP;
ALTER TABLE gm_entries ADD COLUMN IF NOT EXISTS super_hod_approved_by UUID;
ALTER TABLE gm_entries ADD COLUMN IF NOT EXISTS super_hod_comment TEXT;
