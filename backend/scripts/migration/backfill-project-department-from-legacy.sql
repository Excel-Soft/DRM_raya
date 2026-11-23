-- Backfill / reconcile drm.projects.department_type from old DRM
-- webxl_create_project.project -> webxl_quotation_services.dep_id
-- Safe to re-run (updates only when value differs).

UPDATE drm.projects p
SET department_type = sub.dept,
    service_type = coalesce(nullif(trim(p.service_type), ''), sub.service_name),
    updated_at = now()
FROM (
  SELECT p.id,
    trim(cp.project) AS service_name,
    CASE trim(qs.dep_id)
      WHEN '2' THEN 'SALES'
      WHEN '8' THEN 'SEO_SMM'
      WHEN '9' THEN 'PRODUCT_POSTING'
      WHEN '10' THEN 'DND'
      WHEN '13' THEN 'IT'
      WHEN '24' THEN 'MEDIA'
      WHEN '27' THEN 'SOFTWARE'
      WHEN '5' THEN 'SERVICE'
      ELSE 'LEGACY_DEP_' || trim(qs.dep_id)
    END AS dept
  FROM drm.projects p
  JOIN migration_meta.migration_legacy_ids m
    ON m.modern_id = p.id::text
   AND m.modern_table = 'projects'
   AND m.legacy_table = 'webxl_create_project'
  JOIN legacy_archive.webxl_create_project cp
    ON trim(cp.pro_id) = trim(m.legacy_id)
   AND cp._source_table = 'webxl_create_project'
  JOIN legacy_archive.webxl_quotation_services qs
    ON lower(regexp_replace(trim(qs.name), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(cp.project), '\s+', ' ', 'g'))
  WHERE trim(qs.dep_id) IS NOT NULL
    AND trim(qs.dep_id) <> ''
    AND trim(qs.dep_id) <> '0'
) sub
WHERE p.id = sub.id
  AND coalesce(p.department_type, '') IS DISTINCT FROM sub.dept;