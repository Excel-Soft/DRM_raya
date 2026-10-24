/** Canonical Next.js path for Social Media Posting (Phase 18). */

export const SOCIAL_MEDIA_HOME = "/dashboard/social-media" as const;

export const SOCIAL_MEDIA_SIDEBAR_PATHS = [SOCIAL_MEDIA_HOME] as const;

export const SOCIAL_MEDIA_LEGACY_TO_DASHBOARD = [
  { source: "/social-media", destination: SOCIAL_MEDIA_HOME },
] as const;
