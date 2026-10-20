import type { Express } from "express";
import { z } from "zod";
import { pool } from "../db";
import type { PoolClient } from "pg";

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
};

const itemSchema = z
  .object({
    productId: z.string().trim().optional().default(""),
    detail: z.string().trim().optional().default(""),
    minTime: z.coerce.number().min(0).optional(),
    maxTime: z.coerce.number().min(0).optional(),
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

// 60-day exclusivity lock (see sales-routes.ts's matching check on follow-up
// creation): once a rep logs a follow-up against a customer+sub-service, no
// OTHER user may create a quotation for that same pair until 60 days pass.
// The original rep is exempt — they're expected to convert their own
// follow-up into a quotation, and doing so is recorded on the follow-up
// detail row (converted_quotation_id/converted_at) for later reporting.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

async function findLockedQuotationItems(
  client: PoolClient,
  customerId: string | null | undefined,
  productIds: string[],
  userId: string,
): Promise<Array<{ productId: string; name: string; reason: string }>> {
  const validIds = Array.from(new Set(productIds.filter((id) => UUID_RE.test(id))));
  if (!customerId || validIds.length === 0) return [];
  const subRes = await client.query(
    `select id, name from drm.service_subservices where id = any($1::uuid[])`,
    [validIds],
  );
  const subIds = subRes.rows.map((r) => r.id);
  if (subIds.length === 0) return [];

  const lockRes = await client.query(
    `select distinct on (d.subservice_id) d.subservice_id, f.created_by, u.name
       from drm.followup_subservice_details d
       join drm.follow_ups f on f.id = d.followup_id
       left join drm.users u on u.id = f.created_by
      where f.customer_id = $1 and d.subservice_id = any($2::uuid[])
        and d.created_at >= now() - interval '60 days'
      order by d.subservice_id, d.created_at desc`,
    [customerId, subIds],
  );
  const nameById = new Map(subRes.rows.map((r) => [r.id, r.name]));
  return lockRes.rows
    .filter((r: any) => r.created_by !== userId)
    .map((r: any) => ({
      productId: r.subservice_id,
      name: nameById.get(r.subservice_id) || r.subservice_id,
      reason: `locked by ${r.name || "another user"} until 60 days after their follow-up`,
    }));
}

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
    const itemTotal = unit * qty;
    return { ...item, itemTotal };
  });

  const subAmount = itemsWithTotal.reduce((sum, i) => sum + i.itemTotal, 0);
  const gstAmount = subAmount * (Number(parsed.gstPercent) / 100);
  const totalAmount = subAmount + gstAmount;

  const paymentTermPercent = Number(parsed.paymentTermPercent ?? 0);
  // If amount is provided by user it overrides the percentage calculation
  const calculatedAmount = totalAmount * (paymentTermPercent / 100);
  const amount = parsed.amount !== undefined && parsed.amount !== null ? Number(parsed.amount) : calculatedAmount;
  
  const grandTotal = amount;

  const dollarRate = Number(parsed.dollarRate || 280);
  const pkrTotalRaw = grandTotal * dollarRate;

  const discountType = parsed.pkrDiscountType || parsed.discountType || "AMOUNT";
  const discountValue = Number(parsed.pkrDiscountValue ?? parsed.discountValue ?? 0);
  const discount =
    discountType === "PERCENT" || discountType === "PERCENTAGE"
      ? pkrTotalRaw * (discountValue / 100)
      : discountValue;
      
  const pkrTotal = Math.max(pkrTotalRaw - discount, 0);

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
    unitPrice: Number(row.unit_price ?? 0),
    quantity: Number(row.quantity ?? 0),
    itemTotal: Number(row.item_total ?? 0),
    startYear: row.start_year,
    endYear: row.end_year,
    domainUrl: row.domain_url,
  };
}

async function insertQuotation(client: PoolClient, userId: string, payload: ParsedQuotation) {
  const { itemsWithTotal, subAmount, gstAmount, totalAmount, grandTotal, pkrTotal, amount } = computeTotals(payload);

  const quotationRes = await client.query<QuotationRow>(
    `
      insert into quotations (
        customer_id, lead_id, account_holder, company, email, contact, delivery_time,
        gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount,
        grand_total, pkr_total, payment_term_percent, save_status, note, amount, dollar_rate, created_by, updated_at
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now())
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
    ],
  );
  const quotation = quotationRes.rows[0];

  for (const item of itemsWithTotal) {
    await client.query(
      `
        insert into quotation_items (
          quotation_id, product_id, detail, min_time, max_time, unit_price,
          quantity, item_total, start_year, end_year, domain_url
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      ],
    );
  }

  return { quotation: mapQuotationRow(quotation), items: itemsWithTotal };
}

async function updateQuotation(client: PoolClient, id: string, payload: ParsedQuotation) {
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
             updated_at = now()
       where id = $21
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
      id,
    ],
  );

  if (!updateRes.rows[0]) {
    return null;
  }

  await client.query(`delete from quotation_items where quotation_id = $1`, [id]);
  for (const item of itemsWithTotal) {
    await client.query(
      `
        insert into quotation_items (
          quotation_id, product_id, detail, min_time, max_time, unit_price,
          quantity, item_total, start_year, end_year, domain_url
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      const updated = await pool.query<QuotationRow>(
        `update quotations set hod_status = 'approved', hod_reviewed_by = $2, hod_reviewed_at = now(), updated_at = now() where id = $1 returning *`,
        [req.params.id, req.user.userId],
      );
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
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : null;
      const updated = await pool.query<QuotationRow>(
        `update quotations set hod_status = 'rejected', hod_reviewed_by = $2, hod_reviewed_at = now(), hod_comment = $3, updated_at = now() where id = $1 returning *`,
        [req.params.id, req.user.userId, reason],
      );
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
                q.converted_invoice_id, q.converted_at, q.created_at,
                coalesce(string_agg(distinct qi.detail, ', ') filter (where qi.detail is not null and qi.detail != ''), '') as service_details
           from quotations q
           left join quotation_items qi on qi.quotation_id = q.id
          where q.created_by = $1
          group by q.id
          order by q.created_at desc
          limit 200`,
        [req.user.userId],
      );
      const rows = result.rows.map((r: any, idx: number) => {
        let statusComment = r.save_status || "Pending";
        if (r.hod_status === "rejected") statusComment = r.hod_comment ? `Rejected: ${r.hod_comment}` : "Rejected";
        else if (r.converted_invoice_id) statusComment = "Converted to Invoice";
        else if (r.hod_status === "approved") statusComment = "Approved";
        else if (r.confirmed_at) statusComment = "Awaiting HOD";
        return {
          rowNumber: idx + 1,
          id: r.id,
          company: r.company,
          customerId: r.customer_id,
          serviceDetails: r.service_details || "-",
          date: r.converted_invoice_id ? r.converted_at : r.created_at,
          statusComment,
          isConfirmed: !!r.confirmed_at,
          isApproved: r.hod_status === "approved",
          isRejected: r.hod_status === "rejected",
          isConverted: !!r.converted_invoice_id,
          invoiceId: r.converted_invoice_id,
        };
      });
      const convertedInvoices = rows.filter((r) => r.isConverted);
      const approved = rows.filter((r) => r.isApproved && !r.isConverted);
      const pendingRejected = rows.filter((r) => !r.isApproved && !r.isConverted);
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
        const locked = await findLockedQuotationItems(client, parsed.data.customerId, productIds, req.user.userId);
        if (locked.length) {
          await client.query("rollback");
          return res.status(409).json({
            error: "SERVICES_LOCKED",
            message: `Cannot create quotation — already locked: ${locked.map((l) => `${l.name} (${l.reason})`).join(", ")}`,
            locked,
          });
        }
        const created = await insertQuotation(client, req.user.userId, parsed.data);
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
        const productIds = parsed.data.items.map((i) => i.productId).filter(Boolean);
        const locked = await findLockedQuotationItems(client, parsed.data.customerId, productIds, req.user.userId);
        if (locked.length) {
          await client.query("rollback");
          return res.status(409).json({
            error: "SERVICES_LOCKED",
            message: `Cannot save quotation — already locked: ${locked.map((l) => `${l.name} (${l.reason})`).join(", ")}`,
            locked,
          });
        }
        const updated = await updateQuotation(client, req.params.id, parsed.data);
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
