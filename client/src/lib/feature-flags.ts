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
