-- drm_legacy_stage ONLY — match quotation-routes ensure columns
ALTER TABLE drm.quotations
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by text,
  ADD COLUMN IF NOT EXISTS hod_status text,
  ADD COLUMN IF NOT EXISTS hod_reviewed_by text,
  ADD COLUMN IF NOT EXISTS hod_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hod_comment text,
  ADD COLUMN IF NOT EXISTS quotation_type text;

ALTER TABLE drm.quotation_items
  ADD COLUMN IF NOT EXISTS ab_discount numeric(12,2) NOT NULL DEFAULT 0;
