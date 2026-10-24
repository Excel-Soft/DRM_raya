/** Canonical Next.js paths for Lead sidebar (Phase 29). */

export const LEAD_LEAD_POOL = "/dashboard/lead/lead-pool" as const;
/** GM / BV verification pool (`/api/gm-bv-pool`) — not Customer → Gm Bv Pool (`/dashboard/gm-pool/add-gm`). */
export const LEAD_GM_BV_POOL = "/dashboard/lead/gm-bv-pool" as const;

export const LEAD_SIDEBAR_PATHS = [LEAD_LEAD_POOL, LEAD_GM_BV_POOL] as const;

export const LEAD_LEGACY_TO_DASHBOARD = [
  { source: "/sales/lead-pools", destination: LEAD_LEAD_POOL },
  { source: "/customers/gmbv-pool", destination: LEAD_GM_BV_POOL },
] as const;
