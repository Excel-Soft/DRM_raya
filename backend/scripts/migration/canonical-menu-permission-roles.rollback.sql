-- Rollback: put the label back on the Attendance menu (only row that had it).
UPDATE drm.menu_permissions SET allowed_role_ids = array_append(array_remove(allowed_role_ids, 'sales_executive'), 'Sales Executive [L25]')
 WHERE name = 'Attendance' AND 'sales_executive' = ANY(allowed_role_ids);
