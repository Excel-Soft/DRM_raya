-- Menu permissions saved with old-DRM role labels ("Sales Executive [L25]") never matched the
-- user role keys the sidebar uses. Replace label 'Sales Executive [L25]' with 'sales_executive'
-- (the only label stored today). The API now converts labels to keys on save and read.
-- Rollback: canonical-menu-permission-roles.rollback.sql
UPDATE drm.menu_permissions
   SET allowed_role_ids = (SELECT array_agg(DISTINCT CASE WHEN r = 'Sales Executive [L25]' THEN 'sales_executive' ELSE r END) FROM unnest(allowed_role_ids) r),
       updated_at = now()
 WHERE 'Sales Executive [L25]' = ANY(allowed_role_ids);
