-- Account -> Create GM: Sale Person, Added by and Alibaba Status for old-DRM GM entries
-- (webxl_verify_gm -> drm.gm_entries). The first migration left them empty ("—").
--   sales_person_name  = webxl_user.name of webxl_verify_gm.user_id
--   sales_person_id    = that user's modern id (migration_legacy_ids webxl_user)
--   added_by_name      = webxl_user.name of webxl_verify_gm.add_by
--   alibaba_status     = old 'alibaba' column: Yes / No; anything else (Pending, blank) -> 'Pending'
-- Only fills empty fields on migrated rows. Idempotent.
-- Rollback: rollback-fix-legacy-gm-names-alibaba.sql
BEGIN;
UPDATE drm.gm_entries g
SET sales_person_name = COALESCE(NULLIF(btrim(g.sales_person_name), ''), NULLIF(btrim(su.name), '')),
    added_by_name     = COALESCE(NULLIF(btrim(g.added_by_name), ''), NULLIF(btrim(au.name), '')),
    sales_person_id   = COALESCE(g.sales_person_id,
                          (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
                            WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user'
                              AND um.legacy_id = l.user_id LIMIT 1)),
    alibaba_status    = COALESCE(NULLIF(btrim(g.alibaba_status), ''),
                          CASE lower(btrim(coalesce(l.alibaba, '')))
                            WHEN 'yes' THEN 'Yes' WHEN 'no' THEN 'No' ELSE 'Pending' END),
    updated_at = now()
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_verify_gm l ON l.id = m.legacy_id
LEFT JOIN legacy_archive.webxl_user su ON su.user_id = l.user_id
LEFT JOIN legacy_archive.webxl_user au ON au.user_id = l.add_by::text
WHERE m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm'
  AND m.modern_id = g.id::text
  AND (NULLIF(btrim(g.sales_person_name), '') IS NULL
       OR NULLIF(btrim(g.added_by_name), '') IS NULL
       OR NULLIF(btrim(g.alibaba_status), '') IS NULL);
COMMIT;
