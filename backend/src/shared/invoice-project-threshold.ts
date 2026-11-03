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

export function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}
