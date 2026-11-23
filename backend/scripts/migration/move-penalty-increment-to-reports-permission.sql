-- Sidebar: "Add Penalty" and "Increment" moved from top-level menus into Reports.
-- DRM Setting -> Permission: list them under the "Reports" menu row too
-- ("Title → slug", same format as the other items). Their own permKeys
-- ("Add Penalty", "Increment") still decide who sees them, so access is unchanged.
-- Idempotent. Rollback: rollback-move-penalty-increment-to-reports-permission.sql
UPDATE drm.menu_permissions mp
SET sub_urls = jsonb_set(
      mp.sub_urls, '{items}',
      COALESCE(mp.sub_urls->'items', '[]'::jsonb) || (
        SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
        FROM unnest(ARRAY['Add Penalty → add-penalty', 'Increment → increment']) v
        WHERE NOT (COALESCE(mp.sub_urls->'items', '[]'::jsonb) ? v)
      )),
    updated_at = now()
WHERE mp.name = 'Reports';
