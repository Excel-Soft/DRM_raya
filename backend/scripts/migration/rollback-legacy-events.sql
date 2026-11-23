-- Undo migrate-legacy-events.sql: deletes ONLY the drm.* rows it created
-- (tracked in migration_meta.migration_legacy_ids) and their mapping rows.
-- Archive rows are untouched. WARNING: edits made in the app to these copied
-- rows (and any new speakers/duties/menu items added under copied events,
-- via ON DELETE CASCADE) are lost.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback-legacy-events.sql
BEGIN;
DELETE FROM drm.event_duties WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type = 'event_duty' AND legacy_table = 'webxl_event_duty');
DELETE FROM drm.event_menu_items WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type = 'event_menu_item' AND legacy_table = 'webxl_event_menu');
DELETE FROM drm.event_speakers WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type = 'event_speaker' AND legacy_table = 'webxl_event_speaker');
DELETE FROM drm.events WHERE id::text IN (SELECT modern_id FROM migration_meta.migration_legacy_ids WHERE entity_type = 'event' AND legacy_table = 'webxl_event');
DELETE FROM migration_meta.migration_legacy_ids
WHERE (entity_type, legacy_table) IN (('event_duty','webxl_event_duty'), ('event_menu_item','webxl_event_menu'),
                                      ('event_speaker','webxl_event_speaker'), ('event','webxl_event'));
COMMIT;
