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

/**
 * MD-22 (Project Owner, 2026-07-27): Bot System, Online Form, and FB Post are
 * mock chat-widget stubs with no real chatbot/form-processing/Facebook-API
 * backing. Do not build fake functionality behind these — keep the stub route
 * files as provider-ready scaffolding, but hide the entire surface behind its
 * own flag until a real provider and credentials are approved. Each module
 * gets its own flag since each is a separate future integration decision.
 */
export function isBotSystemEnabled(): boolean {
  return process.env.BOT_SYSTEM_ENABLED === "true";
}

export function isOnlineFormEnabled(): boolean {
  return process.env.ONLINE_FORM_ENABLED === "true";
}

export function isFbPostEnabled(): boolean {
  return process.env.FB_POST_ENABLED === "true";
}
