ALTER TABLE drm.follow_up_service_lines ADD COLUMN IF NOT EXISTS customer_id uuid;

UPDATE drm.follow_up_service_lines l
   SET customer_id = fu.customer_id
  FROM drm.follow_ups fu
 WHERE l.customer_id IS NULL
   AND fu.id::text = l.follow_up_id;

CREATE INDEX IF NOT EXISTS idx_fusl_customer_legacy
  ON drm.follow_up_service_lines (customer_id, legacy_service_id)
  WHERE customer_id IS NOT NULL;
