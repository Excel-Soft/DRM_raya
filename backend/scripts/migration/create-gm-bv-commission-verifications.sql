-- BV Report → commission verification (/api/bv-commission-verifications) reads
-- drm.gm_bv_commission_verifications, which ensure.ts would create but the server runs with
-- SKIP_SCHEMA_ENSURE, so every call 500'd ("relation does not exist"). Same DDL as
-- ensure.ts ensureGmBvCommissionVerificationSchema. Additive only.
-- Rollback: rollback-create-gm-bv-commission-verifications.sql
CREATE TABLE IF NOT EXISTS drm.gm_bv_commission_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES drm.users(id),
  comm_month integer NOT NULL,
  comm_year integer NOT NULL,
  total_comm numeric(12,2) NOT NULL DEFAULT 0,
  total_reward numeric(12,2) NOT NULL DEFAULT 0,
  ab_reward numeric(12,2),
  reward_comment text,
  hod_status text NOT NULL DEFAULT 'Approved',
  user_status text NOT NULL DEFAULT 'Pending',
  account_pay_status text NOT NULL DEFAULT 'Pending',
  final_pay_amount numeric(12,2),
  created_by uuid NOT NULL REFERENCES drm.users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gm_bv_comm_verif_user_period
  ON drm.gm_bv_commission_verifications (user_id, comm_month, comm_year);
CREATE INDEX IF NOT EXISTS idx_gm_bv_comm_verif_user
  ON drm.gm_bv_commission_verifications (user_id);
