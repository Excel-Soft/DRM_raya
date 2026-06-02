-- Add account_name column to customers table if it doesn't exist
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS account_name TEXT NOT NULL DEFAULT 'Default Account Name';

-- Update existing rows with a default value if needed
UPDATE customers 
SET account_name = company_name 
WHERE account_name = 'Default Account Name';
