export const TRACING_SERVICE_TABS = [
  {
    labelKey: "Alibaba_Membership",
    label: "Alibaba Membership",
    /** Legacy UI label; list API accepts canonical code (preferred). */
    listServiceFilter: "ALIBABA_MEMBERSHIP",
    color: "bg-emerald-500",
  },
  {
    labelKey: "Alibaba_Services",
    label: "Alibaba Services",
    listServiceFilter: "ALIBABA_SERVICES",
    color: "bg-rose-500",
  },
  {
    labelKey: "Design_Development",
    label: "Design Development",
    listServiceFilter: "DESIGN_DEVELOPMENT",
    color: "bg-blue-500",
  },
  {
    labelKey: "Domain_Hosting",
    label: "Domain Hosting",
    listServiceFilter: "DOMAIN_HOSTING",
    color: "bg-slate-600",
  },
] as const;

export const GRADE_TRACE_TABS = ["A+", "A", "A-", "B+", "B-", "B", "C+", "C", "D"] as const;

export type LeadPoolMode = "private" | "public";

export type LeadPoolPageMeta = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function poolApiParam(mode: LeadPoolMode): string {
  return mode === "private" ? "private" : "public";
}

export function poolTitle(mode: LeadPoolMode): string {
  return mode === "private" ? "Private Pool" : "Public Pool (Pick up)";
}
