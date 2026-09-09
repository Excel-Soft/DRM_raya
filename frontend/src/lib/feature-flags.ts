// ---------------------------------------------------------------------------
// Feature flags (client)
//
// Mirrors the server feature flags for UI gating. Vite only exposes env vars
// prefixed with `VITE_` to client code, so the client mirror of the server's
// `SUPPORT_MODULE_ENABLED` flag is `VITE_SUPPORT_MODULE_ENABLED`. A flag is OFF
// unless its value is explicitly the string "true". Absence => disabled.
//
// NOTE: the client flag only controls what the UI shows/links to. The server
// flag (`SUPPORT_MODULE_ENABLED`) is the real enforcement for the API.
// ---------------------------------------------------------------------------

/**
 * Patch 4 Stage 6 (ISS-02 P2): the Support module is deactivated for the current
 * phase. Enable in the UI by setting `VITE_SUPPORT_MODULE_ENABLED=true`.
 */
export function isSupportModuleEnabled(): boolean {
  return import.meta.env.VITE_SUPPORT_MODULE_ENABLED === "true";
}

/**
 * Patch 6 Stage 9 (Section F — production mock guard): demo / mock-only UI must be
 * hidden by default and only shown when explicitly enabled via
 * `VITE_DEMO_MODE_ENABLED=true`. A flag is OFF unless its value is exactly the
 * string "true"; absence => disabled.
 *
 * Client flags only gate what the UI shows. The server remains the real
 * enforcement: future / unimplemented endpoints return 404/403 and never fake
 * success. Never treat a client flag as an authorization decision.
 */
export function isDemoModeEnabled(): boolean {
  return import.meta.env.VITE_DEMO_MODE_ENABLED === "true";
}

/**
 * MD-22 (Project Owner, 2026-07-27): mirrors server/feature-flags.ts's
 * BOT_SYSTEM_ENABLED / ONLINE_FORM_ENABLED / FB_POST_ENABLED. These gate the
 * Bot System, Online Form, and FB Post pages — each is a mock chat-widget
 * stub with no real provider behind it, hidden until its own flag is
 * explicitly turned on for an approved integration.
 */
export function isBotSystemEnabled(): boolean {
  return import.meta.env.VITE_BOT_SYSTEM_ENABLED === "true";
}

export function isOnlineFormEnabled(): boolean {
  return import.meta.env.VITE_ONLINE_FORM_ENABLED === "true";
}

export function isFbPostEnabled(): boolean {
  return import.meta.env.VITE_FB_POST_ENABLED === "true";
}
