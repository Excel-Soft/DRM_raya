-- Account -> Add Refund GM: old-DRM refunds (webxl_refund_gm, 25 rows) -> drm.refund_gm_entries.
-- Only the refunds still active in the old DRM are copied (delete_date empty and status not
-- 'deleted' = 12 rows). The new app deletes refunds outright (DELETE), so an old deleted refund
-- has no place in the table; those 13 rows stay in legacy_archive.webxl_refund_gm.
--   company_name = cname (or the mapped customer's name), person_name = webxl_user.name(user_id),
--   amount, amount_type 'Pkr' -> 'PKR', comment, status, created_by_user_id = add_by user,
--   created_at = create_at converted from UTC (old DRM) to the server zone (like app rows).
-- gm_entry_id stays NULL: old refunds were per company, not per GM entry, and old GM rows are
-- not marked is_refunded (that would change their GM workflow).
-- Idempotent (mapping rows). Rollback: rollback-migrate-legacy-refund-gm.sql
BEGIN;

CREATE TEMP TABLE _r ON COMMIT DROP AS
SELECT t.id AS legacy_id, gen_random_uuid()::text AS new_id,
       COALESCE(NULLIF(btrim(t.cname), ''), c.company_name, '-') AS company_name,
       COALESCE(NULLIF(btrim(u.name), ''), '-') AS person_name,
       COALESCE(NULLIF(regexp_replace(coalesce(t.amount, ''), '[^0-9.]', '', 'g'), '')::numeric, 0) AS amount,
       CASE WHEN upper(btrim(coalesce(t.amount_type, ''))) IN ('', 'PKR') THEN 'PKR' ELSE upper(btrim(t.amount_type)) END AS amount_type,
       NULLIF(btrim(t.comment), '') AS comment,
       COALESCE(NULLIF(lower(btrim(t.status)), ''), 'pending') AS status,
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = t.add_by::text
           AND EXISTS (SELECT 1 FROM drm.users x WHERE x.id = um.modern_id::uuid) LIMIT 1) AS added_by,
       CASE WHEN t.create_at ~ '^\d{4}-\d{2}-\d{2}' AND t.create_at NOT LIKE '0000%'
            THEN (t.create_at::timestamp AT TIME ZONE 'UTC') AT TIME ZONE current_setting('TimeZone') END AS created_at
FROM legacy_archive.webxl_refund_gm t
LEFT JOIN legacy_archive.webxl_user u ON u.user_id = t.user_id::text
LEFT JOIN migration_meta.migration_legacy_ids cm
       ON cm.entity_type = 'customer' AND cm.legacy_table = 'webxl_company' AND cm.legacy_id = t.com_id::text
LEFT JOIN drm.customers c ON c.id::text = cm.modern_id
WHERE NULLIF(btrim(coalesce(t.delete_date, '')), '') IS NULL
  AND lower(btrim(coalesce(t.status, ''))) <> 'deleted'
  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'refund_gm' AND m.legacy_table = 'webxl_refund_gm' AND m.legacy_id = t.id);

-- created_by_user_id is NOT NULL: fall back to the earliest admin when the old adder is unmapped.
INSERT INTO drm.refund_gm_entries (id, company_name, person_name, amount, amount_type, comment, status, created_by_user_id, created_at)
SELECT new_id, company_name, person_name, amount, amount_type, comment, status,
       COALESCE(added_by, (SELECT id FROM drm.users WHERE role_id ~ '(^|,)\s*1\s*(,|$)' OR role = 'admin' ORDER BY created_at LIMIT 1)),
       COALESCE(created_at, now())
FROM _r;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'refund_gm', 'webxl_refund_gm', legacy_id, new_id, 'refund_gm_entries' FROM _r;

COMMIT;
