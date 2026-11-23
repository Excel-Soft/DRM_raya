-- Rollback for restore-private-pool-assignments.sql: put the moved customers back to their
-- previous pool/owner (only rows still owned by the restored owner and still Private,
-- so customers a user has since released/transferred are left alone).
BEGIN;
UPDATE drm.customers x
   SET pool_type = b.pool_type::drm.pool_type, owner_user_id = b.owner_user_id, updated_at = now()
  FROM migration_meta.customers_private_restore_backup b
 WHERE x.id::text = b.id
   AND x.pool_type = 'Private';
DROP TABLE migration_meta.customers_private_restore_backup;
COMMIT;
