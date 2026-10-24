/** Normalizes API rows (camelCase or legacy snake_case) and display helpers. */

export type PortfolioRow = {
  id: string;
  keyword: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  serverLink: string | null;
  topHeaderImage: string | null;
  bodyImage: string | null;
  fullImage: string | null;
  sliders: string[];
  createdAt: string | null;
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseSliders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function normalizePortfolioRow(raw: unknown): PortfolioRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  if (!id) return null;

  return {
    id,
    keyword: pickString(o, "keyword"),
    mainCategory: pickString(o, "mainCategory", "main_category"),
    subCategory: pickString(o, "subCategory", "sub_category"),
    serverLink: pickString(o, "serverLink", "server_link"),
    topHeaderImage: pickString(o, "topHeaderImage", "top_header_image"),
    bodyImage: pickString(o, "bodyImage", "body_image"),
    fullImage: pickString(o, "fullImage", "full_image"),
    sliders: parseSliders(o.sliders),
    createdAt: pickString(o, "createdAt", "created_at"),
  };
}

export function parsePortfolioList(raw: unknown): PortfolioRow[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: unknown[] }).data : [];
  return arr.map(normalizePortfolioRow).filter((r): r is PortfolioRow => r !== null);
}

export function portfolioImageSrc(row: PortfolioRow): string | null {
  for (const url of [row.fullImage, row.topHeaderImage, row.bodyImage, ...row.sliders]) {
    if (url) return url;
  }
  return null;
}

export function portfolioCategoryLabel(row: PortfolioRow): string {
  const main = row.mainCategory?.trim() || "Uncategorized";
  const sub = row.subCategory?.trim();
  return sub ? `${main} / ${sub}` : main;
}

export function portfolioDisplayTitle(row: PortfolioRow): string {
  if (row.keyword) return row.keyword;
  if (row.serverLink) {
    try {
      const host = new URL(row.serverLink.startsWith("http") ? row.serverLink : `https://${row.serverLink}`).hostname;
      return host.replace(/^www\./, "");
    } catch {
      return row.serverLink;
    }
  }
  const parts = [row.subCategory, row.mainCategory].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return "Portfolio design";
}

export type PortfolioUsageStatus = "booked" | "reserved" | "un-used";

export function portfolioUsageStatus(liveReservation: "active" | "confirmed" | "rejected" | "expired" | null): PortfolioUsageStatus {
  if (liveReservation === "confirmed") return "booked";
  if (liveReservation === "active") return "reserved";
  return "un-used";
}

export const PORTFOLIO_MAIN_CATEGORIES = [
  { value: "Website", label: "Website" },
  { value: "Graphic", label: "Graphic design" },
  { value: "Alibaba", label: "Alibaba" },
  { value: "SocialMedia", label: "Social media" },
] as const;

export const PORTFOLIO_SUB_BY_MAIN: Record<string, { value: string; label: string }[]> = {
  Website: [
    { value: "Static", label: "Static website" },
    { value: "Ecom", label: "E-commerce" },
    { value: "Minisite", label: "Minisite" },
  ],
  Graphic: [
    { value: "Logo", label: "Logo design" },
    { value: "Poster", label: "Poster design" },
  ],
  Alibaba: [
    { value: "Store", label: "Store page" },
    { value: "Banner", label: "Banner set" },
  ],
  SocialMedia: [
    { value: "Post", label: "Post creative" },
    { value: "Carousel", label: "Carousel" },
  ],
};

export function subCategoriesForMain(main: string): { value: string; label: string }[] {
  return PORTFOLIO_SUB_BY_MAIN[main] ?? [
    { value: "Static", label: "Static website" },
    { value: "Ecom", label: "E-commerce" },
    { value: "Logo", label: "Logo design" },
    { value: "Poster", label: "Poster design" },
  ];
}
