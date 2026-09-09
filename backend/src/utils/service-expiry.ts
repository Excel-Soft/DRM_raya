import { addMonths, isBefore, isWithinInterval, subMonths } from "date-fns";

/**
 * Validates and computes the current service expiry state based on an expiry date.
 * 
 * Rules based on workflow:
 * - Active: `today < (expiryDate - warningWindow)`
 * - Expiring: `today` is within 3–6 months (warning window) of `expiryDate`
 * - Expired: `today > expiryDate`
 * 
 * @param expiryDate The date when the service package expires
 * @param warningMonths The number of months before expiry to start showing "Expiring" warnings (defaults to 3)
 */
export function computeExpiryState(
  expiryDate: Date | string | null | undefined, 
  warningMonths = 3
): "active" | "expiring" | "expired" | "unknown" {
  if (!expiryDate) {
    return "unknown"; // Cannot compute without an expiry date
  }

  const expiry = new Date(expiryDate);
  const today = new Date();

  if (isNaN(expiry.getTime())) {
    return "unknown";
  }

  // If today is past the expiry date, it's strictly expired
  if (isBefore(expiry, today)) {
    return "expired";
  }

  const warningStartDate = subMonths(expiry, warningMonths);

  // If today is within [warningStartDate, expiryDate], it is expiring soon
  if (isWithinInterval(today, { start: warningStartDate, end: expiry })) {
    return "expiring";
  }

  // If we haven't hit the warning window yet, we are safely active
  return "active";
}
