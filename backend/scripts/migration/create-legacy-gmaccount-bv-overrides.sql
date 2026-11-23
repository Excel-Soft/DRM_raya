-- "Company & BV Date Details" Update on Dollar System -> Paid Alibaba for old-DRM rows.
-- The old page (GmAccountController update_gm_bv_date) changed one webxl_gmaccount row
-- (bvDate, startData = bvDate, endData = bvDate + 1 year). legacy_archive is read-only,
-- so the new dates live here keyed by the old webxl_gmaccount id; the page reads
-- COALESCE(override, archive). Additive.
-- Rollback: create-legacy-gmaccount-bv-overrides.rollback.sql
CREATE TABLE IF NOT EXISTS drm.legacy_gmaccount_bv_overrides (
  gmaccount_id text PRIMARY KEY,
  com_id       text,
  bv_date      date NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
