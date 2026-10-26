/** Client mirrors of server feature flags (legacy `frontend/src/lib/feature-flags.ts`). */

function envTrue(key: string): boolean {
  if (typeof process === "undefined") return false;
  return process.env[key] === "true";
}

export function isBotSystemEnabled(): boolean {
  return envTrue("NEXT_PUBLIC_BOT_SYSTEM_ENABLED");
}

export function isOnlineFormEnabled(): boolean {
  return envTrue("NEXT_PUBLIC_ONLINE_FORM_ENABLED");
}

export function isFbPostEnabled(): boolean {
  return envTrue("NEXT_PUBLIC_FB_POST_ENABLED");
}
