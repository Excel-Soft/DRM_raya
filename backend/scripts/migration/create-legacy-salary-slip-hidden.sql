-- Old Salary Report "delete slip": the copied old slips (legacy_archive.webxl_tem_salary_ship)
-- are read-only, so a delete from Reports -> Salary Report -> Old DRM Salary hides the slip here.
-- Used by backend/src/server/routes/old-salary-report-routes.ts (until this runs, delete returns 503).
-- Rollback: rollback-legacy-salary-slip-hidden.sql
CREATE TABLE IF NOT EXISTS drm.legacy_salary_slip_hidden (
  slip_id    text PRIMARY KEY,               -- webxl_tem_salary_ship.id
  hidden_by  uuid REFERENCES drm.users(id),
  hidden_at  timestamptz NOT NULL DEFAULT now()
);
