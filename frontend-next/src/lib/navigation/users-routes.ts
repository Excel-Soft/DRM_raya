/** Canonical Next.js paths for Users sidebar (Phase 17). */

export const USERS_ADD = "/dashboard/drm/users/add" as const;
export const USERS_LIST = "/dashboard/drm/users/list" as const;
export const USERS_GROUPS = "/dashboard/drm/users/groups" as const;

export const USERS_SIDEBAR_PATHS = [USERS_ADD, USERS_LIST, USERS_GROUPS] as const;

export const USERS_LEGACY_TO_DASHBOARD = [
  { source: "/drm/users/add", destination: USERS_ADD },
  { source: "/drm/users/list", destination: USERS_LIST },
  { source: "/drm/users/groups", destination: USERS_GROUPS },
] as const;
