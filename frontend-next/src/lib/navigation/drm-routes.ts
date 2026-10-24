/** Canonical Next.js paths for DRM Setting sidebar (Phase 16). */

export const DRM_SUPER_ADMIN = "/dashboard/super-admin" as const;
export const DRM_ADMIN = "/dashboard/admin" as const;
export const DRM_ATTRIBUTES = "/dashboard/drm/attributes" as const;
export const DRM_PERMISSION = "/dashboard/drm/permission" as const;
export const DRM_PROMOTION = "/dashboard/drm/promotion" as const;
export const DRM_DELAY_PROJECT = "/dashboard/drm/delay-project" as const;
export const DRM_RELATED_CUSTOMER = "/dashboard/drm/related-customer" as const;
export const DRM_PMS_SETTING = "/dashboard/drm/pms-setting" as const;
export const DRM_BOT_SYSTEM = "/dashboard/drm/bot-system" as const;
export const DRM_ONLINE_FORM = "/dashboard/drm/online-form" as const;
export const DRM_FB_POST = "/dashboard/drm/fb-post" as const;

export const DRM_SETTING_SIDEBAR_PATHS = [
  DRM_SUPER_ADMIN,
  DRM_ADMIN,
  DRM_ATTRIBUTES,
  DRM_PERMISSION,
  DRM_PROMOTION,
  DRM_DELAY_PROJECT,
  DRM_RELATED_CUSTOMER,
  DRM_PMS_SETTING,
  DRM_BOT_SYSTEM,
  DRM_ONLINE_FORM,
  DRM_FB_POST,
] as const;

/** Legacy Vite bookmarks → canonical dashboard URLs. */
export const DRM_LEGACY_TO_DASHBOARD = [
  { source: "/super-admin", destination: DRM_SUPER_ADMIN },
  { source: "/admin", destination: DRM_ADMIN },
  { source: "/drm/attributes", destination: DRM_ATTRIBUTES },
  { source: "/drm/permission", destination: DRM_PERMISSION },
  { source: "/drm/promotion", destination: DRM_PROMOTION },
  { source: "/drm/delay-project", destination: DRM_DELAY_PROJECT },
  { source: "/projects", destination: DRM_DELAY_PROJECT },
  { source: "/drm/related-customer", destination: DRM_RELATED_CUSTOMER },
  { source: "/drm/pms-setting", destination: DRM_PMS_SETTING },
  { source: "/pms/settings", destination: DRM_PMS_SETTING },
  { source: "/drm/bot-system", destination: DRM_BOT_SYSTEM },
  { source: "/drm/online-form", destination: DRM_ONLINE_FORM },
  { source: "/drm/fb-post", destination: DRM_FB_POST },
] as const;
