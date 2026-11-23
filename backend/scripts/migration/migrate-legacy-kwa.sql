-- One-time ETL: old DRM KWA ledger -> new Target System KWA tables.
--   legacy_archive.webxl_kwa         -> drm.target_system_kwa_records (320)
--   legacy_archive.webxl_kwa_history -> drm.target_system_kwa_history (443)
-- Legacy ids are kept as row ids (history.kwa_id -> kwa_record_id stays valid),
-- then both serial sequences are moved past them.
--   com_id   -> com_id (legacy numeric company id, as the old page shows) and
--               customer_id via migration_legacy_ids (webxl_company -> customers)
--   company  -> webxl_company.cname       user_id -> employee (webxl_user.name)
--   remaning -> remaining                 history type Sell/Used -> action_type
-- Archive untouched; each row recorded in migration_meta.migration_legacy_ids,
-- so re-runs skip copied rows.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrate-legacy-kwa.sql
BEGIN;

-- ---- Records ----------------------------------------------------------------
CREATE TEMP TABLE _kr_new ON COMMIT DROP AS
SELECT k.id AS legacy_id,
       CASE WHEN EXISTS (SELECT 1 FROM drm.target_system_kwa_records x WHERE x.id = k.id::int)
            THEN nextval(pg_get_serial_sequence('drm.target_system_kwa_records', 'id'))::int
            ELSE k.id::int END AS new_id
FROM legacy_archive.webxl_kwa k
WHERE k.id ~ '^[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids m
    JOIN drm.target_system_kwa_records r ON r.id::text = m.modern_id
    WHERE m.entity_type = 'target_system_kwa_record' AND m.legacy_table = 'webxl_kwa' AND m.legacy_id = k.id
  );

INSERT INTO drm.target_system_kwa_records
  (id, company, employee, kwa, detail, remaining, type, created_at, reward, status, com_id, customer_id)
SELECT n.new_id,
       COALESCE(NULLIF(btrim(lc.cname), ''), c.company_name, 'Company #' || k.com_id),
       COALESCE(NULLIF(btrim(u.name), ''), 'User #' || k.user_id),
       CASE WHEN btrim(k.kwa) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(k.kwa)::numeric ELSE 0 END,
       NULLIF(btrim(k.detail, E' \t\r\n'), ''),
       CASE WHEN btrim(k.remaning) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(k.remaning)::numeric ELSE 0 END,
       COALESCE(NULLIF(btrim(k.type), ''), 'Kwa'),
       COALESCE(NULLIF(k.create_at, '')::timestamp, now()),
       0, 'Sell',
       NULLIF(btrim(k.com_id), ''),
       c.id
FROM _kr_new n
JOIN legacy_archive.webxl_kwa k ON k.id = n.legacy_id
LEFT JOIN legacy_archive.webxl_company lc ON lc.id = k.com_id
LEFT JOIN migration_meta.migration_legacy_ids mc
  ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = k.com_id
LEFT JOIN drm.customers c ON c.id::text = mc.modern_id
LEFT JOIN legacy_archive.webxl_user u ON u.user_id = k.user_id
ORDER BY n.new_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'target_system_kwa_record', 'webxl_kwa', legacy_id, new_id::text, 'target_system_kwa_records' FROM _kr_new;

-- Legacy kwa id -> new record id (this run + earlier runs)
CREATE TEMP TABLE _kr_map ON COMMIT DROP AS
SELECT m.legacy_id, m.modern_id::int AS record_id
FROM migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'target_system_kwa_record' AND m.legacy_table = 'webxl_kwa';

-- ---- History ----------------------------------------------------------------
CREATE TEMP TABLE _kh_new ON COMMIT DROP AS
SELECT h.id AS legacy_id,
       CASE WHEN EXISTS (SELECT 1 FROM drm.target_system_kwa_history x WHERE x.id = h.id::int)
            THEN nextval(pg_get_serial_sequence('drm.target_system_kwa_history', 'id'))::int
            ELSE h.id::int END AS new_id
FROM legacy_archive.webxl_kwa_history h
WHERE h.id ~ '^[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids m
    JOIN drm.target_system_kwa_history r ON r.id::text = m.modern_id
    WHERE m.entity_type = 'target_system_kwa_history' AND m.legacy_table = 'webxl_kwa_history' AND m.legacy_id = h.id
  );

-- kwa_record_id: the copied record; if the legacy record no longer exists
-- (1 orphan "Used" row) the legacy kwa_id is kept as-is (no FK on this column).
INSERT INTO drm.target_system_kwa_history
  (id, kwa_record_id, company, employee, amount, action_type, detail, pay_date, created_at)
SELECT n.new_id,
       COALESCE(km.record_id, CASE WHEN h.kwa_id ~ '^[0-9]+$' THEN h.kwa_id::int ELSE 0 END),
       COALESCE(NULLIF(btrim(lc.cname), ''), 'Company #' || h.com_id),
       COALESCE(NULLIF(btrim(u.name), ''), 'User #' || h.user_id),
       CASE WHEN btrim(h.pay) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(h.pay)::numeric ELSE 0 END,
       COALESCE(NULLIF(btrim(h.type), ''), 'Sell'),
       NULLIF(btrim(h.kwa_detail_pay, E' \t\r\n'), ''),
       COALESCE(NULLIF(h.pay_date, '')::timestamp, now()),
       COALESCE(NULLIF(h.pay_date, '')::timestamp, now())
FROM _kh_new n
JOIN legacy_archive.webxl_kwa_history h ON h.id = n.legacy_id
LEFT JOIN _kr_map km ON km.legacy_id = h.kwa_id
LEFT JOIN legacy_archive.webxl_company lc ON lc.id = h.com_id
LEFT JOIN legacy_archive.webxl_user u ON u.user_id = h.user_id
ORDER BY n.new_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'target_system_kwa_history', 'webxl_kwa_history', legacy_id, new_id::text, 'target_system_kwa_history' FROM _kh_new;

-- Keep both serials ahead of the explicit ids so new rows never collide.
SELECT setval(pg_get_serial_sequence('drm.target_system_kwa_records', 'id'),
              GREATEST((SELECT COALESCE(max(id), 1) FROM drm.target_system_kwa_records),
                       (SELECT last_value FROM drm.target_system_kwa_records_id_seq)));
SELECT setval(pg_get_serial_sequence('drm.target_system_kwa_history', 'id'),
              GREATEST((SELECT COALESCE(max(id), 1) FROM drm.target_system_kwa_history),
                       (SELECT last_value FROM drm.target_system_kwa_history_id_seq)));

SELECT (SELECT count(*) FROM _kr_new) AS records_copied, (SELECT count(*) FROM _kh_new) AS history_copied;
COMMIT;
