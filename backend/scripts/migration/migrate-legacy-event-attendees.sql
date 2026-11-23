-- Reports -> Event Report: old-DRM event attendees (webxl_event_history, 32 rows) ->
-- drm.event_attendees. Old rows: event_name = old event id, com_id = company, atten =
-- Present/Absent, user_id = who marked it, create_at. The new table allows one row per
-- (event, company), so the latest mark per company wins (Exploring New Markets with
-- Alibaba has one company marked twice). Old DRM had no "sale" flag -> false.
-- Mapping rows (entity 'event_attendee') point at the kept old row; idempotent.
-- Rollback: rollback-migrate-legacy-event-attendees.sql
BEGIN;

CREATE TEMP TABLE _a ON COMMIT DROP AS
SELECT DISTINCT ON (ev.modern_id, cm.modern_id)
       h.id AS legacy_id, gen_random_uuid() AS new_id,
       ev.modern_id::uuid AS event_id, cm.modern_id::uuid AS customer_id,
       CASE WHEN lower(btrim(h.atten)) = 'present' THEN 'Present' ELSE 'Absent' END AS status,
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = h.user_id
           AND EXISTS (SELECT 1 FROM drm.users x WHERE x.id = um.modern_id::uuid) LIMIT 1) AS created_by,
       CASE WHEN h.create_at ~ '^\d{4}-\d{2}-\d{2}' THEN h.create_at::timestamp AT TIME ZONE 'Asia/Karachi' END AS created_at
  FROM legacy_archive.webxl_event_history h
  JOIN migration_meta.migration_legacy_ids ev
    ON ev.modern_table = 'events' AND ev.legacy_table = 'webxl_event' AND ev.legacy_id = h.event_name
  JOIN migration_meta.migration_legacy_ids cm
    ON cm.entity_type = 'customer' AND cm.legacy_table = 'webxl_company' AND cm.legacy_id = h.com_id
  JOIN drm.customers c ON c.id = cm.modern_id::uuid
 WHERE NOT EXISTS (SELECT 1 FROM drm.event_attendees x
                    WHERE x.event_id = ev.modern_id::uuid AND x.customer_id = cm.modern_id::uuid)
 ORDER BY ev.modern_id, cm.modern_id, h.create_at DESC, h.id::int DESC;

INSERT INTO drm.event_attendees (id, event_id, customer_id, attendance_status, resulted_in_sale, created_by, created_at, updated_at)
SELECT new_id, event_id, customer_id, status, false, created_by, coalesce(created_at, now()), coalesce(created_at, now())
  FROM _a;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'event_attendee', 'webxl_event_history', legacy_id, new_id::text, 'event_attendees' FROM _a
ON CONFLICT DO NOTHING;

COMMIT;
