/** Canonical Next.js paths for Events (Phase 21). */

export const EVENTS_ADD = "/dashboard/events/add" as const;
export const EVENTS_MENU = "/dashboard/events/menu" as const;
export const EVENTS_DUTY_PLANNER = "/dashboard/events/duty-planner" as const;

export const EVENTS_SIDEBAR_PATHS = [EVENTS_ADD, EVENTS_MENU, EVENTS_DUTY_PLANNER] as const;

export const EVENTS_LEGACY_TO_DASHBOARD = [
  { source: "/events/add", destination: EVENTS_ADD },
  { source: "/events/menu", destination: EVENTS_MENU },
  { source: "/events/duty-planner", destination: EVENTS_DUTY_PLANNER },
] as const;
