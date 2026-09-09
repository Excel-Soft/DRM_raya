// ---------------------------------------------------------------------------
// Feature flags (server)
//
// Central, reversible toggles for optional modules. A flag is OFF unless its
// environment variable is explicitly the string "true". Absence => disabled.
// ---------------------------------------------------------------------------

/**
 * Patch 4 Stage 6 (ISS-02 P2): the Support module is deactivated for the current
 * phase. Enable by setting `SUPPORT_MODULE_ENABLED=true` in the server env
 * (Replit-managed). When false/absent, the entire `/api/support/*` surface is
 * unavailable and the frontend hides/blocks all Support entry points.
 */
export function isSupportModuleEnabled(): boolean {
  return process.env.SUPPORT_MODULE_ENABLED === "true";
}
