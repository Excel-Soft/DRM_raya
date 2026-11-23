-- One-time ETL: old DRM Events module -> modern drm.* tables (Track A).
--   legacy_archive.webxl_event         -> drm.events
--   legacy_archive.webxl_event_speaker -> drm.event_speakers
--   legacy_archive.webxl_event_menu    -> drm.event_menu_items
--   legacy_archive.webxl_event_duty    -> drm.event_duties
--
-- COPY, TRANSFORM & PRESERVE: archive rows are never modified. Every copied row
-- is recorded in migration_meta.migration_legacy_ids, so the script is
-- idempotent (re-runs skip mapped rows) and the legacy read adapters in
-- events-routes.ts stop showing a row once it has been copied.
-- Users resolve via migration_legacy_ids (entity_type 'user', webxl_user).
-- Menu items whose legacy event is 0/missing cannot satisfy event_id NOT NULL;
-- they are skipped and stay visible read-only through the legacy adapter.
--
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrate-legacy-events.sql

BEGIN;

-- Legacy user id -> drm.users id
CREATE TEMP TABLE _user_map ON COMMIT DROP AS
SELECT m.legacy_id, u.id AS user_id
FROM migration_meta.migration_legacy_ids m
JOIN drm.users u ON u.id::text = m.modern_id
WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user';

-- ---- Events -----------------------------------------------------------------
CREATE TEMP TABLE _ev_new ON COMMIT DROP AS
SELECT le.id AS legacy_id, gen_random_uuid() AS new_id
FROM legacy_archive.webxl_event le
WHERE le.event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND le.event_date NOT LIKE '0000%'
  AND NOT EXISTS (
    SELECT 1 FROM migration_meta.migration_legacy_ids m
    JOIN drm.events e ON e.id::text = m.modern_id
    WHERE m.legacy_table = 'webxl_event' AND m.legacy_id = le.id
  );

INSERT INTO drm.events
  (id, name, event_type, event_date, start_time, end_time, venue, amount,
   attendee_count, map_url, status, notes, created_by, created_at, updated_at)
SELECT n.new_id,
       COALESCE(NULLIF(btrim(le.name), ''), 'Untitled event'),
       COALESCE(att.name, le.event_type),
       le.event_date::date,
       NULLIF(left(le.start_time, 5), ''),
       NULLIF(left(le.end_time, 5), ''),
       NULLIF(btrim(le.venu, E' \t\r\n'), ''),
       CASE WHEN btrim(le.amount) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(le.amount)::numeric ELSE 0 END,
       CASE WHEN btrim(le.attending) ~ '^[0-9]+$' THEN btrim(le.attending)::int ELSE 0 END,
       CASE WHEN btrim(le.map) ~* '^https?://' THEN btrim(le.map) ELSE NULL END,
       CASE WHEN le.event_date::date < CURRENT_DATE THEN 'Completed' ELSE 'Draft' END,
       NULLIF(le.detail, ''),
       um.user_id,
       le.create_at::timestamptz,
       le.create_at::timestamptz
FROM _ev_new n
JOIN legacy_archive.webxl_event le ON le.id = n.legacy_id
LEFT JOIN legacy_archive.webxl_attribute att ON att.id = le.event_type AND att."refId" = '9'
LEFT JOIN _user_map um ON um.legacy_id = le.user_id;

-- 'event' rows; any older non-drm.events mapping rows (e.g. archive payload) are left as-is.
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'event', 'webxl_event', legacy_id, new_id::text, 'events' FROM _ev_new;

-- All legacy event id -> drm.events id (this run + earlier runs)
CREATE TEMP TABLE _ev_map ON COMMIT DROP AS
SELECT m.legacy_id, e.id AS event_id, e.event_date
FROM migration_meta.migration_legacy_ids m
JOIN drm.events e ON e.id::text = m.modern_id
WHERE m.entity_type = 'event' AND m.legacy_table = 'webxl_event';

-- ---- Speakers ---------------------------------------------------------------
CREATE TEMP TABLE _sp_new ON COMMIT DROP AS
SELECT ls.id AS legacy_id, gen_random_uuid() AS new_id
FROM legacy_archive.webxl_event_speaker ls
JOIN _ev_map em ON em.legacy_id = ls.event_name
WHERE NOT EXISTS (
  SELECT 1 FROM migration_meta.migration_legacy_ids m
  WHERE m.entity_type = 'event_speaker' AND m.legacy_table = 'webxl_event_speaker' AND m.legacy_id = ls.id
);

INSERT INTO drm.event_speakers (id, event_id, speaker_name, topic, detail, start_time, end_time, created_at, updated_at)
SELECT n.new_id, em.event_id, ls.speaker, ls.topic, NULLIF(ls.detail, ''),
       NULLIF(left(ls.start_time, 5), ''), NULLIF(left(ls.end_time, 5), ''),
       ls.create_at::timestamptz, ls.create_at::timestamptz
FROM _sp_new n
JOIN legacy_archive.webxl_event_speaker ls ON ls.id = n.legacy_id
JOIN _ev_map em ON em.legacy_id = ls.event_name;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'event_speaker', 'webxl_event_speaker', legacy_id, new_id::text, 'event_speakers' FROM _sp_new;

-- ---- Menu items -------------------------------------------------------------
CREATE TEMP TABLE _mi_new ON COMMIT DROP AS
SELECT lm.id AS legacy_id, gen_random_uuid() AS new_id
FROM legacy_archive.webxl_event_menu lm
JOIN _ev_map em ON em.legacy_id = lm.event_name
WHERE NOT EXISTS (
  SELECT 1 FROM migration_meta.migration_legacy_ids m
  WHERE m.entity_type = 'event_menu_item' AND m.legacy_table = 'webxl_event_menu' AND m.legacy_id = lm.id
);

INSERT INTO drm.event_menu_items (id, event_id, item_name, amount, status, notes, created_by, created_at, updated_at)
SELECT n.new_id, em.event_id, lm.item,
       CASE WHEN btrim(lm.amount) ~ '^[0-9]+(\.[0-9]+)?$' THEN btrim(lm.amount)::numeric ELSE 0 END,
       CASE WHEN em.event_date < CURRENT_DATE THEN 'completed' ELSE 'pending' END,
       NULLIF(lm.detail, ''), um.user_id,
       lm.create_at::timestamptz, lm.create_at::timestamptz
FROM _mi_new n
JOIN legacy_archive.webxl_event_menu lm ON lm.id = n.legacy_id
JOIN _ev_map em ON em.legacy_id = lm.event_name
LEFT JOIN _user_map um ON um.legacy_id = lm.user_id;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'event_menu_item', 'webxl_event_menu', legacy_id, new_id::text, 'event_menu_items' FROM _mi_new;

-- ---- Duties -----------------------------------------------------------------
CREATE TEMP TABLE _du_new ON COMMIT DROP AS
SELECT ld.id AS legacy_id, gen_random_uuid() AS new_id
FROM legacy_archive.webxl_event_duty ld
JOIN _ev_map em ON em.legacy_id = ld.event_name
WHERE NOT EXISTS (
  SELECT 1 FROM migration_meta.migration_legacy_ids m
  WHERE m.entity_type = 'event_duty' AND m.legacy_table = 'webxl_event_duty' AND m.legacy_id = ld.id
);

INSERT INTO drm.event_duties (id, event_id, duty, assigned_user_id, status, notes, created_by, created_at, updated_at)
SELECT n.new_id, em.event_id, ld.duty, pu.user_id,
       CASE WHEN em.event_date < CURRENT_DATE THEN 'completed' ELSE 'pending' END,
       NULLIF(ld.detail, ''), cu.user_id,
       ld.create_at::timestamptz, ld.create_at::timestamptz
FROM _du_new n
JOIN legacy_archive.webxl_event_duty ld ON ld.id = n.legacy_id
JOIN _ev_map em ON em.legacy_id = ld.event_name
LEFT JOIN _user_map pu ON pu.legacy_id = ld.duty_person
LEFT JOIN _user_map cu ON cu.legacy_id = ld.duty_create_person;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'event_duty', 'webxl_event_duty', legacy_id, new_id::text, 'event_duties' FROM _du_new;

SELECT (SELECT count(*) FROM _ev_new) AS events,
       (SELECT count(*) FROM _sp_new) AS speakers,
       (SELECT count(*) FROM _mi_new) AS menu_items,
       (SELECT count(*) FROM _du_new) AS duties;

COMMIT;
