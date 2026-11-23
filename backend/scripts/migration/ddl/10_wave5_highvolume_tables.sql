-- Wave 5 high-volume legacy modules (staging)

ALTER TABLE drm.link_reports ADD COLUMN IF NOT EXISTS legacy_metadata jsonb;

CREATE TABLE IF NOT EXISTS drm.follow_up_service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id varchar NOT NULL,
  legacy_service_id text,
  attribute_id uuid,
  service_type text,
  service_grade text,
  service_comment text,
  manager_id uuid,
  manager_comment text,
  sm_id uuid,
  sm_comment text,
  hod_id uuid,
  hod_comment text,
  purpose text,
  method text,
  next_date timestamptz,
  note text,
  talk_time text,
  added_by uuid,
  legacy_created_at timestamptz,
  legacy_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fusl_follow_up ON drm.follow_up_service_lines (follow_up_id);

CREATE TABLE IF NOT EXISTS drm.legacy_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_task_id text,
  legacy_pro_id text,
  user_id uuid,
  assigned_by uuid,
  assign_date timestamptz,
  status text,
  hours text,
  min text,
  links text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lta_user ON drm.legacy_task_assignments (user_id);

CREATE TABLE IF NOT EXISTS drm.task_log_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_task_id text,
  status text,
  event_time timestamptz,
  legacy_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.attendance_raw_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_uid text,
  office text,
  device_ip text,
  state text,
  punch_type text,
  att_timestamp timestamptz,
  received_at timestamptz,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_raw_user_ts ON drm.attendance_raw_punches (user_id, att_timestamp);
