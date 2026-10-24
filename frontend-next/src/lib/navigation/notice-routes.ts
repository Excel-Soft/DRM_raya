/** Canonical Next.js paths for Notice module (Phase 27). */

import { DASHBOARD_NOTICE_BOARD, DASHBOARD_POLICIES } from "./dashboard-routes";

export const NOTICE_BOARD = DASHBOARD_NOTICE_BOARD;
export const NOTICE_POLICIES = DASHBOARD_POLICIES;

export const NOTICE_SIDEBAR_PATHS = [NOTICE_BOARD, NOTICE_POLICIES] as const;

export const NOTICE_LEGACY_TO_DASHBOARD = [
  { source: "/notice-board", destination: NOTICE_BOARD },
  { source: "/policies", destination: NOTICE_POLICIES },
] as const;
