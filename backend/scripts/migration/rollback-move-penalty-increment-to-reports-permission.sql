-- Undo move-penalty-increment-to-reports-permission.sql
UPDATE drm.menu_permissions mp
SET sub_urls = jsonb_set(mp.sub_urls, '{items}', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM jsonb_array_elements_text(mp.sub_urls->'items') x
      WHERE x NOT IN ('Add Penalty → add-penalty', 'Increment → increment'))),
    updated_at = now()
WHERE mp.name = 'Reports';
