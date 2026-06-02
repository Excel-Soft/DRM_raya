-- Add type column to targets table
ALTER TABLE targets 
ADD COLUMN type VARCHAR(3) NOT NULL DEFAULT 'AB';

-- Update the default value to be the first value of the enum
ALTER TABLE targets 
ALTER COLUMN type DROP DEFAULT;

-- Add constraint to ensure type is either 'AB' or 'VAS'
ALTER TABLE targets 
ADD CONSTRAINT check_target_type 
CHECK (type IN ('AB', 'VAS'));
