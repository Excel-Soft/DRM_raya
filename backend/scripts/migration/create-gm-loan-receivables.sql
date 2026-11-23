-- drm.gm_loan_receivables was only created by db/ensure.ts, which is skipped on this
-- server (SKIP_SCHEMA_ENSURE=true), so Loan Repayment Installment returned 500.
-- DDL copied verbatim from src/server/db/ensure.ts. Additive.
-- Rollback: create-gm-loan-receivables.rollback.sql
CREATE TABLE IF NOT EXISTS drm.gm_loan_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id varchar NOT NULL,
  customer_id UUID REFERENCES drm.customers(id),
  customer_contribution NUMERIC(14,2) DEFAULT 0,
  webexcels_contribution NUMERIC(14,2) DEFAULT 0,
  loan_amount NUMERIC(14,2) NOT NULL,
  amount_returned NUMERIC(14,2) DEFAULT 0,
  outstanding_amount NUMERIC(14,2) NOT NULL,
  return_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'OUTSTANDING',
  created_by UUID REFERENCES drm.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gm_loan_receivables_gm_id ON drm.gm_loan_receivables (gm_id);
