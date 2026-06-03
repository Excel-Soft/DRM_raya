-- Link Report (Team Report submodule) tables.
-- Additive only. Uses the drm schema explicitly. Non-destructive.

CREATE TABLE IF NOT EXISTS drm.link_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id serial,
  submitted_by_user_id uuid NOT NULL REFERENCES drm.users(id),
  company_id uuid,
  company_name text NOT NULL DEFAULT '',
  link_url text NOT NULL,
  source_module text NOT NULL DEFAULT 'manual',
  source_record_id uuid,
  submitted_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_link_reports_submitted_by ON drm.link_reports (submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_link_reports_submitted_at ON drm.link_reports (submitted_at);
CREATE INDEX IF NOT EXISTS idx_link_reports_deleted_at ON drm.link_reports (deleted_at);

CREATE TABLE IF NOT EXISTS drm.link_report_commission_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES drm.users(id),
  verified_by_user_id uuid NOT NULL REFERENCES drm.users(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  link_report_ids jsonb NOT NULL DEFAULT '[]',
  total_links integer NOT NULL DEFAULT 0,
  reward numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'VERIFIED',
  remarks text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lrcv_user ON drm.link_report_commission_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_lrcv_verified_by ON drm.link_report_commission_verifications (verified_by_user_id);
CREATE INDEX IF NOT EXISTS idx_lrcv_start_date ON drm.link_report_commission_verifications (start_date);
CREATE INDEX IF NOT EXISTS idx_lrcv_end_date ON drm.link_report_commission_verifications (end_date);

-- One verification per user + date range (race-safe upserts via ON CONFLICT).
CREATE UNIQUE INDEX IF NOT EXISTS uq_lrcv_user_range
  ON drm.link_report_commission_verifications (user_id, start_date, end_date);
