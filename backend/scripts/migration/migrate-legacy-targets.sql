-- One-time ETL: old DRM target definitions -> drm.target_system_targets (Track A).
--   legacy_archive.webxl_terget (type = 'new', i.e. what legacy targetcreate.php
--   lists — 55 rows; the untyped older rows are not shown by legacy either)
--
-- Field mapping (legacy func.php "Create Target" insert):
--   terget_name -> target_name        target_number -> number
--   bonus 1/0   -> 'Percentage %' / 'Amount' (bonus TYPE)
--   conversion  -> conversion (int) and amount (text) — legacy form "Amount" field
--   price, max_amount -> price, max_price   pleanty -> penalty
--   reward, kwa, vas, package             create_data -> created_at
--
-- COPY, TRANSFORM & PRESERVE: archive untouched; every copied row recorded in
-- migration_meta.migration_legacy_ids, so re-runs skip already-copied rows.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrate-legacy-targets.sql

BEGIN;

CREATE TEMP TABLE _tg_new ON COMMIT DROP AS
SELECT lt.terget_id AS legacy_id, gen_random_uuid()::text AS new_id
FROM legacy_archive.webxl_terget lt
WHERE lt.type = 'new'
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids m
    JOIN drm.target_system_targets t ON t.id = m.modern_id
    WHERE m.legacy_table = 'webxl_terget' AND m.legacy_id = lt.terget_id
  );

INSERT INTO drm.target_system_targets
  (id, target_name, package, reward, bonus, price, max_price, penalty, amount,
   number, kwa, vas, conversion, category, created_at)
SELECT n.new_id,
       COALESCE(NULLIF(btrim(lt.terget_name), ''), 'Untitled target'),
       NULLIF(btrim(lt.package), ''),
       CASE WHEN btrim(lt.reward) ~ '^[0-9]+$' THEN btrim(lt.reward)::int ELSE 0 END,
       CASE WHEN btrim(lt.bonus) = '1' THEN 'Percentage %' ELSE 'Amount' END,
       CASE WHEN btrim(lt.price) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(lt.price)::numeric ELSE 0 END,
       CASE WHEN btrim(lt.max_amount) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(lt.max_amount)::numeric ELSE 0 END,
       CASE WHEN btrim(lt.pleanty) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(lt.pleanty)::numeric ELSE 0 END,
       NULLIF(btrim(lt.conversion), ''),
       CASE WHEN btrim(lt.target_number) ~ '^[0-9]+$' THEN btrim(lt.target_number)::int ELSE 0 END,
       CASE WHEN btrim(lt.kwa) ~ '^[0-9]+$' THEN btrim(lt.kwa)::int ELSE 0 END,
       CASE WHEN btrim(lt.vas) ~ '^[0-9]+$' THEN btrim(lt.vas)::int ELSE 0 END,
       CASE WHEN btrim(lt.conversion) ~ '^[0-9]+$' THEN btrim(lt.conversion)::int ELSE 0 END,
       NULL,
       lt.create_data::timestamp
FROM _tg_new n
JOIN legacy_archive.webxl_terget lt ON lt.terget_id = n.legacy_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'target_system_target', 'webxl_terget', legacy_id, new_id, 'target_system_targets' FROM _tg_new;

SELECT count(*) AS targets_copied FROM _tg_new;

COMMIT;
