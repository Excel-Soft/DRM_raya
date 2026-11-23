-- Undo add-posting-product-bins-permission.sql
UPDATE drm.menu_permissions mp
SET sub_urls = jsonb_set(mp.sub_urls, '{items}', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM jsonb_array_elements_text(mp.sub_urls->'items') x
      WHERE x NOT IN ('Restricted Products → restricted-products', 'Trash Products → trash-products'))),
    updated_at = now()
WHERE mp.name = 'Posting Data';
