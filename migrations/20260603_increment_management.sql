-- Increment Management Module
-- Additive only: creates the drm.increment_evaluations table used to persist
-- calculated increment evaluation snapshots and manager decisions.
-- Safe to run repeatedly (IF NOT EXISTS). Does NOT alter existing tables.

CREATE TABLE IF NOT EXISTS drm.increment_evaluations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             uuid NOT NULL REFERENCES drm.users(id),
  calculated_by           uuid REFERENCES drm.users(id),
  reviewed_by             uuid REFERENCES drm.users(id),
  review_start_date       date NOT NULL,
  review_end_date         date NOT NULL,
  current_salary          numeric(12,2),
  per_day_salary          numeric(12,2),
  leave_days              numeric(8,2),
  allowed_leave_days      numeric(8,2),
  increment_leaves        numeric(8,2),
  leave_deduction_amount  numeric(12,2),
  total_minutes           integer,
  relaxation_minutes      integer,
  increment_minutes       integer,
  total_tasks             integer,
  pending_tasks           integer,
  running_tasks           integer,
  completed_tasks         integer,
  notice_count            integer,
  eligibility_status      text,
  proposed_increment_type text,
  proposed_increment_value numeric(12,2),
  status                  text NOT NULL DEFAULT 'PENDING',
  manager_remarks         text,
  rejection_reason        text,
  effective_date          date,
  calculation_snapshot    jsonb,
  missing_data            jsonb,
  created_at              timestamp DEFAULT now(),
  updated_at              timestamp DEFAULT now(),
  approved_at             timestamp
);

CREATE INDEX IF NOT EXISTS idx_increment_eval_employee
  ON drm.increment_evaluations (employee_id);
CREATE INDEX IF NOT EXISTS idx_increment_eval_review_dates
  ON drm.increment_evaluations (review_start_date, review_end_date);
CREATE INDEX IF NOT EXISTS idx_increment_eval_status
  ON drm.increment_evaluations (status);
CREATE INDEX IF NOT EXISTS idx_increment_eval_effective
  ON drm.increment_evaluations (effective_date);
