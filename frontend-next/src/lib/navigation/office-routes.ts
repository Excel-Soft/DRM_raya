/** Canonical Next.js paths for the Office Account module. */

export const OFFICE_TRIAL_BALANCE = "/dashboard/office/trial-balance-report" as const;
export const OFFICE_CHART_OF_ACCOUNTS = "/dashboard/office/chart-of-accounts" as const;
export const OFFICE_GENERAL_LEDGER = "/dashboard/office/general-ledger" as const;
export const OFFICE_JOURNAL_VOUCHER = "/dashboard/office/journal-voucher" as const;
export const OFFICE_BUSINESS_CUSTOMERS = "/dashboard/office/business-customers" as const;
export const OFFICE_VAS = "/dashboard/office/vas" as const;
export const OFFICE_EXPENSES = "/dashboard/office/expenses" as const;
export const OFFICE_CHEQUES = "/dashboard/office/cheques" as const;

export const OFFICE_SIDEBAR_PATHS = [
  OFFICE_TRIAL_BALANCE,
  OFFICE_CHART_OF_ACCOUNTS,
  OFFICE_GENERAL_LEDGER,
  OFFICE_JOURNAL_VOUCHER,
  OFFICE_BUSINESS_CUSTOMERS,
  OFFICE_VAS,
  OFFICE_EXPENSES,
  OFFICE_CHEQUES,
] as const;

/** Legacy Vite paths -> canonical dashboard URLs. */
export const OFFICE_LEGACY_TO_DASHBOARD = [
  { source: "/office/trial-balance-report", destination: OFFICE_TRIAL_BALANCE },
  { source: "/office/chart-of-accounts", destination: OFFICE_CHART_OF_ACCOUNTS },
  { source: "/office/old-account-head", destination: OFFICE_CHART_OF_ACCOUNTS },
  { source: "/office/account-head", destination: OFFICE_CHART_OF_ACCOUNTS },
  { source: "/office/general-ledger", destination: OFFICE_GENERAL_LEDGER },
  { source: "/office/journal-voucher", destination: OFFICE_JOURNAL_VOUCHER },
  { source: "/office/business-customers", destination: OFFICE_BUSINESS_CUSTOMERS },
  { source: "/office/vas", destination: OFFICE_VAS },
  { source: "/office/expenses", destination: OFFICE_EXPENSES },
  { source: "/office/cheques", destination: OFFICE_CHEQUES },
] as const;
