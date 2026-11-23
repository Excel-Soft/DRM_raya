-- One-time ETL: old DRM target assignments -> drm.target_system_user_targets.
--   legacy_archive.webxl_setterget (+ webxl_terget for the definition values)
--
-- Scope = exactly what legacy target-set lists: assignments still running
-- (end_date >= today) whose target is type 'new' (1,162 rows on 2026-11-16).
-- Older history stays in legacy_archive (not shown by legacy either; copying
-- it would also feed past-month commission checks that read this table).
--
-- Mapping (legacy func.php user-target list):
--   user_id     -> drm.users id via migration_legacy_ids (unmapped users skipped)
--   terget_cat  -> 1 AB New Terget, 2 Renewal Terget, 3 VAS, 4 Other, 5 Team,
--                  6 Project Target, 7 PP Link, else Other
--   target_num  -> target            terget_name -> target_name
--   price, max_amount, conversion, vas, kwa, reward from webxl_terget
--   bonus 1/0   -> 'Percentage %' / 'Amount'
--   total       =  conversion + vas + kwa + reward (legacy formula)
--   start_date, end_date, singDate -> start_date, end_date, sign_date (+created_at)
--
-- Archive untouched; each row recorded in migration_meta.migration_legacy_ids
-- (entity 'target_system_user_target'), so re-runs skip copied rows.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrate-legacy-user-targets.sql

BEGIN;

CREATE TEMP TABLE _ut_src ON COMMIT DROP AS
SELECT s.id AS legacy_id, m.modern_id AS user_id, s.terget_cat, s.target_num,
       s.start_date, s.end_date, s."singDate" AS sign_date,
       t.terget_name, t.bonus, t.price, t.max_amount, t.conversion, t.vas, t.kwa, t.reward
FROM legacy_archive.webxl_setterget s
JOIN legacy_archive.webxl_terget t ON t.terget_id = s.terget_id AND t.type = 'new'
JOIN migration_meta.migration_legacy_ids m
  ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = s.user_id
JOIN drm.users u ON u.id::text = m.modern_id
WHERE s.end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND s.end_date >= to_char(CURRENT_DATE, 'YYYY-MM-DD')
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids x
    JOIN drm.target_system_user_targets ut ON ut.id::text = x.modern_id
    WHERE x.entity_type = 'target_system_user_target' AND x.legacy_table = 'webxl_setterget'
      AND x.legacy_id = s.id
  );

CREATE TEMP TABLE _ut_num ON COMMIT DROP AS
SELECT legacy_id, user_id, terget_cat, target_num, start_date, end_date, sign_date, terget_name, bonus,
       CASE WHEN btrim(price) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(price)::numeric ELSE 0 END AS price,
       CASE WHEN btrim(max_amount) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(max_amount)::numeric ELSE 0 END AS max_price,
       CASE WHEN btrim(conversion) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(conversion)::numeric ELSE 0 END AS conversion,
       CASE WHEN btrim(vas) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(vas)::numeric ELSE 0 END AS vas,
       CASE WHEN btrim(kwa) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(kwa)::numeric ELSE 0 END AS kwa,
       CASE WHEN btrim(reward) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(reward)::numeric ELSE 0 END AS reward
FROM _ut_src;

-- Pre-allocate serial ids from the table's own sequence, in legacy id order,
-- so the legacy -> new id mapping is exact and ordering follows legacy.
CREATE TEMP TABLE _ut_ins ON COMMIT DROP AS
SELECT legacy_id,
       nextval(pg_get_serial_sequence('drm.target_system_user_targets', 'id'))::int AS new_id
FROM (SELECT legacy_id FROM _ut_num ORDER BY legacy_id::int) o;

INSERT INTO drm.target_system_user_targets
  (id, user_id, target_name, category, target, price, max_price, bonus, vas, kwa, reward,
   conversion, total, start_date, end_date, sign_date, created_at)
SELECT i.new_id,
       n.user_id,
       COALESCE(NULLIF(btrim(n.terget_name), ''), 'Untitled target'),
       CASE n.terget_cat WHEN '1' THEN 'AB New Terget' WHEN '2' THEN 'Renewal Terget' WHEN '3' THEN 'VAS'
                         WHEN '4' THEN 'Other' WHEN '5' THEN 'Team' WHEN '6' THEN 'Project Target'
                         WHEN '7' THEN 'PP Link' ELSE 'Other' END,
       COALESCE(NULLIF(btrim(n.target_num), ''), '0'),
       n.price, n.max_price,
       CASE WHEN btrim(n.bonus) = '1' THEN 'Percentage %' ELSE 'Amount' END,
       n.vas, n.kwa, n.reward, n.conversion,
       n.conversion + n.vas + n.kwa + n.reward,
       NULLIF(n.start_date, '0000-00-00')::timestamp,
       n.end_date::timestamp,
       NULLIF(n.sign_date, '')::timestamp,
       COALESCE(NULLIF(n.sign_date, '')::timestamp, now())
FROM _ut_num n
JOIN _ut_ins i ON i.legacy_id = n.legacy_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'target_system_user_target', 'webxl_setterget', legacy_id, new_id::text, 'target_system_user_targets'
FROM _ut_ins;

SELECT (SELECT count(*) FROM _ut_num) AS source_rows, (SELECT count(*) FROM _ut_ins) AS copied_and_mapped;

COMMIT;
