/**
 * Follow-up "Select Services" catalog — aligned with legacy Follow The Customer modal (2026).
 * Used to seed drm.services / drm.service_subservices and for public-pool follow-up counts.
 */
export const FOLLOWUP_MAIN_SERVICES = [
  { code: "ALIBABA_MEMBERSHIP", name: "Alibaba Membership" },
  { code: "ALIBABA_SERVICES", name: "Alibaba Services" },
  { code: "DESIGN_DEVELOPMENT", name: "Design Development" },
  { code: "DOMAIN_HOSTING", name: "Domain Hosting" },
  { code: "AI_SERVICES", name: "AI Services" },
] as const;

/** Sub-service display names per main service code (legacy main id 1–5). */
export const FOLLOWUP_SUBSERVICE_NAMES: Record<string, readonly string[]> = {
  ALIBABA_MEMBERSHIP: [
    "GGS Digital",
    "Basic",
    "Basic Plus",
    "GGS Pro",
    "Standard",
    "Verified Supplier Rc-Up",
    "Verified Supplier Package",
    "KAP",
    "Kwa Psa",
    "KWA-KAP Package",
    "KWA-3000 Package",
    "Kwa-200 Package",
    "Kwa-500 Package",
    "Kwa-1000 Package",
    "Kwa-2000 Package",
    "Kwa-5000 Package",
    "Cat",
    "Ai",
    "S-Brand",
    "China Trip",
    "RFQs",
    "2 Year VM Package",
    "DigiSME Verified Package",
    "DigiSME Plus Package",
    "DigiSME Basic Package",
  ],
  ALIBABA_SERVICES: [
    "Alibaba Minisite",
    "Alibaba Product Posting",
    "Alibaba online training",
    "Alibaba VA",
    "VATS",
    "BD/ RFQ",
    "AMS",
    "KWA-CM",
    "Sole Proprietor Company",
  ],
  DESIGN_DEVELOPMENT: [
    "Dynamic Website",
    "Xlserp - Free Website",
    "Xlserp - Basic",
    "Basic Dynamic Website",
    "Professional Dynamic Website",
    "Enterprise Dynamic Website",
    "E-Commerce Store",
    "SEO",
    "Logo Design",
    "Catalog Design",
    "Brochure Design",
    "Software Development",
    "Video Documentary",
    "Sole Proprietor Company",
    "Partnership Company",
    "Etsy Store Creation or Posting",
    "Social Media Account Handling",
    "EBay Store Design",
    "Amazon Store Design",
    "Shopify Store",
    "Ebay per Product Posting",
    "Product photoshoot",
    "Listing Page",
    "Android App",
    "IOS App",
    "Welc Training",
    "VM Video",
    "Google Services",
    "Meta Services",
  ],
  DOMAIN_HOSTING: [
    "Domain Registration",
    "1 Year",
    "country Base Domain",
    "On Request (Custom Price)",
    "Pk Domain (2 Years)",
    "Hosting Plan",
    "Aluminum Hosting Plan",
    "Copper Hosting Plan",
    "Silver Hosting Plan",
    "Gold Hosting Plan",
    "Diamond Hosting Plan",
    "Platinum Hosting Plan",
    "SSL Certificate",
    "Cloud Vps Professional",
    "Cloud Vps Business",
  ],
  AI_SERVICES: [
    "AI RAG ChatBot",
    "AI Ledgers pro",
    "AI SEO Agent",
    "AI Websites Build",
    "AI Desingerly",
    "AI Cloud CRM",
    "My Leads Agent",
    "Ai Social Hubs",
    "AI Power Email",
    "eChamber.pk",
    "AI Bundel",
  ],
};

/** Legacy numeric main-service id → name (public pool follow-up). */
export const LEGACY_MAIN_SERVICE_ID_TO_NAME: Record<string, string> = {
  "1": "Alibaba Membership",
  "2": "Alibaba Services",
  "3": "Design Development",
  "4": "Domain Hosting",
  "5": "AI Services",
};

export function legacySubServicesByMainId(mainId: string): string[] {
  const codeByLegacyId: Record<string, string> = {
    "1": "ALIBABA_MEMBERSHIP",
    "2": "ALIBABA_SERVICES",
    "3": "DESIGN_DEVELOPMENT",
    "4": "DOMAIN_HOSTING",
    "5": "AI_SERVICES",
  };
  const mainCode = codeByLegacyId[mainId];
  if (!mainCode) return [];
  return [...(FOLLOWUP_SUBSERVICE_NAMES[mainCode] || [])];
}

export function stableFollowupSubserviceCode(mainServiceCode: string, subName: string): string {
  const base = subName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const prefix = mainServiceCode.slice(0, 12);
  return `FUP_${prefix}_${base || "SUB"}`.slice(0, 120);
}
