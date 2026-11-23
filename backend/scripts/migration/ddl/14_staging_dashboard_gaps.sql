-- drm_legacy_stage: close schema gaps for dashboard + penalties (additive only)

ALTER TABLE drm.appointments ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE drm.appointments ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS employee_disputed_at timestamptz;
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS dispute_status text;
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid REFERENCES drm.users(id);
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;
ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS dispute_resolution_note text;

CREATE TABLE IF NOT EXISTS drm.followup_subservice_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id uuid NOT NULL REFERENCES drm.follow_ups(id) ON DELETE CASCADE,
  service_id uuid REFERENCES drm.services(id) ON DELETE SET NULL,
  subservice_id uuid,
  service_code text,
  subservice_code text,
  purpose text,
  grade text,
  method text,
  comment text DEFAULT '',
  note text DEFAULT '',
  talk_time_minutes int,
  activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_detail_followup ON drm.followup_subservice_details(followup_id);
