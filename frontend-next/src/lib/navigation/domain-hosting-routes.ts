/** Canonical Next.js paths for Domain Hosting / IT (Phase 24). */

export const IT_SERVERS = "/dashboard/it/servers" as const;
export const IT_DOMAINS = "/dashboard/it/domains" as const;
export const IT_BACKUP = "/dashboard/it/backup" as const;

export const DOMAIN_HOSTING_SIDEBAR_PATHS = [IT_SERVERS, IT_DOMAINS, IT_BACKUP] as const;

export const DOMAIN_HOSTING_LEGACY_TO_DASHBOARD = [
  { source: "/it/servers", destination: IT_SERVERS },
  { source: "/it/domains", destination: IT_DOMAINS },
  { source: "/it/backup", destination: IT_BACKUP },
] as const;
