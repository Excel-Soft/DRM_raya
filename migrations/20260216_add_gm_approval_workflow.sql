-- Migration: Add multi-stage approval workflow for GM entries
-- Date: 2026-02-16
-- Description: Add approval tracking columns for HOD, Account Manager, and Sales Manager

-- Add approval workflow columns
ALTER TABLE gm_entries 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending_hod',
ADD COLUMN IF NOT EXISTS hod_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS hod_approved_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS hod_comment TEXT,
ADD COLUMN IF NOT EXISTS account_manager_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS account_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS account_manager_approved_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS account_manager_comment TEXT,
ADD COLUMN IF NOT EXISTS sales_manager_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS sales_manager_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sales_manager_approved_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS sales_manager_comment TEXT,
ADD COLUMN IF NOT EXISTS final_status VARCHAR(50);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gm_approval_status ON gm_entries(approval_status);
CREATE INDEX IF NOT EXISTS idx_gm_account_manager_status ON gm_entries(account_manager_status);
CREATE INDEX IF NOT EXISTS idx_gm_sales_manager_status ON gm_entries(sales_manager_status);
CREATE INDEX IF NOT EXISTS idx_gm_final_status ON gm_entries(final_status);

-- Add comments for documentation
COMMENT ON COLUMN gm_entries.approval_status IS 'Current approval stage: pending_hod, pending_managers, approved, rejected_by_hod, rejected_by_account_manager, rejected_by_sales_manager';
COMMENT ON COLUMN gm_entries.hod_approved_at IS 'Timestamp when HOD approved';
COMMENT ON COLUMN gm_entries.hod_approved_by IS 'User ID of HOD who approved';
COMMENT ON COLUMN gm_entries.hod_comment IS 'HOD approval/rejection comment';
COMMENT ON COLUMN gm_entries.account_manager_status IS 'Account Manager approval status: pending, approved, rejected';
COMMENT ON COLUMN gm_entries.account_manager_approved_at IS 'Timestamp when Account Manager approved/rejected';
COMMENT ON COLUMN gm_entries.account_manager_approved_by IS 'User ID of Account Manager';
COMMENT ON COLUMN gm_entries.account_manager_comment IS 'Account Manager comment';
COMMENT ON COLUMN gm_entries.sales_manager_status IS 'Sales Manager approval status: pending, approved, rejected';
COMMENT ON COLUMN gm_entries.sales_manager_approved_at IS 'Timestamp when Sales Manager approved/rejected';
COMMENT ON COLUMN gm_entries.sales_manager_approved_by IS 'User ID of Sales Manager';
COMMENT ON COLUMN gm_entries.sales_manager_comment IS 'Sales Manager comment';
COMMENT ON COLUMN gm_entries.final_status IS 'Final approval status: approved, rejected';

-- Update existing entries to have default approval status
UPDATE gm_entries 
SET approval_status = 'pending_hod' 
WHERE approval_status IS NULL;
