-- D&D Manager Penalty Management module.
-- Additive only. Creates drm.penalties (soft-delete via deleted_at). Idempotent.
-- Applied directly against the live DB (project does NOT run db:push).

CREATE TABLE IF NOT EXISTS drm.penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES drm.users(id),
  department text,
  penalty_head text NOT NULL,
  reason text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  penalty_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES drm.users(id),
  approval_status text NOT NULL DEFAULT 'PENDING',
  attachment_url text,
  attachment_name text,
  manager_remarks text,
  hod_remarks text,
  approved_by uuid REFERENCES drm.users(id),
  approved_at timestamp,
  rejected_by uuid REFERENCES drm.users(id),
  rejected_at timestamp,
  employee_acknowledged_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_penalties_employee ON drm.penalties (employee_id);
CREATE INDEX IF NOT EXISTS idx_penalties_created_by ON drm.penalties (created_by);
CREATE INDEX IF NOT EXISTS idx_penalties_date ON drm.penalties (penalty_date);
CREATE INDEX IF NOT EXISTS idx_penalties_status ON drm.penalties (approval_status);
CREATE INDEX IF NOT EXISTS idx_penalties_department ON drm.penalties (department);
CREATE INDEX IF NOT EXISTS idx_penalties_deleted_at ON drm.penalties (deleted_at);
