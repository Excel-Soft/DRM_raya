import type { Express } from "express";
import { z } from "zod";
import { pool } from "../db";
import type { PoolClient } from "pg";
import type { DownstreamKind } from "../../shared/gm-package-catalog";
import {
  classifyDownstreamFromLineLabels,
  listEligibleSubservicesForCustomer,
  revalidateStoredQuotationEligibility,
  resolveDownstreamKindForQuotation,
  validateQuotationItemsForCustomer,
  type QuotationItemEligibility,
} from "../services/sales-workflow.service";

const discountEnum = z.enum(["PERCENT", "AMOUNT", "PERCENTAGE"]);

type QuotationRow = {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  account_holder: string;
  company: string;
  email: string | null;
  contact: string | null;
  delivery_time: string | null;
  gst_percent: number;
  discount_type: "PERCENT" | "AMOUNT";
  discount_value: number;
  sub_amount: number;
  gst_amount: number;
  total_amount: number;
  grand_total: number;
  payment_term_percent: number;
  save_status: string | null;
  note: string | null;
  amount: number | null;
  pkr_total: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  dollar_rate: number;
  confirmed_at: string | null;
  confirmed_by: string | null;
  hod_status: string | null;
  hod_reviewed_by: string | null;
  hod_reviewed_at: string | null;
  hod_comment: string | null;
  quotation_type: string | null;
};

type QuotationItemRow = {
  id: string;
  quotation_id: string;
  product_id: string;
  detail: string | null;
  min_time: number | null;
  max_time: number | null;
  unit_price: number;
  quantity: number;
  item_total: number;
  start_year: number | null;
  end_year: number | null;
  domain_url: string | null;
  ab_discount: number | null;
};

const itemSchema = z
  .object({
    productId: z.string().trim().optional().default(""),
    detail: z.string().trim().optional().default(""),
    minTime: z.coerce.number().min(0).optional(),
    maxTime: z.coerce.number().min(0).optional(),
    abDiscount: z.coerce.number().min(0).optional().default(0),
    unitPrice: z.coerce.number().min(0, "unit_price must be >= 0"),
    quantity: z.coerce.number().int().min(0, "quantity must be >= 0"),
    startYear: z.coerce.number().int().optional(),
    endYear: z.coerce.number().int().optional(),
    domainUrl: z.string().trim().optional().default(""),
  })
  .refine(
    (val) => {
      if (val.startYear !== undefined && val.endYear !== undefined) {
        return Number(val.startYear) <= Number(val.endYear);
      }
      return true;
    },
    { message: "start_year must be less than or equal to end_year", path: ["endYear"] },
  );

const quotationBaseSchema = z
  .object({
    customerId: z.string().trim().optional().nullable(),
    leadId: z.string().trim().optional().nullable(),
    accountHolder: z.string().trim().min(1, "account_holder is required"),
    company: z.string().trim().min(1, "company is required"),
    email: z.string().trim().email().optional().nullable().or(z.literal("")),
    contact: z.string().trim().optional().nullable(),
    deliveryTime: z.string().trim().optional().nullable(),
    gstPercent: z.coerce.number().min(0).max(100).default(0),
    discountType: discountEnum.default("AMOUNT"),
    discountValue: z.coerce.number().min(0).default(0),
    paymentTermPercent: z.coerce.number().min(0).max(100).default(0),
    saveStatus: z.string().trim().optional().nullable(),
    note: z.string().trim().optional().nullable(),
    amount: z.coerce.number().min(0).optional().nullable(),
    pkrDiscountType: discountEnum.optional().nullable(),
    pkrDiscountValue: z.coerce.number().min(0).optional().nullable(),
    dollarRate: z.coerce.number().min(0).default(280),
    quotationType: z.string().trim().optional().nullable(),
    items: z.array(itemSchema).min(1, "At least one item is required"),
  });

type ParsedQuotation = z.infer<typeof quotationBaseSchema>;

let ensureQuotationTablesPromise: Promise<void> | null = null;
async function ensureQuotationTables() {
  if (ensureQuotationTablesPromise) return ensureQuotationTablesPromise;
  ensureQuotationTablesPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query("set statement_timeout = 10000");
      await client.query(`
        create table if not exists quotations (
          id uuid primary key default gen_random_uuid(),
          customer_id text null,
          lead_id text null,
          account_holder text not null,
          company text not null,
          email text null,
          contact text null,
          delivery_time text null,
          gst_percent numeric(6,2) not null default 0,
          discount_type text not null default 'AMOUNT',
          discount_value numeric(12,2) not null default 0,
          sub_amount numeric(12,2) not null default 0,
          gst_amount numeric(12,2) not null default 0,
          total_amount numeric(12,2) not null default 0,
          grand_total numeric(12,2) not null default 0,
          pkr_total numeric(12,2) null,
          payment_term_percent numeric(6,2) not null default 0,
          save_status text null,
          note text null,
          amount numeric(12,2) null,
          dollar_rate numeric(12,2) not null default 280,
          created_by text not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);

      await client.query(`
        create table if not exists quotation_items (
          id uuid primary key default gen_random_uuid(),
          quotation_id uuid not null references quotations(id) on delete cascade,
          product_id text not null,
          detail text null,
          min_time int null,
          max_time int null,
          unit_price numeric(12,2) not null,
          quantity int not null,
          item_total numeric(12,2) not null,
          start_year int null,
          end_year int null,
          domain_url text null,
          created_at timestamptz not null default now()
        );
      `);

      // Ensure key ID columns are text for maximum flexibility
      await client.query(`
        do $$ 
        begin 
          if (select data_type from information_schema.columns where table_name='quotations' and column_name='customer_id') = 'uuid' then
            alter table quotations alter column customer_id type text;
          end if;
          if (select data_type from information_schema.columns where table_name='quotations' and column_name='lead_id') = 'uuid' then
            alter table quotations alter column lead_id type text;
          end if;
          if (select data_type from information_schema.columns where table_name='quotations' and column_name='created_by') = 'uuid' then
            alter table quotations alter column created_by type text;
          end if;
          if (select data_type from information_schema.columns where table_name='quotation_items' and column_name='product_id') = 'uuid' then
            alter table quotation_items alter column product_id type text;
          end if;
        exception when others then null; end $$;
      `);

      await client.query(
        `create index if not exists idx_quotations_customer on quotations(customer_id);`,
      );
      await client.query(
        `alter table quotations add column if not exists dollar_rate numeric(12,2) not null default 280;`,
      );
      await client.query(
        `create index if not exists idx_quotations_lead on quotations(lead_id);`,
      );
      await client.query(
        `create index if not exists idx_quotations_created_by on quotations(created_by);`,
      );
      await client.query(
        `create index if not exists idx_quotations_created_at on quotations(created_at);`,
      );
      await client.query(
        `create index if not exists idx_quotation_items_quotation on quotation_items(quotation_id);`,
      );
      await client.query(
        `create index if not exists idx_quotation_items_product on quotation_items(product_id);`,
      );
      // Records whether a given locked follow-up (see checkServiceLocks below)
      // was ever actually converted into a quotation by the same rep who
      // logged it — a reporting hook requested alongside the 60-day
      // exclusivity lock, not itself an enforcement mechanism.
      await client.query(`
        alter table drm.followup_subservice_details
          add column if not exists converted_quotation_id uuid null,
          add column if not exists converted_at timestamptz null;
      `);
      await client.query(`
        alter table drm.followup_subservice_details
          drop constraint if exists followup_subservice_details_converted_quotation_id_fkey;
      `);
      await client.query(`
        alter table drm.followup_subservice_details
          add constraint followup_subservice_details_converted_quotation_id_fkey
          foreign key (converted_quotation_id) references quotations(id) on delete set null;
      `);
      // Sales-executive-side confirm step: a quotation is created "Pending"
      // (confirmed_at null) on the creator's own dashboard, editable until
      // they click Done — at which point it's confirmed (visible under
      // "Approved" on their own dashboard) and becomes visible to the HOD's
      // own pending-quotations queue. There's no reject/HOD-approve step yet
      // (no such workflow exists elsewhere in this app for quotations) —
      // this only models the creator's own confirm action.
      await client.query(`
        alter table quotations
          add column if not exists confirmed_at timestamptz null,
          add column if not exists confirmed_by text null;
      `);
      await client.query(
        `create index if not exists idx_quotations_confirmed_at on quotations(confirmed_at);`,
      );
      // The real HOD decision (separate from the creator's own confirm step
      // above) — hod_status stays null while a confirmed quotation sits in
      // the HOD's queue, and only becomes 'approved'/'rejected' once a HOD
      // actually acts on it. "Approved" on the creator's own dashboard is
      // defined as hod_status = 'approved', not merely confirmed_at set.
      await client.query(`
        alter table quotations
          add column if not exists hod_status text null,
          add column if not exists hod_reviewed_by text null,
          add column if not exists hod_reviewed_at timestamptz null,
          add column if not exists hod_comment text null;
      `);
      await client.query(
        `create index if not exists idx_quotations_hod_status on quotations(hod_status);`,
      );
      await client.query(`
        alter table quotations
          add column if not exists downstream_kind text null,
          add column if not exists primary_followup_id uuid null,
          add column if not exists converted_gm_id varchar null;
      `);
      await client.query(`
        alter table quotation_items
          add column if not exists followup_id uuid null,
          add column if not exists followup_detail_id uuid null;
      `);
      await client.query(`
        alter table quotation_items
          add column if not exists ab_discount numeric(12,2) not null default 0;
      `);
      await client.query(`
        alter table quotations
          add column if not exists quotation_type text null;
      `);
      // Set by POST /api/account/invoices when a sales_executive uses the
      // "Create Invoice" action on their own HOD-approved quotation (see
      // requireManualInvoiceCreator). Also ensured from that route's own
      // ensureInvoiceQuotationLink() — duplicated here (idempotent) so this
      // GET endpoint never fails if it's hit before any invoice was ever
      // created from a quotation.
      await client.query(`
        alter table quotations
          add column if not exists converted_invoice_id varchar null,
          add column if not exists converted_at timestamptz null;
      `);
    } finally {
      client.release();
    }
  })();
  return ensureQuotationTablesPromise;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

type QuotationWorkflowMeta = {
  downstreamKind: DownstreamKind;
  primaryFollowupId: string | null;
  itemEligibility: QuotationItemEligibility[];
};

// After a quotation is successfully created, mark any of the creator's OWN
// recent (<=60 day) follow-up detail rows for these sub-services as
// converted — purely a reporting record, not an enforcement step.
async function markFollowupsConverted(
  client: PoolClient,
  customerId: string | null | undefined,
  productIds: string[],
  userId: string,
  quotationId: string,
) {
  const validIds = Array.from(new Set(productIds.filter((id) => UUID_RE.test(id))));
  if (!customerId || validIds.length === 0) return;
  await client.query(
    `update drm.followup_subservice_details d
        set converted_quotation_id = $4, converted_at = now()
       from drm.follow_ups f
      where f.id = d.followup_id
        and f.customer_id = $1
        and d.subservice_id = any($2::uuid[])
        and f.created_by = $3
        and d.created_at >= now() - interval '60 days'
        and d.converted_quotation_id is null`,
    [customerId, validIds, userId, quotationId],
  );
}

function computeTotals(parsed: ParsedQuotation) {
  const itemsWithTotal = parsed.items.map((item) => {
    const unit = Number(item.unitPrice);
    const qty = Number(item.quantity);
    const ab = Number(item.abDiscount ?? 0);
    const itemTotal = Math.max(unit - ab, 0) * qty;
    return { ...item, itemTotal };
  });

  const subAmount = itemsWithTotal.reduce((sum, i) => sum + i.itemTotal, 0);
  const gstAmount = subAmount * (Number(parsed.gstPercent) / 100);
  const totalAmount = subAmount + gstAmount;

  const paymentTermPercent = Number(parsed.paymentTermPercent ?? 0);
  // If amount is provided by user it overrides the percentage calculation
  const calculatedAmount = totalAmount * (paymentTermPercent / 100);
  const amount = parsed.amount !== undefined && parsed.amount !== null ? Number(parsed.amount) : calculatedAmount;
  
  let grandTotal = amount;

  const discountType = parsed.pkrDiscountType || parsed.discountType || "AMOUNT";
  const discountValue = Number(parsed.pkrDiscountValue ?? parsed.discountValue ?? 0);
  if (discountType === "PERCENT" || discountType === "PERCENTAGE") {
    grandTotal = amount - (amount * discountValue) / 100;
  }

  const dollarRate = Number(parsed.dollarRate || 280);
  let pkrTotal = grandTotal * dollarRate;
  if (discountType !== "PERCENT" && discountType !== "PERCENTAGE") {
    pkrTotal = Math.max(pkrTotal - discountValue, 0);
  } else {
    pkrTotal = Math.max(pkrTotal, 0);
  }

  const discount =
    discountType === "PERCENT" || discountType === "PERCENTAGE"
      ? amount * (discountValue / 100)
      : discountValue;

  return {
    itemsWithTotal,
    subAmount,
    gstAmount,
    totalAmount,
    amount,
    discount,
    grandTotal,
    pkrTotal,
    dollarRate
  };
}

function mapQuotationRow(row: QuotationRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    leadId: row.lead_id,
    accountHolder: row.account_holder,
    company: row.company,
    email: row.email,
    contact: row.contact,
    deliveryTime: row.delivery_time,
    gstPercent: Number(row.gst_percent ?? 0),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value ?? 0),
    subAmount: Number(row.sub_amount ?? 0),
    gstAmount: Number(row.gst_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    grandTotal: Number(row.grand_total ?? 0),
    pkrTotal: row.pkr_total !== null ? Number(row.pkr_total) : null,
    paymentTermPercent: Number(row.payment_term_percent ?? 0),
    saveStatus: row.save_status,
    note: row.note,
    amount: row.amount !== null ? Number(row.amount) : null,
    dollarRate: Number(row.dollar_rate ?? 280),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    hodStatus: row.hod_status,
    hodReviewedBy: row.hod_reviewed_by,
    hodReviewedAt: row.hod_reviewed_at,
    hodComment: row.hod_comment,
    quotationType: row.quotation_type,
  };
}

function mapItemRow(row: QuotationItemRow) {
  return {
    id: row.id,
    quotationId: row.quotation_id,
    productId: row.product_id,
    detail: row.detail,
    minTime: row.min_time,
    maxTime: row.max_time,
    abDiscount: Number(row.ab_discount ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    quantity: Number(row.quantity ?? 0),
    itemTotal: Number(row.item_total ?? 0),
    startYear: row.start_year,
    endYear: row.end_year,
    domainUrl: row.domain_url,
  };
}

async function insertQuotation(
  client: PoolClient,
  userId: string,
  payload: ParsedQuotation,
  workflow?: QuotationWorkflowMeta,
) {
  const { itemsWithTotal, subAmount, gstAmount, totalAmount, grandTotal, pkrTotal, amount } = computeTotals(payload);
  const linkByProduct = new Map(
    (workflow?.itemEligibility ?? []).map((e) => [e.productId, e]),
  );

  const quotationRes = await client.query<QuotationRow>(
    `
      insert into quotations (
        customer_id, lead_id, account_holder, company, email, contact, delivery_time,
        gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount,
        grand_total, pkr_total, payment_term_percent, save_status, note, amount, dollar_rate, created_by, updated_at,
        downstream_kind, primary_followup_id, quotation_type
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now(), $22, $23, $24)
    returning *
  `,
    [
      payload.customerId && payload.customerId.trim() !== "" ? payload.customerId : null,
      (payload.leadId && payload.leadId.trim() !== "" ? payload.leadId : (payload.customerId && payload.customerId.trim() !== "" ? payload.customerId : null)),
      payload.accountHolder,
      payload.company,
      payload.email ?? null,
      payload.contact ?? null,
      payload.deliveryTime ?? null,
      payload.gstPercent,
      payload.pkrDiscountType || payload.discountType || "AMOUNT",
      payload.pkrDiscountValue ?? payload.discountValue ?? 0,
      subAmount,
      gstAmount,
      totalAmount,
      grandTotal,
      pkrTotal,
      payload.paymentTermPercent ?? 0,
      payload.saveStatus ?? "pending_hod",
      payload.note ?? null,
      amount,
      payload.dollarRate ?? 280,
      userId,
      workflow?.downstreamKind ?? null,
      workflow?.primaryFollowupId ?? null,
      payload.quotationType ?? null,
    ],
  );
  const quotation = quotationRes.rows[0];

  for (const item of itemsWithTotal) {
    const link = linkByProduct.get(item.productId);
    await client.query(
      `
        insert into quotation_items (
          quotation_id, product_id, detail, min_time, max_time, unit_price,
          quantity, item_total, start_year, end_year, domain_url,
          followup_id, followup_detail_id, ab_discount
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        quotation.id,
        item.productId,
        item.detail ?? null,
        item.minTime ?? null,
        item.maxTime ?? null,
        item.unitPrice,
        item.quantity,
        item.itemTotal,
        item.startYear ?? null,
        item.endYear ?? null,
        item.domainUrl ?? null,
        link?.followupId ?? null,
        link?.followupDetailId ?? null,
        item.abDiscount ?? 0,
      ],
    );
  }

  return { quotation: mapQuotationRow(quotation), items: itemsWithTotal };
}

async function updateQuotation(
  client: PoolClient,
  id: string,
  payload: ParsedQuotation,
  workflow?: QuotationWorkflowMeta,
) {
  const { itemsWithTotal, subAmount, gstAmount, totalAmount, grandTotal, pkrTotal, amount } = computeTotals(payload);

  const updateRes = await client.query<QuotationRow>(
    `
      update quotations
         set customer_id = $1,
             lead_id = $2,
             account_holder = $3,
             company = $4,
             email = $5,
             contact = $6,
             delivery_time = $7,
             gst_percent = $8,
             discount_type = $9,
             discount_value = $10,
             sub_amount = $11,
             gst_amount = $12,
             total_amount = $13,
             grand_total = $14,
             pkr_total = $15,
             payment_term_percent = $16,
             save_status = $17,
             note = $18,
             amount = $19,
             dollar_rate = $20,
             downstream_kind = $21,
             primary_followup_id = $22,
             quotation_type = $23,
             updated_at = now()
       where id = $24
     returning *
    `,
    [
      payload.customerId ?? null,
      payload.leadId ?? payload.customerId ?? null,
      payload.accountHolder,
      payload.company,
      payload.email ?? null,
      payload.contact ?? null,
      payload.deliveryTime ?? null,
      payload.gstPercent,
      payload.pkrDiscountType || payload.discountType,
      payload.pkrDiscountValue ?? payload.discountValue ?? 0,
      subAmount,
      gstAmount,
      totalAmount,
      grandTotal,
      pkrTotal,
      payload.paymentTermPercent ?? 0,
      payload.saveStatus ?? null,
      payload.note ?? null,
      amount,
      payload.dollarRate ?? 280,
      workflow?.downstreamKind ?? null,
      workflow?.primaryFollowupId ?? null,
      payload.quotationType ?? null,
      id,
    ],
  );

  if (!updateRes.rows[0]) {
    return null;
  }

  const linkByProduct = new Map(
    (workflow?.itemEligibility ?? []).map((e) => [e.productId, e]),
  );

  await client.query(`delete from quotation_items where quotation_id = $1`, [id]);
  for (const item of itemsWithTotal) {
    const link = linkByProduct.get(item.productId);
    await client.query(
      `
        insert into quotation_items (
          quotation_id, product_id, detail, min_time, max_time, unit_price,
          quantity, item_total, start_year, end_year, domain_url,
          followup_id, followup_detail_id, ab_discount
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        id,
        item.productId,
        item.detail ?? null,
        item.minTime ?? null,
        item.maxTime ?? null,
        item.unitPrice,
        item.quantity,
        item.itemTotal,
        item.startYear ?? null,
        item.endYear ?? null,
        item.domainUrl ?? null,
        link?.followupId ?? null,
        link?.followupDetailId ?? null,
        item.abDiscount ?? 0,
      ],
    );
  }

  return { quotation: mapQuotationRow(updateRes.rows[0]), items: itemsWithTotal };
}

async function fetchQuotation(id: string) {
  const client = await pool.connect();
  try {
    const qRes = await client.query<QuotationRow>(`select * from quotations where id = $1`, [id]);
    if (!qRes.rows[0]) return null;
    const itemsRes = await client.query<QuotationItemRow>(
      `select * from quotation_items where quotation_id = $1 order by created_at asc`,
      [id],
    );
    return { quotation: mapQuotationRow(qRes.rows[0]), items: itemsRes.rows.map(mapItemRow) };
  } finally {
    client.release();
  }
}

export function registerQuotationRoutes(app: Express) {
  app.get("/api/quotations", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
      const leadId = typeof req.query.leadId === "string" ? req.query.leadId : undefined;

      const params: any[] = [];
      const where: string[] = [];
      if (customerId) {
        params.push(customerId);
        where.push(`customer_id = $${params.length}`);
      }
      if (leadId) {
        params.push(leadId);
        where.push(`lead_id = $${params.length}`);
      }

      const listSql = `
        select id, customer_id, lead_id, account_holder, company, email, contact, delivery_time,
               gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount,
               grand_total, pkr_total, payment_term_percent, save_status, note, amount, dollar_rate,
               created_by, created_at, updated_at, confirmed_at, confirmed_by,
               hod_status, hod_reviewed_by, hod_reviewed_at, hod_comment
          from quotations
          ${where.length ? `where ${where.join(" and ")}` : ""}
         order by created_at desc
         limit 200
      `;
      const list = await pool.query<QuotationRow>(listSql, params);
      res.json({
        success: true,
        data: list.rows.map(mapQuotationRow),
      });
    } catch (err: any) {
      console.error("Error listing quotations", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list quotations" });
    }
  });

  app.get("/api/quotations/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const result = await fetchQuotation(req.params.id);
      if (!result) return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error fetching quotation", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch quotation" });
    }
  });

  const HOD_ROLES = new Set(["hod", "super_hod", "admin", "super_admin"]);
  function hasHodAccess(req: any): boolean {
    const roles = [req.user?.activeRoleId, req.user?.roleId, ...(req.user?.roles || [])]
      .filter(Boolean)
      .map((r: string) => r.toLowerCase());
    return roles.some((r) => HOD_ROLES.has(r));
  }

  // The creator confirms/finalizes their own quotation — this does NOT mark
  // it "Approved" on their own dashboard; it only moves it into the HOD's
  // pending-quotations queue (GET /api/sales/quotations/hod-pending) for a
  // real decision. It stays under "Pending & Rejected" on the creator's side
  // (now showing "Awaiting HOD" instead of "Pending") until the HOD actually
  // approves it via POST .../hod-approve below.
  app.post("/api/quotations/:id/confirm", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const existing = await pool.query<QuotationRow>(`select * from quotations where id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
      if (existing.rows[0].created_by !== req.user.userId) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Only the quotation's creator can confirm it" });
      }
      if (existing.rows[0].hod_status === "approved") {
        return res.status(409).json({ error: "LOCKED", message: "Approved quotations cannot be resubmitted without rejection" });
      }
      const client = await pool.connect();
      try {
        const revalid = await revalidateStoredQuotationEligibility(client, req.params.id);
        if (!revalid.ok) {
          return res.status(409).json({ error: revalid.code, message: revalid.message });
        }
      } finally {
        client.release();
      }
      const updated = await pool.query<QuotationRow>(
        `update quotations set confirmed_at = now(), confirmed_by = $2, updated_at = now() where id = $1 returning *`,
        [req.params.id, req.user.userId],
      );
      res.json({ success: true, data: mapQuotationRow(updated.rows[0]) });
    } catch (err: any) {
      console.error("Error confirming quotation", err);
      res.status(500).json({ error: "InternalError", message: "Failed to confirm quotation" });
    }
  });

  // The actual HOD decision — this is what moves a quotation into "Approved"
  // on the creator's own dashboard. Only reachable once the creator has
  // confirmed it (it must already be in the HOD queue).
  app.post("/api/quotations/:id/hod-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasHodAccess(req)) return res.status(403).json({ error: "FORBIDDEN", message: "Only a HOD can approve quotations" });
      await ensureQuotationTables();
      const existing = await pool.query<QuotationRow>(`select * from quotations where id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
      if (!existing.rows[0].confirmed_at) {
        return res.status(409).json({ error: "NOT_CONFIRMED", message: "This quotation has not been confirmed by its creator yet" });
      }
      const client = await pool.connect();
      let downstreamKind: DownstreamKind | null = null;
      try {
        const revalid = await revalidateStoredQuotationEligibility(client, req.params.id);
        if (!revalid.ok) {
          return res.status(409).json({ error: revalid.code, message: revalid.message });
        }
        downstreamKind = await resolveDownstreamKindForQuotation(client, req.params.id);
      } finally {
        client.release();
      }
      const updated = await pool.query<QuotationRow>(
        `update quotations set hod_status = 'approved', hod_reviewed_by = $2, hod_reviewed_at = now(), updated_at = now(),
                downstream_kind = coalesce($3, downstream_kind)
           where id = $1 and hod_status is distinct from 'approved' returning *`,
        [req.params.id, req.user.userId, downstreamKind],
      );
      if (!updated.rows[0]) {
        return res.status(409).json({ error: "ALREADY_PROCESSED", message: "Quotation was already processed" });
      }
      res.json({ success: true, data: mapQuotationRow(updated.rows[0]) });
    } catch (err: any) {
      console.error("Error approving quotation", err);
      res.status(500).json({ error: "InternalError", message: "Failed to approve quotation" });
    }
  });

  app.post("/api/quotations/:id/hod-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasHodAccess(req)) return res.status(403).json({ error: "FORBIDDEN", message: "Only a HOD can reject quotations" });
      await ensureQuotationTables();
      const existing = await pool.query<QuotationRow>(`select * from quotations where id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
      if (!existing.rows[0].confirmed_at) {
        return res.status(409).json({ error: "NOT_CONFIRMED", message: "This quotation has not been confirmed by its creator yet" });
      }
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
      if (!reason) {
        return res.status(400).json({ error: "REASON_REQUIRED", message: "Rejection reason is required" });
      }
      const updated = await pool.query<QuotationRow>(
        `update quotations set hod_status = 'rejected', hod_reviewed_by = $2, hod_reviewed_at = now(), hod_comment = $3, updated_at = now() where id = $1 and hod_status is distinct from 'approved' returning *`,
        [req.params.id, req.user.userId, reason],
      );
      if (!updated.rows[0]) {
        return res.status(409).json({ error: "ALREADY_PROCESSED", message: "Quotation was already approved or processed" });
      }
      res.json({ success: true, data: mapQuotationRow(updated.rows[0]) });
    } catch (err: any) {
      console.error("Error rejecting quotation", err);
      res.status(500).json({ error: "InternalError", message: "Failed to reject quotation" });
    }
  });

  // Creator sends a HOD-rejected quotation back for another look — clears
  // the prior decision and refreshes confirmed_at so it reappears at the
  // top of the HOD's queue, same as a fresh confirm. Only valid from the
  // rejected state (not approved, and not before it's ever been confirmed).
  app.post("/api/quotations/:id/resubmit", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const existing = await pool.query<QuotationRow>(`select * from quotations where id = $1`, [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
      if (existing.rows[0].created_by !== req.user.userId) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Only the quotation's creator can resubmit it" });
      }
      if (existing.rows[0].hod_status !== "rejected") {
        return res.status(409).json({ error: "NOT_REJECTED", message: "Only a rejected quotation can be resubmitted" });
      }
      const updated = await pool.query<QuotationRow>(
        `update quotations
            set hod_status = null, hod_reviewed_by = null, hod_reviewed_at = null, hod_comment = null,
                confirmed_at = now(), confirmed_by = $2, updated_at = now()
          where id = $1
          returning *`,
        [req.params.id, req.user.userId],
      );
      res.json({ success: true, data: mapQuotationRow(updated.rows[0]) });
    } catch (err: any) {
      console.error("Error resubmitting quotation", err);
      res.status(500).json({ error: "InternalError", message: "Failed to resubmit quotation" });
    }
  });

  // Powers the "My Quotations" widget on the sales-executive dashboard — the
  // creator's own quotations bucketed into: Approved (hod_status='approved')
  // / Pending & Rejected (everything else — not yet confirmed, confirmed but
  // still awaiting the HOD, or hod-rejected) / Converted Invoices (always
  // empty when a quotation has never been turned into an invoice — populated
  // once POST /api/account/invoices is called with that quotation's id (see
  // requireManualInvoiceCreator's sales_executive carve-out), which stamps
  // quotations.converted_invoice_id/converted_at).
  app.get("/api/sales/quotations/my-summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const result = await pool.query(
        `select q.id, q.company, q.customer_id, q.save_status, q.confirmed_at, q.hod_status, q.hod_comment,
                q.converted_invoice_id, q.converted_gm_id, q.downstream_kind, q.converted_at, q.created_at,
                coalesce(string_agg(distinct qi.detail, ', ') filter (where qi.detail is not null and qi.detail != ''), '') as service_details
           from quotations q
           left join quotation_items qi on qi.quotation_id = q.id
          where q.created_by = $1
          group by q.id
          order by q.created_at desc
          limit 200`,
        [req.user.userId],
      );
      const quotationIds = result.rows.map((r: { id: string }) => r.id);
      const labelsByQuotationId = new Map<string, string[]>();
      if (quotationIds.length > 0) {
        const linesRes = await pool.query(
          `select qi.quotation_id, qi.detail, s.name as product_name
             from quotation_items qi
             left join drm.service_subservices s on s.id::text = qi.product_id
            where qi.quotation_id = any($1::uuid[])`,
          [quotationIds],
        );
        for (const line of linesRes.rows) {
          const list = labelsByQuotationId.get(line.quotation_id) ?? [];
          if (line.product_name) list.push(String(line.product_name));
          if (line.detail) list.push(String(line.detail));
          labelsByQuotationId.set(line.quotation_id, list);
        }
      }
      const resolvedKindById = new Map<string, DownstreamKind>();
      for (const r of result.rows) {
        const labels =
          labelsByQuotationId.get(r.id) ??
          (r.service_details ? String(r.service_details).split(",").map((s: string) => s.trim()) : []);
        const kind = classifyDownstreamFromLineLabels(labels);
        if (kind) {
          resolvedKindById.set(r.id, kind);
          if (r.downstream_kind !== kind) {
            void pool.query(`update quotations set downstream_kind = $2 where id = $1`, [r.id, kind]);
          }
        }
      }
      const rows = result.rows.map((r: any, idx: number) => {
        let statusComment = r.save_status || "Pending";
        if (r.hod_status === "rejected") statusComment = r.hod_comment ? `Rejected: ${r.hod_comment}` : "Rejected";
        else if (r.converted_invoice_id) statusComment = "Converted to Invoice";
        else if (r.converted_gm_id) statusComment = "Converted to GM";
        else if (r.hod_status === "approved") statusComment = "Approved";
        else if (r.confirmed_at) statusComment = "Awaiting HOD";
        return {
          rowNumber: idx + 1,
          id: r.id,
          company: r.company,
          customerId: r.customer_id,
          serviceDetails: r.service_details || "-",
          date: r.converted_invoice_id || r.converted_gm_id ? r.converted_at : r.created_at,
          statusComment,
          isConfirmed: !!r.confirmed_at,
          isApproved: r.hod_status === "approved",
          isRejected: r.hod_status === "rejected",
          isConverted: !!r.converted_invoice_id,
          isGmConverted: !!r.converted_gm_id,
          downstreamKind: (resolvedKindById.get(r.id) ?? r.downstream_kind) as DownstreamKind | null,
          invoiceId: r.converted_invoice_id,
          gmEntryId: r.converted_gm_id,
        };
      });
      const convertedInvoices = rows.filter((r) => r.isConverted);
      const approved = rows.filter((r) => r.isApproved && !r.isConverted && !r.isGmConverted);
      const pendingRejected = rows.filter((r) => !r.isApproved && !r.isConverted && !r.isGmConverted);
      res.json({
        success: true,
        approved: { count: approved.length, items: approved },
        pendingRejected: { count: pendingRejected.length, items: pendingRejected },
        convertedInvoices: { count: convertedInvoices.length, items: convertedInvoices },
      });
    } catch (err: any) {
      console.error("Error fetching my-quotations summary", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch quotations summary" });
    }
  });

  // HOD-side queue: confirmed quotations still awaiting a HOD decision.
  // Drops off this list (and its badge count) the moment a HOD approves or
  // rejects it — this is meant to reflect actionable items only.
  app.get("/api/sales/quotations/hod-pending", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const result = await pool.query(
        `select q.id, q.company, q.confirmed_at, q.created_at, u.name as created_by_name,
                coalesce(string_agg(distinct qi.detail, ', ') filter (where qi.detail is not null and qi.detail != ''), '') as service_details
           from quotations q
           left join quotation_items qi on qi.quotation_id = q.id
           left join drm.users u on u.id::text = q.created_by
          where q.confirmed_at is not null and q.hod_status is null
          group by q.id, u.name
          order by q.confirmed_at desc
          limit 200`,
      );
      res.json({
        success: true,
        data: result.rows.map((r: any, idx: number) => ({
          rowNumber: idx + 1,
          id: r.id,
          company: r.company,
          serviceDetails: r.service_details || "-",
          createdBy: r.created_by_name || "-",
          confirmedAt: r.confirmed_at,
        })),
      });
    } catch (err: any) {
      console.error("Error fetching HOD pending quotations", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch pending quotations" });
    }
  });

  app.get("/api/sales/quotations/approved-for-gm", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : null;
      const params: unknown[] = [req.user.userId];
      let customerFilter = "";
      if (customerId && UUID_RE.test(customerId)) {
        params.push(customerId);
        customerFilter = ` and q.customer_id = $${params.length}`;
      }
      const result = await pool.query(
        `select q.id, q.company, q.customer_id, q.downstream_kind, q.grand_total, q.pkr_total, q.dollar_rate,
                q.created_at,
                coalesce(string_agg(distinct s.name, ', '), '') as service_names
           from quotations q
           left join quotation_items qi on qi.quotation_id = q.id
           left join drm.service_subservices s on s.id::text = qi.product_id
          where q.created_by = $1
            and q.hod_status = 'approved'
            and q.converted_gm_id is null
            and q.converted_invoice_id is null
            and (q.downstream_kind is null or q.downstream_kind = 'gm')
            ${customerFilter}
          group by q.id
          order by q.created_at desc
          limit 100`,
        params,
      );
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      console.error("Error listing approved GM quotations", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list approved GM quotations" });
    }
  });

  app.get("/api/sales/quotations/open-product-ids", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : "";
      const excludeQuotationId =
        typeof req.query.excludeQuotationId === "string" ? req.query.excludeQuotationId : null;
      if (!UUID_RE.test(customerId)) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "customerId is required" });
      }
      const params: unknown[] = [String(req.user.userId), customerId];
      let excludeSql = "";
      if (excludeQuotationId && UUID_RE.test(excludeQuotationId)) {
        params.push(excludeQuotationId);
        excludeSql = ` and q.id <> $${params.length}::uuid`;
      }
      const result = await pool.query(
        `select distinct qi.product_id as product_id,
                q.id as quotation_id,
                q.hod_status,
                q.company
           from quotations q
           join quotation_items qi on qi.quotation_id = q.id
          where q.created_by = $1
            and q.customer_id = $2
            and coalesce(q.converted_gm_id, '') = ''
            and coalesce(q.converted_invoice_id, '') = ''
            ${excludeSql}`,
        params,
      );
      const byProduct: Record<string, { quotationId: string; hodStatus: string | null; company: string }> = {};
      for (const row of result.rows) {
        if (row.product_id) {
          byProduct[row.product_id] = {
            quotationId: row.quotation_id,
            hodStatus: row.hod_status,
            company: row.company,
          };
        }
      }
      res.json({ success: true, data: byProduct });
    } catch (err: any) {
      console.error("Error listing open quotation products", err);
      res.status(500).json({ error: "InternalError", message: "Failed to load quotation products" });
    }
  });

  app.get("/api/sales/quotations/check-product", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : "";
      const productId = typeof req.query.productId === "string" ? req.query.productId : "";
      const excludeQuotationId =
        typeof req.query.excludeQuotationId === "string" ? req.query.excludeQuotationId : null;
      if (!UUID_RE.test(customerId) || !productId.trim()) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "customerId and productId are required" });
      }
      const params: unknown[] = [String(req.user.userId), customerId, productId];
      let excludeSql = "";
      if (excludeQuotationId && UUID_RE.test(excludeQuotationId)) {
        params.push(excludeQuotationId);
        excludeSql = ` and q.id <> $${params.length}::uuid`;
      }
      const result = await pool.query(
        `select q.id, q.company, q.hod_status, q.created_at
           from quotations q
           join quotation_items qi on qi.quotation_id = q.id
          where q.created_by = $1
            and q.customer_id = $2
            and qi.product_id = $3
            and coalesce(q.converted_gm_id, '') = ''
            and coalesce(q.converted_invoice_id, '') = ''
            ${excludeSql}
          order by q.created_at desc
          limit 1`,
        params,
      );
      const row = result.rows[0];
      if (!row) {
        return res.json({ success: true, exists: false });
      }
      res.json({
        success: true,
        exists: true,
        quotation: {
          id: row.id,
          company: row.company,
          hodStatus: row.hod_status,
          createdAt: row.created_at,
        },
      });
    } catch (err: any) {
      console.error("Error checking existing quotation for product", err);
      res.status(500).json({ error: "InternalError", message: "Failed to check quotation" });
    }
  });

  app.get("/api/sales/quotations/eligible-products", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId : "";
      if (!UUID_RE.test(customerId)) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "customerId is required" });
      }
      const client = await pool.connect();
      try {
        const eligible = await listEligibleSubservicesForCustomer(client, customerId, String(req.user.userId));
        res.json({ success: true, data: eligible });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("Error listing eligible products", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list eligible products" });
    }
  });

  app.post("/api/quotations", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const parsed = quotationBaseSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorDetails = JSON.stringify(parsed.error.flatten(), null, 2);
        console.error("[QUOTATION] Validation failed:", errorDetails);
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Validation failed for one or more fields",
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const productIds = parsed.data.items.map((i) => i.productId).filter(Boolean);
        if (parsed.data.customerId) {
          for (const pid of productIds) {
            const dup = await client.query(
              `select q.id from quotations q
                 join quotation_items qi on qi.quotation_id = q.id
                where q.created_by = $1 and q.customer_id = $2 and qi.product_id = $3
                  and coalesce(q.converted_gm_id, '') = ''
                  and coalesce(q.converted_invoice_id, '') = ''
                limit 1`,
              [String(req.user.userId), parsed.data.customerId, pid],
            );
            if (dup.rowCount) {
              await client.query("rollback");
              return res.status(409).json({
                error: "DUPLICATE_QUOTATION_PRODUCT",
                message: "You already have an open quotation for this service on this customer.",
              });
            }
          }
        }
        const eligibility = await validateQuotationItemsForCustomer(
          client,
          parsed.data.customerId,
          productIds,
          String(req.user.userId),
        );
        if (!eligibility.ok) {
          await client.query("rollback");
          return res.status(409).json({
            error: eligibility.code,
            message: eligibility.message,
          });
        }
        const workflow: QuotationWorkflowMeta = {
          downstreamKind: eligibility.downstreamKind,
          primaryFollowupId: eligibility.items[0]?.followupId ?? null,
          itemEligibility: eligibility.items,
        };
        const created = await insertQuotation(client, req.user.userId, parsed.data, workflow);
        await markFollowupsConverted(client, parsed.data.customerId, productIds, req.user.userId, created.quotation.id);
        await client.query("commit");
        res.status(201).json({ success: true, data: created });
      } catch (err: any) {
        await client.query("rollback");
        console.error("[QUOTATION] Creation error:", err);
        res.status(500).json({
          error: "InternalError",
          message: err.message || "Failed to create quotation"
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("[QUOTATION] Outer creation error:", err);
      res.status(500).json({
        error: "InternalError",
        message: err.message || "Failed to create quotation"
      });
    }
  });

  app.put("/api/quotations/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const parsed = quotationBaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const existing = await client.query(`select hod_status, converted_invoice_id, converted_gm_id from quotations where id = $1`, [
          req.params.id,
        ]);
        const row = existing.rows[0];
        if (!row) {
          await client.query("rollback");
          return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
        }
        if (row.hod_status === "approved" || row.converted_invoice_id || row.converted_gm_id) {
          await client.query("rollback");
          return res.status(409).json({ error: "LOCKED", message: "Approved or consumed quotations cannot be edited" });
        }
        const productIds = parsed.data.items.map((i) => i.productId).filter(Boolean);
        if (parsed.data.customerId) {
          for (const pid of productIds) {
            const dup = await client.query(
              `select q.id from quotations q
                 join quotation_items qi on qi.quotation_id = q.id
                where q.created_by = $1 and q.customer_id = $2 and qi.product_id = $3
                  and coalesce(q.converted_gm_id, '') = ''
                  and coalesce(q.converted_invoice_id, '') = ''
                  and q.id <> $4::uuid
                limit 1`,
              [String(req.user.userId), parsed.data.customerId, pid, req.params.id],
            );
            if (dup.rowCount) {
              await client.query("rollback");
              return res.status(409).json({
                error: "DUPLICATE_QUOTATION_PRODUCT",
                message: "You already have an open quotation for this service on this customer.",
              });
            }
          }
        }
        const eligibility = await validateQuotationItemsForCustomer(
          client,
          parsed.data.customerId,
          productIds,
          String(req.user.userId),
          { forQuotationId: req.params.id },
        );
        if (!eligibility.ok) {
          await client.query("rollback");
          return res.status(409).json({ error: eligibility.code, message: eligibility.message });
        }
        if (row.hod_status === "rejected") {
          await client.query(
            `update quotations set hod_status = null, hod_comment = null, hod_reviewed_by = null, hod_reviewed_at = null where id = $1`,
            [req.params.id],
          );
        }
        const workflow: QuotationWorkflowMeta = {
          downstreamKind: eligibility.downstreamKind,
          primaryFollowupId: eligibility.items[0]?.followupId ?? null,
          itemEligibility: eligibility.items,
        };
        const updated = await updateQuotation(client, req.params.id, parsed.data, workflow);
        if (!updated) {
          await client.query("rollback");
          return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
        }
        await markFollowupsConverted(client, parsed.data.customerId, productIds, req.user.userId, updated.quotation.id);
        await client.query("commit");
        res.json({ success: true, data: updated });
      } catch (err) {
        await client.query("rollback");
        console.error("Error updating quotation", err);
        res.status(500).json({ error: "InternalError", message: "Failed to update quotation" });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("Error updating quotation (outer)", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update quotation" });
    }
  });
}
