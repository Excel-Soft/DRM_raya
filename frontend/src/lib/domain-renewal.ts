// Domain / Hosting / SSL renewal from the IT Domains list (old DRM "renew" button).
//
// Old flow: renew -> if the company has a follow-up for the service, open the quotation
// with the existing services already selected; otherwise the follow-up must be added
// first. The rest (quotation -> HOD approval -> conversion -> invoice) is the normal
// sales flow and is not touched here.
//
// Follow-up eligibility is the same rule the quotation page enforces
// (GET /api/sales/quotations/eligible-products: the user's own follow-up for that
// sub-service on this customer within 60 days, not yet converted).
import { apiRequestJson } from "@/lib/queryClient";

const DOMAIN_HOSTING_SERVICE = "domain hosting";

interface CatalogProduct {
  id: string;
  name: string;
  parentName: string;
}

function flattenCatalog(data: any): CatalogProduct[] {
  const services: any[] = Array.isArray(data) ? data : data?.items || data?.data || [];
  const out: CatalogProduct[] = [];
  for (const p of services) {
    const subs: any[] = Array.isArray(p?.subServices) ? p.subServices : [];
    if (subs.length > 0) {
      for (const s of subs) if (s?.id) out.push({ id: s.id, name: String(s.name || ""), parentName: String(p.name || "") });
    } else if (p?.id) {
      out.push({ id: p.id, name: String(p.name || ""), parentName: String(p.name || "") });
    }
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Catalog names (Domain Hosting service) that renew this domain's existing services. */
export function renewalServiceNames(domain: any): { label: string; names: string[] }[] {
  const out: { label: string; names: string[] }[] = [];
  const name = norm(String(domain?.domainName || domain?.domain || ""));
  if (name) {
    let tld = "Any ccTLD";
    if (name.endsWith(".pk")) tld = ".pk / .com.pk";
    else if (name.endsWith(".uk")) tld = ".co.uk / .org.uk / etc";
    else if (/\.(com|net|org)$/.test(name)) tld = ".com / .net / .org";
    out.push({ label: "Domain", names: [tld, "Domain Registration"] });
  }
  if (domain?.hostingPackageName || domain?.hostingExpiryDate || domain?.serverId) {
    // "Gold (500MB)" -> "Gold Hosting Plan"
    const tier = String(domain?.hostingPackageName || "").trim().split(/\s|\(/)[0];
    out.push({ label: "Hosting", names: tier ? [`${tier} Hosting Plan`, "Hosting Plan"] : ["Hosting Plan"] });
  }
  if (domain?.sslExpiryDate) out.push({ label: "SSL", names: ["SSL Certificate"] });
  return out;
}

export type RenewalPlan =
  | { kind: "no-company" }
  | { kind: "need-followup"; customerId: string; services: string[] }
  | { kind: "quote"; customerId: string; productIds: string[]; domainUrl: string; services: string[]; skipped: string[] };

export async function planDomainRenewal(domain: any): Promise<RenewalPlan> {
  const customerId = String(domain?.customerId || "");
  if (!customerId) return { kind: "no-company" };

  const [catalogRes, eligibleRes] = await Promise.all([
    apiRequestJson("GET", "/api/sales/services"),
    apiRequestJson("GET", `/api/sales/quotations/eligible-products?customerId=${encodeURIComponent(customerId)}`),
  ]);
  const catalog = flattenCatalog(catalogRes).filter((p) => norm(p.parentName) === DOMAIN_HOSTING_SERVICE);
  const eligible = new Set<string>(
    (Array.isArray(eligibleRes?.data) ? eligibleRes.data : []).map((r: any) => String(r.subserviceId)),
  );

  const wanted = renewalServiceNames(domain);
  const productIds: string[] = [];
  const services: string[] = [];
  const skipped: string[] = [];
  for (const w of wanted) {
    // Prefer a matching catalog product that has a follow-up; names are tried in order.
    let picked: CatalogProduct | undefined;
    for (const n of w.names) {
      const matches = catalog.filter((p) => norm(p.name) === norm(n));
      picked = matches.find((p) => eligible.has(p.id));
      if (picked) break;
    }
    if (picked) {
      if (!productIds.includes(picked.id)) productIds.push(picked.id);
      services.push(`${w.label}: ${picked.name}`);
    } else {
      skipped.push(`${w.label} (${w.names[0]})`);
    }
  }

  // None of the exact renewal services has a follow-up, but other Domain Hosting
  // services do (e.g. the follow-up was logged on a different plan): quote those.
  if (productIds.length === 0) {
    for (const p of catalog) {
      if (eligible.has(p.id) && !productIds.includes(p.id)) {
        productIds.push(p.id);
        services.push(p.name);
      }
    }
  }

  if (productIds.length === 0) {
    return { kind: "need-followup", customerId, services: wanted.map((w) => `${w.label} (${w.names[0]})`) };
  }
  return {
    kind: "quote",
    customerId,
    productIds,
    domainUrl: String(domain?.domainName || domain?.domain || "").trim(),
    services,
    skipped,
  };
}

export function renewalQuotationUrl(plan: Extract<RenewalPlan, { kind: "quote" }>): string {
  const q = new URLSearchParams({
    leadId: plan.customerId,
    renewProducts: plan.productIds.join(","),
    domainUrl: plan.domainUrl,
  });
  return `/sales/quotation?${q.toString()}`;
}

export const customerDetailUrl = (customerId: string) => `/customers/attribute/${customerId}`;
