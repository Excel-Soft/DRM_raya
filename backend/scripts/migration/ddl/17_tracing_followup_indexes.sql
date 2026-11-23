CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_active
  ON drm.follow_ups (customer_id)
  WHERE coalesce(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_fusl_legacy_service_follow
  ON drm.follow_up_service_lines (legacy_service_id, follow_up_id);
