-- drm_legacy_stage ONLY
CREATE TABLE IF NOT EXISTS drm.diagnose_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES drm.customers(id),
  user_id uuid NOT NULL REFERENCES drm.users(id),
  start_rating text,
  up_salling text,
  rfq text,
  products text,
  follow_rate text,
  sample text,
  order_info text,
  revenue text,
  happy_alibaba text,
  happy_webxl text,
  report text,
  create_date timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnose_followups_company ON drm.diagnose_followups (company_id);
CREATE INDEX IF NOT EXISTS idx_diagnose_followups_user ON drm.diagnose_followups (user_id);
