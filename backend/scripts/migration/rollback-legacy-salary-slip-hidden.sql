-- Undo create-legacy-salary-slip-hidden.sql (every hidden old salary slip shows again).
DROP TABLE IF EXISTS drm.legacy_salary_slip_hidden;
