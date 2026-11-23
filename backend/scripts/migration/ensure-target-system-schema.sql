-- Additive schema patch for the Target System module. Same statements as
-- ensureTargetSystemConversionColumn() + ensureTargetSystemKwaHistorySchema()
-- in backend/src/server/db/ensure.ts, which never ran on this DB because the
-- server runs with SKIP_SCHEMA_ENSURE=true. Without these columns
-- GET/POST /api/target-system/targets fail ("column conversion does not exist").
-- Idempotent (IF NOT EXISTS); adds only, never drops.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ensure-target-system-schema.sql
BEGIN;
ALTER TABLE drm.target_system_targets ADD COLUMN IF NOT EXISTS conversion integer NOT NULL DEFAULT 0;
ALTER TABLE drm.target_system_targets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE drm.target_system_user_targets ADD COLUMN IF NOT EXISTS conversion numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE drm.target_system_user_targets ADD COLUMN IF NOT EXISTS max_price numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS used_by text;
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS reward numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Sell';
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS pay_date timestamp;
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS com_id text;
ALTER TABLE drm.target_system_kwa_records ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES drm.customers(id);
CREATE TABLE IF NOT EXISTS drm.target_system_kwa_history (
  id serial PRIMARY KEY,
  kwa_record_id integer NOT NULL,
  company text NOT NULL,
  employee text NOT NULL,
  amount numeric(12,2) NOT NULL,
  action_type text NOT NULL,
  detail text,
  pay_date timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_target_system_kwa_history_record ON drm.target_system_kwa_history (kwa_record_id);
CREATE INDEX IF NOT EXISTS idx_target_system_kwa_history_employee ON drm.target_system_kwa_history (employee);
COMMIT;
