-- Migration: Set all existing customers to Private Pool
-- Run this ONCE to fix existing data

BEGIN;

-- Update all customers to Private pool (except GMBV)
UPDATE customers
SET 
  pool_type = 'Private',
  owner_user_id = COALESCE(owner_user_id, created_by, (SELECT id FROM users LIMIT 1)),
  updated_at = NOW()
WHERE coalesce(is_deleted, false) = false
  AND (pool_type IS NULL OR pool_type NOT IN ('GMBV'));

-- Verify the update
SELECT 
  'Migration Complete' as status,
  COUNT(*) FILTER (WHERE pool_type = 'Private') as private_count,
  COUNT(*) FILTER (WHERE pool_type = 'GMBV') as gmbv_count,
  COUNT(*) FILTER (WHERE pool_type IS NULL) as null_count,
  COUNT(*) as total_count
FROM customers
WHERE coalesce(is_deleted, false) = false;

COMMIT;
