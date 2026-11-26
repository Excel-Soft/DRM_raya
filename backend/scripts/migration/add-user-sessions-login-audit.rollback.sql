-- Rollback of add-user-sessions-login-audit.sql
BEGIN;
DROP TABLE IF EXISTS drm.login_audit;
DROP TABLE IF EXISTS drm.user_settings;
ALTER TABLE drm.users DROP COLUMN IF EXISTS account_verified_by;
ALTER TABLE drm.users DROP COLUMN IF EXISTS account_verified_at;
ALTER TABLE drm.users DROP COLUMN IF EXISTS sessions_revoked_at;
COMMIT;
