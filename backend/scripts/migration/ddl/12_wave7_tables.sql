CREATE TABLE IF NOT EXISTS drm.legacy_servicepool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  user_id uuid REFERENCES drm.users(id),
  ta_user_id uuid REFERENCES drm.users(id),
  legacy_parent_id text,
  note text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_dollar_pay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  user_id uuid REFERENCES drm.users(id),
  legacy_gm_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES drm.users(id),
  legacy_loan_id text,
  amount numeric(14,2),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_notice_board (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  legacy_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
