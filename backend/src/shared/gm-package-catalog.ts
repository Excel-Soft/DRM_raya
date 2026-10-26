/** GM-eligible package names (aligned with GET /api/gm-pool/gm-packages). */
export const GM_PACKAGE_CATALOG = [
  { id: "basic", name: "Basic" },
  { id: "basic-plus", name: "Basic Plus" },
  { id: "ggs-digital", name: "GGS Digital" },
  { id: "standard", name: "Standard" },
  { id: "premium", name: "Premium" },
  { id: "verified-supplier", name: "Verified Supplier" },
  { id: "kwa", name: "Kwa" },
  { id: "kwa-200", name: "Kwa-200" },
  { id: "kwa-500", name: "Kwa-500" },
  { id: "kwa-1000", name: "Kwa-1000" },
  { id: "kwa-2000", name: "Kwa-2000" },
  { id: "kwa-5000", name: "Kwa-5000" },
  { id: "cat", name: "Cat" },
  { id: "ai", name: "Ai" },
  { id: "psa", name: "Psa" },
  { id: "sa", name: "SA" },
  { id: "rc-up", name: "Rc-Up" },
  { id: "kap", name: "KAP" },
  { id: "ggs-pro", name: "GGS Pro" },
  { id: "kwa-kap", name: "KWA-KAP" },
  { id: "china-trip", name: "China Trip" },
  { id: "kwa-pro", name: "Kwa-Pro" },
  { id: "kap-package", name: "KAP-Package" },
  { id: "kwa-3000", name: "KWA-3000 Package" },
  { id: "2-year-vm", name: "2 Year VM" },
  { id: "resubmission-of-bv", name: "Resubmission of BV" },
  { id: "digisme-verified", name: "DigiSME Verified package" },
  { id: "digisme-plus", name: "DigiSME Plus package" },
  { id: "digisme-basic", name: "DigiSME Basic package" },
] as const;

const GM_NAME_KEYS = new Set(
  GM_PACKAGE_CATALOG.flatMap((p) => [
    p.name.toLowerCase().trim(),
    p.id.toLowerCase().trim(),
  ]),
);

export function normalizeProductLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Strip UI suffixes from quotation line text (e.g. "Basic Plus with price label 1999"). */
export function stripQuotationDisplayLabel(label: string): string {
  return label
    .replace(/\s+with price label.*$/i, "")
    .replace(/\s*\(\s*\d+\s*\$\s*\)\s*$/i, "")
    .trim();
}

export function isGmCatalogProductName(name: string): boolean {
  const n = normalizeProductLabel(stripQuotationDisplayLabel(name));
  if (!n) return false;
  if (GM_NAME_KEYS.has(n)) return true;
  const byLen = [...GM_PACKAGE_CATALOG].sort((a, b) => b.name.length - a.name.length);
  return byLen.some((p) => {
    const pn = normalizeProductLabel(p.name);
    const pid = normalizeProductLabel(p.id);
    if (n === pn || n === pid) return true;
    if (n.startsWith(`${pn} `) || n.startsWith(`${pn}-`)) return true;
    if (n.startsWith(`${pn} package`) || n === `${pn} package`) return true;
    return false;
  });
}

export type DownstreamKind = "gm" | "invoice";
