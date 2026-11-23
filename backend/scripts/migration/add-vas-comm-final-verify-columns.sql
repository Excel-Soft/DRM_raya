-- VAS report "All" users Verify (POST /api/reports/vas/commission/verify) —
-- additive: the two old webxl_vas_comm_final columns the pilot copy lacked.
-- Backfills them from the read-only archive copy (same id = _legacy_pk) and
-- moves the id sequence past the copied ids (it was never advanced, so the
-- first INSERT would have collided with id 2).
BEGIN;

ALTER TABLE drm.webxl_vas_comm_final ADD COLUMN IF NOT EXISTS total_amount numeric(12, 2);
ALTER TABLE drm.webxl_vas_comm_final ADD COLUMN IF NOT EXISTS user_status_date timestamp;

UPDATE drm.webxl_vas_comm_final f
   SET total_amount = CASE WHEN a.total_amount ~ '^-?\d+(\.\d+)?$' THEN a.total_amount::numeric END,
       user_status_date = CASE WHEN a.user_status_date ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
                                AND a.user_status_date NOT LIKE '0000%' THEN a.user_status_date::timestamp END
  FROM legacy_archive.webxl_vas_comm_final a
 WHERE a._source_table = 'webxl_vas_comm_final' AND a._legacy_pk = f.id::text
   AND f.total_amount IS NULL AND f.user_status_date IS NULL;

SELECT setval('drm.webxl_vas_comm_final_id_seq',
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM drm.webxl_vas_comm_final),
                       (SELECT last_value FROM drm.webxl_vas_comm_final_id_seq)));

COMMIT;
