/** Canonical Next.js paths for Customer sidebar (Phase 14). */
export const CUSTOMER_DUPLICATE_CHECKER = "/dashboard/sales/duplicate-checker" as const;
export const CUSTOMER_ADD_CUSTOMER = "/dashboard/sales/add-customer" as const;
export const CUSTOMER_TEMP_CONTACT = "/dashboard/customer/temporary-contact" as const;
export const CUSTOMER_PRIVATE_POOL = "/dashboard/customers/private-pool" as const;
export const CUSTOMER_SERVICE_POOL = "/dashboard/customers/service-pool" as const;
export const CUSTOMER_GM_BV_POOL = "/dashboard/gm-pool/add-gm" as const;
export const CUSTOMER_IN_SERVICE_REPORT = "/dashboard/reports/in-service" as const;
export const CUSTOMER_PUBLIC_POOL = "/dashboard/customers/public-pool" as const;
export const CUSTOMER_PUBLIC_POOL_FOLLOWUP = "/dashboard/customers/public-pool-followup" as const;
export const CUSTOMER_INVOICE_POOL = "/dashboard/sales/invoice-pool" as const;
export const CUSTOMER_QUOTATION = "/dashboard/sales/quotation" as const;
export const CUSTOMER_CREATE_INVOICE = "/dashboard/sales/create-invoice" as const;
export const CUSTOMER_ACTIVE_CLIENTS = "/dashboard/sales/active-clients" as const;
/** View / follow-up hub (not sidebar — linked from pools). */
export const CUSTOMER_ATTRIBUTE = "/customers/attribute" as const;

export function customerAttributePath(customerId: string) {
  return `${CUSTOMER_ATTRIBUTE}/${customerId}`;
}

export function customerCreateInvoicePath(customerId: string, quotationId?: string) {
  const base = `${CUSTOMER_CREATE_INVOICE}/${customerId}`;
  if (!quotationId) return base;
  return `${base}?quotationId=${encodeURIComponent(quotationId)}`;
}

export function customerQuotationPath(leadId?: string, quotationId?: string) {
  const params = new URLSearchParams();
  if (leadId) params.set("leadId", leadId);
  if (quotationId) params.set("id", quotationId);
  const q = params.toString();
  return q ? `${CUSTOMER_QUOTATION}?${q}` : CUSTOMER_QUOTATION;
}

export const CUSTOMER_SIDEBAR_PATHS = [
  CUSTOMER_DUPLICATE_CHECKER,
  CUSTOMER_ADD_CUSTOMER,
  CUSTOMER_TEMP_CONTACT,
  CUSTOMER_PRIVATE_POOL,
  CUSTOMER_SERVICE_POOL,
  CUSTOMER_GM_BV_POOL,
  CUSTOMER_IN_SERVICE_REPORT,
  CUSTOMER_PUBLIC_POOL,
  CUSTOMER_PUBLIC_POOL_FOLLOWUP,
  CUSTOMER_INVOICE_POOL,
  CUSTOMER_ACTIVE_CLIENTS,
] as const;

/** Legacy bookmark → canonical dashboard path. */
export const CUSTOMER_LEGACY_TO_DASHBOARD = [
  { source: "/sales/duplicate-checker", destination: CUSTOMER_DUPLICATE_CHECKER },
  { source: "/sales/add-customer", destination: CUSTOMER_ADD_CUSTOMER },
  { source: "/customer/temporary-contact", destination: CUSTOMER_TEMP_CONTACT },
  { source: "/sales/temp-contact", destination: CUSTOMER_TEMP_CONTACT },
  { source: "/customers/private-pool", destination: CUSTOMER_PRIVATE_POOL },
  { source: "/customers/service-pool", destination: CUSTOMER_SERVICE_POOL },
  { source: "/gm-pool/add-gm", destination: CUSTOMER_GM_BV_POOL },
  { source: "/reports/in-service", destination: CUSTOMER_IN_SERVICE_REPORT },
  { source: "/customers/public-pool", destination: CUSTOMER_PUBLIC_POOL },
  { source: "/customers/public-pool-followup", destination: CUSTOMER_PUBLIC_POOL_FOLLOWUP },
  { source: "/sales/invoice-pool", destination: CUSTOMER_INVOICE_POOL },
  { source: "/sales/quotation", destination: CUSTOMER_QUOTATION },
  { source: "/sales/create-invoice/:customerId", destination: `${CUSTOMER_CREATE_INVOICE}/:customerId` },
  { source: "/sales/active-clients", destination: CUSTOMER_ACTIVE_CLIENTS },
] as const;
