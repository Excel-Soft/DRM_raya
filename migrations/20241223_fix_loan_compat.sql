-- Add compatibility columns so loan.repository works with legacy loan_requests table
alter table loan_requests
  add column if not exists installment_amount numeric(12,2),
  add column if not exists remaining_amount numeric(12,2),
  add column if not exists detail text,
  add column if not exists manager_approved_by_user_id uuid,
  add column if not exists manager_approved_at timestamptz,
  add column if not exists hod_approved_by_user_id uuid,
  add column if not exists hod_approved_at timestamptz,
  add column if not exists rejection_reason text;

-- Backfill sensible defaults from existing legacy fields
update loan_requests
   set detail = coalesce(detail, reason),
       remaining_amount = coalesce(remaining_amount, amount),
       installment_amount = coalesce(installment_amount, amount / 2.0)
 where true;

-- Map legacy approved_by into manager approval slots if they are empty
update loan_requests
   set manager_approved_by_user_id = coalesce(manager_approved_by_user_id, approved_by),
       manager_approved_at = coalesce(manager_approved_at, created_at)
 where approved_by is not null;

-- Ensure timestamps have defaults for new rows
alter table loan_requests
  alter column created_at set default now(),
  alter column updated_at set default now();
