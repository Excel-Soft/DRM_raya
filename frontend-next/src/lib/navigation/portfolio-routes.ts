/** Canonical Next.js paths for Portfolio (Phase 26). */

export const PORTFOLIO_ADD = "/dashboard/portfolio/add" as const;
export const PORTFOLIO_VIEW = "/dashboard/portfolio/view" as const;

export const PORTFOLIO_SIDEBAR_PATHS = [PORTFOLIO_ADD, PORTFOLIO_VIEW] as const;

export const PORTFOLIO_LEGACY_TO_DASHBOARD = [
  { source: "/portfolio-add", destination: PORTFOLIO_ADD },
  { source: "/portfolio-view", destination: PORTFOLIO_VIEW },
] as const;
