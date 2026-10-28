import type { PoolClient } from "pg";
import {
  isGmCatalogProductName,
  normalizeProductLabel,
  type DownstreamKind,
} from "../../shared/gm-package-catalog";

export const FOLLOWUP_ELIGIBILITY_DAYS = 60;

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export type EligibleSubservice = {
  subserviceId: string;
  subserviceName: string;
  followupId: string;
  followupDetailId: string;
  eligibleUntil: string;
};

export type QuotationItemEligibility = {
  productId: string;
  productName: string;
  followupId: string | null;
  followupDetailId: string | null;
  downstreamSlice: DownstreamKind;
};

/** Legacy PHP: Alibaba-related lines could be quoted without a per-service follow-up. */
export function isQuotableWithoutFollowUp(productName: string): boolean {
  const name = String(productName || "").toLowerCase();
  if (!name) return false;
  const keys = ["alibaba", "product posting", "minisite", "listing page", "verified supplier"];
  return keys.some((k) => name.includes(k));
}

export async function listEligibleSubservicesForCustomer(
  client: PoolClient,
  customerId: string,
  repUserId: string,
  opts?: { forQuotationId?: string | null },
): Promise<EligibleSubservice[]> {
  if (!UUID_RE.test(customerId) || !repUserId) return [];
  const forQuotationId =
    opts?.forQuotationId && UUID_RE.test(opts.forQuotationId) ? opts.forQuotationId : null;
  const res = await client.query(
    `select distinct on (d.subservice_id)
            d.subservice_id,
            s.name as subservice_name,
            f.id as followup_id,
            d.id as followup_detail_id,
            (d.created_at + interval '${FOLLOWUP_ELIGIBILITY_DAYS} days') as eligible_until
       from drm.followup_subservice_details d
       join drm.follow_ups f on f.id = d.followup_id
       join drm.service_subservices s on s.id = d.subservice_id
      where f.customer_id = $1
        and f.created_by = $2
        and coalesce(f.is_deleted, false) = false
        and d.created_at >= now() - interval '${FOLLOWUP_ELIGIBILITY_DAYS} days'
        and (
          d.converted_quotation_id is null
          or ($3::uuid is not null and d.converted_quotation_id = $3::uuid)
        )
      order by d.subservice_id, d.created_at desc, d.id desc`,
    [customerId, repUserId, forQuotationId],
  );
  return res.rows.map((r) => ({
    subserviceId: r.subservice_id,
    subserviceName: r.subservice_name,
    followupId: r.followup_id,
    followupDetailId: r.followup_detail_id,
    eligibleUntil: r.eligible_until,
  }));
}

export async function validateQuotationItemsForCustomer(
  client: PoolClient,
  customerId: string | null | undefined,
  productIds: string[],
  repUserId: string,
  opts?: { forQuotationId?: string | null },
): Promise<
  | { ok: true; items: QuotationItemEligibility[]; downstreamKind: DownstreamKind }
  | { ok: false; code: string; message: string; details?: unknown }
> {
  if (!customerId || !UUID_RE.test(customerId)) {
    return { ok: false, code: "CUSTOMER_REQUIRED", message: "A valid customer is required for quotation" };
  }
  const ids = Array.from(new Set(productIds.filter((id) => UUID_RE.test(id))));
  if (ids.length === 0) {
    return { ok: false, code: "ITEMS_REQUIRED", message: "At least one product is required" };
  }

  const namesRes = await client.query(
    `select id, name from drm.service_subservices where id = any($1::uuid[])`,
    [ids],
  );
  const nameById = new Map<string, string>(namesRes.rows.map((r) => [r.id, r.name]));
  // The quotation builder's product picker (frontend/src/pages/quotation.tsx)
  // flattens any top-level drm.services row with zero sub-services directly
  // into the selectable list, using the top-level service's own id (e.g. a
  // legacy "LEGACY_SVC_*"-coded catalog entry like "Alibaba Product Posting"
  // or "SEO" that was never broken out into real sub-services) — confirmed
  // 29 of the 35 LEGACY_SVC_* services have none. Without this fallback,
  // picking any of them rejected with "Unknown product" and the quotation
  // was silently discarded (an earlier bug in quotation.tsx's handleSave hid
  // this error entirely — see that file's save handler for the fix).
  const missingIds = ids.filter((id) => !nameById.has(id));
  if (missingIds.length > 0) {
    const topLevelRes = await client.query(
      `select id, name from drm.services where id = any($1::uuid[])`,
      [missingIds],
    );
    for (const row of topLevelRes.rows) nameById.set(row.id, row.name);
  }
  for (const id of ids) {
    if (!nameById.has(id)) {
      return { ok: false, code: "INVALID_PRODUCT", message: `Unknown product ${id}` };
    }
  }

  const eligible = await listEligibleSubservicesForCustomer(client, customerId, repUserId, opts);
  const eligibleBySub = new Map(eligible.map((e) => [e.subserviceId, e]));

  const items: QuotationItemEligibility[] = [];
  let gmCount = 0;
  let invoiceCount = 0;

  for (const productId of ids) {
    const productName = nameById.get(productId)!;
    if (isQuotableWithoutFollowUp(productName)) {
      const slice: DownstreamKind = isGmCatalogProductName(productName) ? "gm" : "invoice";
      if (slice === "gm") gmCount++;
      else invoiceCount++;
      items.push({
        productId,
        productName,
        followupId: null,
        followupDetailId: null,
        downstreamSlice: slice,
      });
      continue;
    }
    let match = eligibleBySub.get(productId);
    if (!match && opts?.forQuotationId) {
      const pn = normalizeProductLabel(productName);
      match =
        eligible.find((e) => normalizeProductLabel(e.subserviceName) === pn) ??
        eligible.find((e) => {
          const en = normalizeProductLabel(e.subserviceName);
          return pn.startsWith(en) || en.startsWith(pn);
        });
    }
    if (!match) {
      return {
        ok: false,
        code: "NO_FOLLOWUP_ELIGIBILITY",
        message: `You have no follow-up within ${FOLLOWUP_ELIGIBILITY_DAYS} days for: ${productName}. Add follow-up for this service first.`,
      };
    }
    const slice: DownstreamKind = isGmCatalogProductName(productName) ? "gm" : "invoice";
    if (slice === "gm") gmCount++;
    else invoiceCount++;
    items.push({
      productId,
      productName,
      followupId: match.followupId,
      followupDetailId: match.followupDetailId,
      downstreamSlice: slice,
    });
  }

  if (gmCount > 0 && invoiceCount > 0) {
    return {
      ok: false,
      code: "MIXED_DOWNSTREAM",
      message: "Cannot mix GM package lines and individual service lines on one quotation",
    };
  }

  const downstreamKind: DownstreamKind = gmCount > 0 ? "gm" : "invoice";
  return { ok: true, items, downstreamKind };
}

export async function loadQuotationRow(client: PoolClient, quotationId: string) {
  const res = await client.query(`select * from quotations where id = $1`, [quotationId]);
  return res.rows[0] ?? null;
}

export function classifyDownstreamFromLineLabels(labels: string[]): DownstreamKind | null {
  let gm = 0;
  let inv = 0;
  for (const raw of labels) {
    const label = String(raw || "").trim();
    if (!label) continue;
    if (isGmCatalogProductName(label)) gm++;
    else inv++;
  }
  if (gm > 0 && inv > 0) return null;
  if (gm > 0) return "gm";
  if (inv > 0) return "invoice";
  return null;
}

export async function resolveDownstreamKindForQuotation(
  client: PoolClient,
  quotationId: string,
): Promise<DownstreamKind | null> {
  const items = await client.query(
    `select qi.detail, s.name as product_name
       from quotation_items qi
       left join drm.service_subservices s on s.id::text = qi.product_id
      where qi.quotation_id = $1`,
    [quotationId],
  );
  const labels = items.rows.flatMap((row) => {
    const parts: string[] = [];
    if (row.product_name) parts.push(String(row.product_name));
    if (row.detail) parts.push(String(row.detail));
    return parts;
  });
  return classifyDownstreamFromLineLabels(labels);
}

export async function inferDownstreamKindFromQuotation(
  client: PoolClient,
  quotationId: string,
): Promise<DownstreamKind | null> {
  const fromLines = await resolveDownstreamKindForQuotation(client, quotationId);
  if (fromLines) return fromLines;
  const q = await loadQuotationRow(client, quotationId);
  if (q?.downstream_kind === "gm" || q?.downstream_kind === "invoice") {
    return q.downstream_kind;
  }
  return null;
}

export async function assertQuotationForGmCreate(
  client: PoolClient,
  quotationId: string,
  customerId: string | null,
  packageName: string,
  actorUserId: string,
): Promise<{ ok: true; quotation: any } | { ok: false; message: string; code: string }> {
  const q = await loadQuotationRow(client, quotationId);
  if (!q) return { ok: false, code: "NOT_FOUND", message: "Quotation not found" };
  if (q.hod_status !== "approved") {
    return { ok: false, code: "NOT_APPROVED", message: "Quotation is not HOD-approved" };
  }
  if (q.converted_gm_id || q.converted_invoice_id) {
    return { ok: false, code: "ALREADY_CONSUMED", message: "Quotation has already been used" };
  }
  if (customerId && q.customer_id && q.customer_id !== customerId) {
    return { ok: false, code: "CUSTOMER_MISMATCH", message: "Quotation does not belong to this customer" };
  }
  const kind = await inferDownstreamKindFromQuotation(client, quotationId);
  if (kind !== "gm") {
    return { ok: false, code: "NOT_GM_QUOTATION", message: "Quotation is not eligible for GM creation" };
  }
  const dup = await client.query(
    `select id from drm.gm_entries where quotation_id = $1 and coalesce(is_deleted, false) = false limit 1`,
    [quotationId],
  );
  if (dup.rowCount) {
    return { ok: false, code: "DUPLICATE_GM", message: "A GM already exists for this quotation" };
  }
  const revalid = await revalidateStoredQuotationEligibility(client, quotationId);
  if (!revalid.ok) return revalid;
  void packageName;
  void actorUserId;
  return { ok: true, quotation: q };
}

export async function revalidateStoredQuotationEligibility(
  client: PoolClient,
  quotationId: string,
): Promise<{ ok: true } | { ok: false; message: string; code: string }> {
  const q = await loadQuotationRow(client, quotationId);
  if (!q?.customer_id) return { ok: false, code: "NO_CUSTOMER", message: "Quotation has no customer" };
  const items = await client.query(
    `select product_id from quotation_items where quotation_id = $1 order by created_at`,
    [quotationId],
  );
  const productIds = items.rows.map((r) => r.product_id).filter(Boolean);
  const check = await validateQuotationItemsForCustomer(client, q.customer_id, productIds, q.created_by, {
    forQuotationId: quotationId,
  });
  if (!check.ok) return { ok: false, code: check.code, message: check.message };
  return { ok: true };
}

export async function assertQuotationForInvoiceCreate(
  client: PoolClient,
  quotationId: string,
  customerId: string | null,
  actorUserId: string,
): Promise<{ ok: true; quotation: any } | { ok: false; message: string; code: string }> {
  const q = await loadQuotationRow(client, quotationId);
  if (!q) return { ok: false, code: "NOT_FOUND", message: "Quotation not found" };
  if (q.created_by !== actorUserId) {
    return { ok: false, code: "FORBIDDEN", message: "Invoice must use your own quotation" };
  }
  if (q.hod_status !== "approved") {
    return { ok: false, code: "NOT_APPROVED", message: "Quotation is not HOD-approved" };
  }
  if (q.converted_invoice_id || q.converted_gm_id) {
    return { ok: false, code: "ALREADY_CONSUMED", message: "Quotation has already been used" };
  }
  if (customerId && q.customer_id && q.customer_id !== customerId) {
    return { ok: false, code: "CUSTOMER_MISMATCH", message: "Quotation does not belong to this customer" };
  }
  const kind = await inferDownstreamKindFromQuotation(client, quotationId);
  if (kind !== "invoice") {
    return { ok: false, code: "NOT_INVOICE_QUOTATION", message: "Use the GM workflow for package quotations" };
  }
  const revalid = await revalidateStoredQuotationEligibility(client, quotationId);
  if (!revalid.ok) return revalid;
  return { ok: true, quotation: q };
}
