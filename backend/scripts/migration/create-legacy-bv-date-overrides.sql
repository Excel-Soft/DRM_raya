-- Edits made on "Bv Pending RC Only" (old func.php updateBVRecord) for old-DRM companies.
-- The old page updated webxl_gmaccount (com_id, renwal = 0); legacy_archive is read-only,
-- so the edited dates live here and the report reads COALESCE(override, archive).
-- A row present = all four dates come from here (old update also set empty fields to NULL).
-- Rollback: create-legacy-bv-date-overrides.rollback.sql
CREATE TABLE IF NOT EXISTS drm.legacy_bv_date_overrides (
  com_id       text PRIMARY KEY,
  user_bv_date date,
  bv_date      date,
  start_date   date,
  end_date     date,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
