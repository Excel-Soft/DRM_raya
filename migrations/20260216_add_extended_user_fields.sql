-- Migration: Add extended user fields
-- Date: 2026-02-16
-- Description: Add new fields for comprehensive user account management

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS father_husband_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS attendance_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS guardian_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS passport_cnic VARCHAR(100),
ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS join_date DATE,
ADD COLUMN IF NOT EXISTS role_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS under_works VARCHAR(100),
ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS daily_allowance DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS mobile_allowance DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS admin_allowance DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS conveyance_allowance DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS relaxation_minutes INTEGER,
ADD COLUMN IF NOT EXISTS increment VARCHAR(50),
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS picture_url VARCHAR(500);

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_users_attendance_id ON users(attendance_id);
CREATE INDEX IF NOT EXISTS idx_users_join_date ON users(join_date);
CREATE INDEX IF NOT EXISTS idx_users_role_type ON users(role_type);
CREATE INDEX IF NOT EXISTS idx_users_under_works ON users(under_works);

-- Add comments for documentation
COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.father_husband_name IS 'Father or husband name';
COMMENT ON COLUMN users.attendance_id IS 'Attendance system ID';
COMMENT ON COLUMN users.guardian_mobile IS 'Guardian contact number';
COMMENT ON COLUMN users.passport_cnic IS 'Passport or CNIC number';
COMMENT ON COLUMN users.facebook_id IS 'Facebook profile ID';
COMMENT ON COLUMN users.date_of_birth IS 'Date of birth';
COMMENT ON COLUMN users.join_date IS 'Date of joining';
COMMENT ON COLUMN users.role_type IS 'User role type';
COMMENT ON COLUMN users.under_works IS 'Reporting hierarchy';
COMMENT ON COLUMN users.basic_salary IS 'Basic salary amount';
COMMENT ON COLUMN users.daily_allowance IS 'Daily allowance amount';
COMMENT ON COLUMN users.mobile_allowance IS 'Mobile allowance amount';
COMMENT ON COLUMN users.admin_allowance IS 'Admin allowance amount';
COMMENT ON COLUMN users.conveyance_allowance IS 'Conveyance allowance amount';
COMMENT ON COLUMN users.relaxation_minutes IS 'Relaxation time in minutes';
COMMENT ON COLUMN users.increment IS 'Salary increment percentage';
COMMENT ON COLUMN users.gender IS 'User gender';
COMMENT ON COLUMN users.address IS 'User address';
COMMENT ON COLUMN users.picture_url IS 'Profile picture URL';
