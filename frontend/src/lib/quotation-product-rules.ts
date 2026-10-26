/** Mirrors legacy PHP new-quote product classification. */

const GM_PACKAGE_NAMES = [
  "basic",
  "basic plus",
  "ggs digital",
  "standard",
  "premium",
  "verified supplier",
  "kwa",
  "kwa-200",
  "kwa-500",
  "kwa-1000",
  "kwa-2000",
  "kwa-5000",
  "cat",
  "ai",
  "psa",
  "sa",
  "rc-up",
  "kap",
  "ggs pro",
  "kwa-kap",
  "china trip",
  "kwa-pro",
  "kap-package",
  "kwa-3000 package",
  "2 year vm",
  "resubmission of bv",
  "digisme verified package",
  "digisme plus package",
  "digisme basic package",
] as const;

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, " ");
}

export function stripQuotationDisplayLabel(label: string): string {
  return label
    .replace(/\s+with price label.*$/i, "")
    .replace(/\s*\(\s*\d+\s*\$\s*\)\s*$/i, "")
    .trim();
}

export function isGmCatalogProductName(name: string): boolean {
  const n = normalizeLabel(stripQuotationDisplayLabel(name));
  if (!n) return false;
  if (GM_PACKAGE_NAMES.includes(n as (typeof GM_PACKAGE_NAMES)[number])) return true;
  return GM_PACKAGE_NAMES.some((pn) => n.startsWith(`${pn} `) || n.startsWith(`${pn}-`) || n.startsWith(`${pn} package`));
}

/** Legacy: name includes "package" or "service", or GM catalog package. */
export function isPackageProductName(name: string): boolean {
  const n = (name || "").toLowerCase();
  if (n.includes("package") || n.includes("service")) return true;
  return isGmCatalogProductName(name);
}

/** Legacy domain/hosting row detection. */
export function isDomainHostingProductName(name: string, parentName?: string): boolean {
  const hay = `${(name || "").toLowerCase()} ${(parentName || "").toLowerCase()}`;
  return (
    hay.includes("domain") ||
    hay.includes("hosting") ||
    hay.includes("server") ||
    hay.includes("ssl") ||
    hay.includes("vps") ||
    hay.includes("dedicated")
  );
}

export function computeLineItemUsd(
  productName: string,
  unitPrice: number,
  quantity: number,
  abDiscount = 0,
): number {
  if (productName === "Xlserp - Free Website") {
    return (Number(quantity) / 90) * (25600 / 280);
  }
  const rate = Math.max(Number(unitPrice || 0) - Number(abDiscount || 0), 0);
  return rate * Number(quantity || 0);
}

export const QUOTATION_TYPE_OPTIONS = ["New", "Renewal", "Ec", "Rc-Up", "Kwa", "Psa"] as const;

/** Legacy PHP: quote without a per-service follow-up (Alibaba-related catalog). */
export function isQuotableWithoutFollowUp(productName: string): boolean {
  const name = String(productName || "").toLowerCase();
  if (!name) return false;
  const keys = ["alibaba", "product posting", "minisite", "listing page", "verified supplier"];
  return keys.some((k) => name.includes(k));
}
