-- Restore old-DRM Private Pool ownership for ACTIVE users.
-- Old DRM: Private Pool = webxl_company rows with assignId = user (func.php allUserCustomerPrivatePool).
-- The migration put most of them into the Public pool with no owner. For companies whose old
-- assignee is an active user (old roleId does not contain 54 = Deactive) and which are still
-- Public with no owner here, set pool_type = 'Private' and owner_user_id = that user's new id.
-- Companies of deactivated users stay Public. legacy_archive is not modified.
-- Previous values are kept in migration_meta.customers_private_restore_backup.
-- Built in small materialised steps (a single big join picked a very slow plan).
-- Rollback: restore-private-pool-assignments.rollback.sql
BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE TABLE IF NOT EXISTS migration_meta.customers_private_restore_backup (
  id            text PRIMARY KEY,
  pool_type     text,
  owner_user_id uuid,
  updated_at    timestamp,
  backed_up_at  timestamptz NOT NULL DEFAULT now()
);

-- 1) new customer id -> old company id
CREATE TEMP TABLE _cmap ON COMMIT DROP AS
SELECT modern_id AS customer_id, legacy_id AS company_pk
  FROM migration_meta.migration_legacy_ids
 WHERE modern_table = 'customers' AND legacy_table = 'webxl_company';

-- 2) old company id -> old assignee, only ACTIVE assignees, with their new user id
CREATE TEMP TABLE _cowner ON COMMIT DROP AS
SELECT c._legacy_pk AS company_pk, mu.modern_id::uuid AS owner_id
  FROM legacy_archive.webxl_company c
  JOIN legacy_archive.webxl_user u
    ON u._source_table = 'webxl_user' AND u._legacy_pk = btrim(c."assignId")
  JOIN migration_meta.migration_legacy_ids mu
    ON mu.modern_table = 'users' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = u._legacy_pk
 WHERE c._source_table = 'webxl_company'
   AND coalesce(u."roleId", '') !~ '(^|,)54(,|$)'
   AND EXISTS (SELECT 1 FROM drm.users du WHERE du.id::text = mu.modern_id);

ANALYZE _cmap;
ANALYZE _cowner;

-- 3) customers still Public without owner
CREATE TEMP TABLE _restore ON COMMIT DROP AS
SELECT DISTINCT ON (x.id) x.id, o.owner_id
  FROM _cmap m
  JOIN _cowner o ON o.company_pk = m.company_pk
  JOIN drm.customers x ON x.id::text = m.customer_id
 WHERE coalesce(x.is_deleted, false) = false
   AND x.pool_type = 'Public'
   AND x.owner_user_id IS NULL
 ORDER BY x.id;

INSERT INTO migration_meta.customers_private_restore_backup (id, pool_type, owner_user_id, updated_at)
SELECT x.id::text, x.pool_type::text, x.owner_user_id, x.updated_at
  FROM drm.customers x JOIN _restore r ON r.id = x.id
ON CONFLICT (id) DO NOTHING;

UPDATE drm.customers x
   SET pool_type = 'Private', owner_user_id = r.owner_id, updated_at = now()
  FROM _restore r
 WHERE x.id = r.id;

SELECT count(*) AS moved_to_private, count(DISTINCT owner_id) AS users FROM _restore;
COMMIT;
