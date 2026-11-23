-- Undo migrate-legacy-event-attendees.sql (attendees copied from webxl_event_history).
BEGIN;
DELETE FROM drm.event_attendees a USING migration_meta.migration_legacy_ids m
 WHERE m.entity_type = 'event_attendee' AND m.legacy_table = 'webxl_event_history' AND m.modern_id = a.id::text;
DELETE FROM migration_meta.migration_legacy_ids WHERE entity_type = 'event_attendee' AND legacy_table = 'webxl_event_history';
COMMIT;
