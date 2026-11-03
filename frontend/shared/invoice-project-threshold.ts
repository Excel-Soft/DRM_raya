/** Minimum fraction of invoice total (PKR) required before auto PMS project creation. */
export const INVOICE_PROJECT_MIN_FRACTION = 0.33;

export function invoiceMinimumProjectPkr(totalPkr: number): number {
  if (!Number.isFinite(totalPkr) || totalPkr <= 0) return 0;
  return Math.ceil(totalPkr * INVOICE_PROJECT_MIN_FRACTION);
}

/** Cumulative PKR received must reach at least 33% of invoice total (PKR). */
export function meetsInvoiceProjectThreshold(paidPkr: number, totalPkr: number): boolean {
  if (!Number.isFinite(totalPkr) || totalPkr <= 0) return true;
  const paid = Number.isFinite(paidPkr) ? paidPkr : 0;
  return paid + 1e-6 >= invoiceMinimumProjectPkr(totalPkr);
}

export function resolveInvoiceTotalPkr(input: {
  pkrTotal?: number | string | null;
  amountPkr?: number | string | null;
  grandTotal?: number | string | null;
  total?: number | string | null;
  dollarRate?: number | string | null;
  currency?: string | null;
}): number {
  if (input.pkrTotal !== null && input.pkrTotal !== undefined && input.pkrTotal !== "") {
    return Math.max(0, Math.round(Number(input.pkrTotal)));
  }
  if (input.amountPkr !== null && input.amountPkr !== undefined && input.amountPkr !== "") {
    return Math.max(0, Math.round(Number(input.amountPkr)));
  }
  const rate = Number(input.dollarRate) || 280;
  const nativeTotal = Number(input.grandTotal ?? input.total ?? 0);
  if (String(input.currency || "").toUpperCase() === "PKR") {
    return Math.max(0, Math.round(nativeTotal));
  }
  return Math.max(0, Math.round(nativeTotal * rate));
}

export function invoicePaidNativeToPkr(
  paidNative: number,
  currency: string | null | undefined,
  dollarRate: number,
): number {
  const paid = Number(paidNative) || 0;
  const rate = Number(dollarRate) || 280;
  if (String(currency || "").toUpperCase() === "USD") return paid * rate;
  return paid;
}

export function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}
