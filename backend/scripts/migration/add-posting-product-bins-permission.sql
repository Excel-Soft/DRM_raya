-- DRM Setting -> Permission: add the new Posting Data sub pages
-- (Restricted Products, Trash Products) to the existing "Posting Data" menu row.
-- Same "Title → slug" format as the other items. Idempotent (skips items already present).
-- Rollback: rollback-posting-product-bins-permission.sql
UPDATE drm.menu_permissions mp
SET sub_urls = jsonb_set(
      mp.sub_urls, '{items}',
      COALESCE(mp.sub_urls->'items', '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
        FROM unnest(ARRAY['Restricted Products → restricted-products', 'Trash Products → trash-products']) v
        WHERE NOT (COALESCE(mp.sub_urls->'items', '[]'::jsonb) ? v)
      )),
    updated_at = now()
WHERE mp.name = 'Posting Data';
