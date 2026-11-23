-- Account -> Add Temp GM: schema repair + old-DRM data.
-- 1) drm.temp_gm_entries was created without the columns the app uses:
--      is_deleted (GET list / delete / reports filter on it -> every list call 500'd),
--      created_by (POST inserts it), and the ensure.ts additive columns
--      hod_approved_at, updated_at, delete_reason, deleted_at, deleted_by, hod_reject_reason
--    (server runs with SKIP_SCHEMA_ENSURE). created_by_user_id was NOT NULL while the
--    insert only sets created_by, so it is relaxed (code reads COALESCE of both).
-- 2) Copy the 209 rows of legacy webxl_tem_gm:
--      company_name = cname, person_name = webxl_user.name(user_id), amount,
--      amount_type 'Pkr' -> 'PKR', reason = reasion, comment, status as in old DRM
--      (pending / clear / deleted), created_by(_user_id) = add_by user, created_at = create_at.
--      Old 'deleted' rows -> is_deleted = true, deleted_at = delete_date (hidden like before).
-- Idempotent (mapping rows). Rollback: rollback-migrate-legacy-temp-gm.sql
BEGIN;

ALTER TABLE drm.temp_gm_entries
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS hod_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS delete_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS hod_reject_reason text;
ALTER TABLE drm.temp_gm_entries ALTER COLUMN created_by_user_id DROP NOT NULL;

CREATE TEMP TABLE _t ON COMMIT DROP AS
SELECT t.id AS legacy_id, gen_random_uuid()::text AS new_id,
       COALESCE(NULLIF(btrim(t.cname), ''), c.company_name, '-') AS company_name,
       COALESCE(NULLIF(btrim(u.name), ''), '-') AS person_name,
       COALESCE(NULLIF(regexp_replace(coalesce(t.amount, ''), '[^0-9.]', '', 'g'), '')::numeric, 0) AS amount,
       CASE WHEN upper(btrim(coalesce(t.amount_type, ''))) IN ('', 'PKR') THEN 'PKR' ELSE upper(btrim(t.amount_type)) END AS amount_type,
       COALESCE(NULLIF(btrim(t.reasion), ''), '-') AS reason,
       NULLIF(btrim(t.comment), '') AS comment,
       COALESCE(NULLIF(lower(btrim(t.status)), ''), 'pending') AS status,
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = t.add_by::text
           AND EXISTS (SELECT 1 FROM drm.users x WHERE x.id = um.modern_id::uuid) LIMIT 1) AS added_by,
       CASE WHEN t.create_at ~ '^\d{4}-\d{2}-\d{2}' AND t.create_at NOT LIKE '0000%' THEN t.create_at::timestamp END AS created_at,
       CASE WHEN t.delete_date ~ '^\d{4}-\d{2}-\d{2}' AND t.delete_date NOT LIKE '0000%' THEN t.delete_date::timestamp END AS deleted_at
FROM legacy_archive.webxl_tem_gm t
LEFT JOIN legacy_archive.webxl_user u ON u.user_id = t.user_id::text
LEFT JOIN migration_meta.migration_legacy_ids cm
       ON cm.entity_type = 'customer' AND cm.legacy_table = 'webxl_company' AND cm.legacy_id = t.com_id::text
LEFT JOIN drm.customers c ON c.id::text = cm.modern_id
WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'temp_gm' AND m.legacy_table = 'webxl_tem_gm' AND m.legacy_id = t.id);

INSERT INTO drm.temp_gm_entries
  (id, company_name, person_name, amount, amount_type, reason, comment, status,
   created_by_user_id, created_by, created_at, updated_at, is_deleted, deleted_at, delete_reason)
SELECT new_id, company_name, person_name, amount, amount_type, reason, comment, status,
       added_by, added_by, COALESCE(created_at, now()), COALESCE(deleted_at, created_at, now()),
       status = 'deleted', CASE WHEN status = 'deleted' THEN deleted_at END,
       CASE WHEN status = 'deleted' THEN 'Deleted in old DRM' END
FROM _t;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'temp_gm', 'webxl_tem_gm', legacy_id, new_id, 'temp_gm_entries' FROM _t;

COMMIT;

-- Old DRM stored create_at in UTC (its page showed it +5h, PKT). created_at here is a
-- naive timestamp in the server zone, like rows the app inserts with now(); convert
-- the copied rows once so they show the same time as the old page.
-- (Guarded: only rows whose created_at still equals the raw legacy value.)
BEGIN;
UPDATE drm.temp_gm_entries t
SET created_at = (l.create_at::timestamp AT TIME ZONE 'UTC') AT TIME ZONE current_setting('TimeZone')
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_tem_gm l ON l.id = m.legacy_id
WHERE m.entity_type = 'temp_gm' AND m.legacy_table = 'webxl_tem_gm' AND m.modern_id = t.id
  AND l.create_at ~ '^\d{4}-\d{2}-\d{2}' AND t.created_at = l.create_at::timestamp;
COMMIT;
