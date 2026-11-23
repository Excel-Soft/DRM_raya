-- Staging: promote legacy webxl_servicepool → Service Pool (UI uses customers.pool_type + service_pool_entries)

INSERT INTO drm.service_pool_entries (
  customer_id, service_person_id, sales_person_id, status, started_at, updated_at, metadata
)
SELECT DISTINCT ON (ls.customer_id)
  ls.customer_id,
  ls.user_id,
  COALESCE(c.owner_user_id, c.created_by),
  'active'::drm.service_pool_status,
  COALESCE(
    NULLIF(trim(ls.payload->>'create_date'), '')::timestamptz,
    ls.created_at,
    now()
  ),
  now(),
  jsonb_build_object('source', 'legacy_servicepool', 'legacy_id', ls.id::text)
FROM drm.legacy_servicepool ls
JOIN drm.customers c ON c.id = ls.customer_id
WHERE ls.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM drm.service_pool_entries spe
    WHERE spe.customer_id = ls.customer_id AND spe.status = 'active'
  )
ORDER BY ls.customer_id, ls.created_at DESC;

UPDATE drm.customers c
   SET pool_type = 'Service',
       updated_at = now()
 WHERE EXISTS (SELECT 1 FROM drm.legacy_servicepool ls WHERE ls.customer_id = c.id)
   AND COALESCE(c.pool_type, 'Private') <> 'Service';

CREATE INDEX IF NOT EXISTS idx_customers_pool_type ON drm.customers (pool_type);
