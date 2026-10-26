/** Canonical Next.js paths for Account module (legacy `/account/*`). */

export const ACCOUNT_GM_ENTRIES = "/dashboard/account/gm-entries" as const;
export const ACCOUNT_TEMP_GM = "/dashboard/account/temp-gm" as const;
export const ACCOUNT_REFUND_GM = "/dashboard/account/refund-gm" as const;
export const ACCOUNT_DONATIONS = "/dashboard/account/donations" as const;
export const ACCOUNT_INVOICES = "/dashboard/account/invoices" as const;
export const ACCOUNT_LEDGER = "/dashboard/account/ledger" as const;
export const ACCOUNT_AB_REPORT = "/dashboard/account/ab-report" as const;
export const ACCOUNT_DOLLAR_SYSTEM = "/dashboard/account/dollar-system" as const;
export const ACCOUNT_DOLLAR_BUYING = "/dashboard/account/dollar-buying" as const;
export const ACCOUNT_DOLLAR_ADVANCE_PAYMENT = "/dashboard/account/dollar-advance-payment" as const;

/** Prefix for dynamic company history routes (not a standalone page). */
export const ACCOUNT_HISTORY_BASE = "/dashboard/account/history" as const;

export function accountHistoryPath(companyId: string): string {
  return `${ACCOUNT_HISTORY_BASE}/${encodeURIComponent(companyId)}`;
}

export const ACCOUNT_SIDEBAR_PATHS = [
  ACCOUNT_GM_ENTRIES,
  ACCOUNT_TEMP_GM,
  ACCOUNT_REFUND_GM,
  ACCOUNT_DONATIONS,
  ACCOUNT_INVOICES,
  ACCOUNT_LEDGER,
  ACCOUNT_AB_REPORT,
  ACCOUNT_DOLLAR_SYSTEM,
] as const;

export const ACCOUNT_MIGRATED_PATHS = [
  ...ACCOUNT_SIDEBAR_PATHS,
  ACCOUNT_DOLLAR_BUYING,
  ACCOUNT_DOLLAR_ADVANCE_PAYMENT,
  ACCOUNT_HISTORY_BASE,
] as const;

export const ACCOUNT_LEGACY_TO_DASHBOARD = [
  { source: "/account/gm-entries", destination: ACCOUNT_GM_ENTRIES },
  { source: "/account/temp-gm", destination: ACCOUNT_TEMP_GM },
  { source: "/account/refund-gm", destination: ACCOUNT_REFUND_GM },
  { source: "/account/donations", destination: ACCOUNT_DONATIONS },
  { source: "/account/invoices", destination: ACCOUNT_INVOICES },
  { source: "/account/ledger", destination: ACCOUNT_LEDGER },
  { source: "/account/ab-report", destination: ACCOUNT_AB_REPORT },
  { source: "/account/dollar-system", destination: ACCOUNT_DOLLAR_SYSTEM },
  { source: "/account/dollar-buying", destination: ACCOUNT_DOLLAR_BUYING },
  { source: "/account/dollar-advance-payment", destination: ACCOUNT_DOLLAR_ADVANCE_PAYMENT },
  { source: "/account/history/:companyId", destination: "/dashboard/account/history/:companyId" },
] as const;
