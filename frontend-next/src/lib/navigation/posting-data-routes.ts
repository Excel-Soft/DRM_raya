/** Canonical Next.js paths for Posting Data (Phase 23). */

export const POSTING_DATA_ADD_PRODUCTS = "/dashboard/posting-data/add-products" as const;
export const POSTING_DATA_ADD_KEYWORDS = "/dashboard/posting-data/add-keywords" as const;
export const POSTING_DATA_VIEW_KEYWORDS = "/dashboard/posting-data/view-keywords" as const;
export const POSTING_DATA_VIEW_PRODUCTS = "/dashboard/posting-data/view-products" as const;
export const POSTING_DATA_DATA_VERIFY = "/dashboard/posting-data/data-verify" as const;
export const POSTING_DATA_LINK_REPORT = "/dashboard/posting-data/link-report" as const;
export const POSTING_DATA_RESTRICTED_KEYWORDS = "/dashboard/posting-data/restricted-keywords" as const;

export const POSTING_DATA_SIDEBAR_PATHS = [
  POSTING_DATA_ADD_PRODUCTS,
  POSTING_DATA_ADD_KEYWORDS,
  POSTING_DATA_VIEW_KEYWORDS,
  POSTING_DATA_VIEW_PRODUCTS,
  POSTING_DATA_DATA_VERIFY,
  POSTING_DATA_LINK_REPORT,
  POSTING_DATA_RESTRICTED_KEYWORDS,
] as const;

export const POSTING_DATA_LEGACY_TO_DASHBOARD = [
  { source: "/posting-data", destination: POSTING_DATA_ADD_PRODUCTS },
  { source: "/posting-data/add-products", destination: POSTING_DATA_ADD_PRODUCTS },
  { source: "/posting-data/add-keywords", destination: POSTING_DATA_ADD_KEYWORDS },
  { source: "/posting-data/view-keywords", destination: POSTING_DATA_VIEW_KEYWORDS },
  { source: "/posting-data/view-products", destination: POSTING_DATA_VIEW_PRODUCTS },
  { source: "/posting-data/data-verify", destination: POSTING_DATA_DATA_VERIFY },
  { source: "/posting-data/link-report", destination: POSTING_DATA_LINK_REPORT },
  { source: "/posting-data/restricted-keywords", destination: POSTING_DATA_RESTRICTED_KEYWORDS },
  { source: "/posting-data/keywords", destination: POSTING_DATA_VIEW_KEYWORDS },
  { source: "/posting-data/verified", destination: POSTING_DATA_VIEW_PRODUCTS },
  { source: "/team-report/link-report", destination: POSTING_DATA_LINK_REPORT },
] as const;
