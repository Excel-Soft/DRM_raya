/** Canonical Next.js path for the Increment module. */

export const INCREMENT_VIEW = "/dashboard/increment" as const;

export const INCREMENT_SIDEBAR_PATHS = [INCREMENT_VIEW] as const;

export const INCREMENT_LEGACY_TO_DASHBOARD = [
  { source: "/drm/increment", destination: INCREMENT_VIEW },
] as const;
