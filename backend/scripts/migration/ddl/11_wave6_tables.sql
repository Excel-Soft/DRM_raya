CREATE TABLE IF NOT EXISTS drm.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_gm_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  sales_person_id uuid REFERENCES drm.users(id),
  bv_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  last_start_date timestamptz,
  last_expire_date timestamptz,
  renewal text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_gm_account_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  user_id uuid REFERENCES drm.users(id),
  title text,
  bv_date timestamptz,
  bv_expire timestamptz,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_verify_gm_cash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  user_id uuid REFERENCES drm.users(id),
  legacy_gm_id text,
  pkr numeric(14,2),
  total_balance numeric(14,2),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_verify_gm_delay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES drm.customers(id),
  user_id uuid REFERENCES drm.users(id),
  legacy_gm_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_invoice_item_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  legacy_invoice_id text,
  legacy_inv_item_id text,
  item_label text,
  amount numeric(14,2),
  method text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.legacy_posting_main_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES drm.users(id),
  category text,
  image_ref text,
  legacy_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
