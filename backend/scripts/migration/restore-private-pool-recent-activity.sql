-- Re-apply the old-DRM Private Pool restore (restore-private-pool-assignments.sql) after the
-- Public-pool sweep (sales-routes.ts syncPublicPool) moved those customers back to Public:
-- the sweep only counted drm.lead_activities, where old DRM follow-ups never were. The sweep
-- now also counts follow-ups and customers.last_followup_date (decision 2026-11-23), so only
-- customers with activity in the last 90 days are restored here — the rest would be swept again.
-- Same scope as the first restore: old assignee is an active user, customer still Public with
-- no owner. Previous values stay in migration_meta.customers_private_restore_backup.
-- Rollback: restore-private-pool-assignments.rollback.sql (puts every restored customer back).
BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE TEMP TABLE _cmap ON COMMIT DROP AS
SELECT modern_id AS customer_id, legacy_id AS company_pk
  FROM migration_meta.migration_legacy_ids
 WHERE modern_table = 'customers' AND legacy_table = 'webxl_company';

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

CREATE TEMP TABLE _restore ON COMMIT DROP AS
SELECT DISTINCT ON (x.id) x.id, o.owner_id
  FROM _cmap m
  JOIN _cowner o ON o.company_pk = m.company_pk
  JOIN drm.customers x ON x.id::text = m.customer_id
 WHERE coalesce(x.is_deleted, false) = false
   AND x.pool_type = 'Public'
   AND x.owner_user_id IS NULL
   AND (
     x.created_at >= now() - interval '90 days'
     OR coalesce(x.last_followup_date, '-infinity'::timestamp) >= now() - interval '90 days'
     OR EXISTS (SELECT 1 FROM drm.lead_activities ca
                 WHERE ca.customer_id = x.id AND ca.created_at >= now() - interval '90 days')
     OR EXISTS (SELECT 1 FROM drm.follow_ups f
                 WHERE f.customer_id = x.id AND coalesce(f.is_deleted, false) = false
                   AND f.created_at >= now() - interval '90 days')
   )
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
