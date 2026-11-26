-- Profile / Settings pages, force logout, and login audit (additive only).
--   drm.users.sessions_revoked_at  tokens issued before this moment are rejected (admin "Force Logout")
--   drm.users.account_verified_at/by  Accounts verified this user (blue tick)
--   drm.user_settings              per-user theme + "Active" status (green / red tick)
--   drm.login_audit                login success / failure, logout, forced logout with IP + browser
-- Rollback: add-user-sessions-login-audit.rollback.sql
BEGIN;
ALTER TABLE drm.users ADD COLUMN IF NOT EXISTS sessions_revoked_at timestamptz;
ALTER TABLE drm.users ADD COLUMN IF NOT EXISTS account_verified_at timestamptz;
ALTER TABLE drm.users ADD COLUMN IF NOT EXISTS account_verified_by uuid REFERENCES drm.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS drm.user_settings (
  user_id       uuid PRIMARY KEY REFERENCES drm.users(id) ON DELETE CASCADE,
  theme_mode    text NOT NULL DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
  theme_accent  text NOT NULL DEFAULT 'green',
  status_active boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drm.login_audit (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES drm.users(id) ON DELETE SET NULL,
  login_id      text,
  event         text NOT NULL CHECK (event IN ('login_success', 'login_failed', 'logout', 'forced_logout')),
  reason        text,
  ip            text,
  user_agent    text,
  browser       text,
  os            text,
  device        text,
  actor_user_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_audit_created_idx ON drm.login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS login_audit_user_created_idx ON drm.login_audit (user_id, created_at DESC);
COMMIT;
