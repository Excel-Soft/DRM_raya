-- One-time ETL: old DRM day targets -> drm.target_system_daily_targets.
--   legacy_archive.webxl_day_target (36 rows)
-- role (legacy role id) -> role name via legacy_archive.webxl_role (e.g. 25 ->
-- "Sales Executive"), the same text form the new page and the consumers
-- (sales/service dashboards, performance evaluation) match on.
-- The legacy id is kept as the row id (legacy "#" column), then the serial
-- sequence is moved past it. Archive untouched; every row recorded in
-- migration_meta.migration_legacy_ids, so re-runs skip copied rows.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrate-legacy-day-targets.sql
BEGIN;

CREATE TEMP TABLE _dt_new ON COMMIT DROP AS
SELECT d.id AS legacy_id,
       CASE WHEN EXISTS (SELECT 1 FROM drm.target_system_daily_targets x WHERE x.id = d.id::int)
            THEN nextval(pg_get_serial_sequence('drm.target_system_daily_targets', 'id'))::int
            ELSE d.id::int END AS new_id,
       COALESCE(NULLIF(btrim(r.name), ''), d.role) AS role,
       btrim(d.method) AS method,
       CASE WHEN btrim(d.target) ~ '^[0-9]+$' THEN btrim(d.target)::int ELSE 0 END AS target,
       COALESCE(NULLIF(d.create_date, '')::timestamp, now()) AS created_at
FROM legacy_archive.webxl_day_target d
LEFT JOIN legacy_archive.webxl_role r ON r.id = d.role
WHERE d.id ~ '^[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids m
    JOIN drm.target_system_daily_targets t ON t.id::text = m.modern_id
    WHERE m.entity_type = 'target_system_daily_target' AND m.legacy_table = 'webxl_day_target'
      AND m.legacy_id = d.id
  );

INSERT INTO drm.target_system_daily_targets (id, role, method, target, created_at)
SELECT new_id, role, method, target, created_at FROM _dt_new ORDER BY new_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'target_system_daily_target', 'webxl_day_target', legacy_id, new_id::text, 'target_system_daily_targets'
FROM _dt_new;

-- Keep the serial ahead of the explicit ids so new rows never collide.
SELECT setval(pg_get_serial_sequence('drm.target_system_daily_targets', 'id'),
              GREATEST((SELECT COALESCE(max(id), 1) FROM drm.target_system_daily_targets),
                       (SELECT last_value FROM drm.target_system_daily_targets_id_seq)));

SELECT count(*) AS day_targets_copied FROM _dt_new;
COMMIT;
