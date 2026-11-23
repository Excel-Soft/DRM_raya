-- Merge legacy "Posting Executive" (L37 / posting_executive) into product_posting_executive.

UPDATE drm.roles
   SET name = 'Product Posting Executive [L37]',
       description = 'dept=Product Posting',
       updated_at = now()
 WHERE name ILIKE 'Posting Executive%';

UPDATE drm.users
   SET role_id = 'product_posting_executive',
       role = 'product_posting_executive',
       updated_at = now()
 WHERE trim(coalesce(role_id, '')) IN ('37', 'posting_executive')
    OR lower(trim(coalesce(role, ''))) = 'posting_executive';

UPDATE drm.users u
   SET roles = sub.roles,
       updated_at = now()
  FROM (
    SELECT id,
      coalesce(
        array_agg(DISTINCT nr) FILTER (WHERE nr IS NOT NULL AND nr <> ''),
        ARRAY[]::text[]
      ) AS roles
      FROM (
        SELECT u2.id,
          CASE
            WHEN lower(trim(r)) IN ('posting_executive', '37') THEN 'product_posting_executive'
            ELSE trim(r)
          END AS nr
          FROM drm.users u2
          LEFT JOIN unnest(coalesce(u2.roles, ARRAY[]::text[])) AS r ON true
      ) x
      GROUP BY id
  ) sub
 WHERE u.id = sub.id
   AND (
     trim(coalesce(u.role_id, '')) IN ('37', 'posting_executive', 'product_posting_executive')
     OR 'posting_executive' = ANY(coalesce(u.roles, ARRAY[]::text[]))
     OR '37' = ANY(coalesce(u.roles, ARRAY[]::text[]))
   )
   AND u.roles IS DISTINCT FROM sub.roles;

UPDATE drm.menu_permissions
   SET allowed_role_ids = (
     SELECT coalesce(array_agg(DISTINCT r), ARRAY[]::text[])
       FROM (
         SELECT CASE
           WHEN lower(trim(x)) IN ('posting_executive', '37') THEN 'product_posting_executive'
           ELSE trim(x)
         END AS r
           FROM unnest(coalesce(allowed_role_ids, ARRAY[]::text[])) x
       ) t
       WHERE r IS NOT NULL AND r <> ''
   ),
   updated_at = now()
 WHERE allowed_role_ids::text ILIKE '%posting_executive%'
    OR allowed_role_ids::text ILIKE '%37%';