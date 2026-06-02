import type { Express } from "express";
import { z } from "zod";
import { pool } from "./db";
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
        `alter table quotations add column if not exists lead_id text;`,
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
    } finally {
      client.release();
    }
  })();
  return ensureQuotationTablesPromise;
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

  const discountType = parsed.pkrDiscountType || parsed.discountType || "AMOUNT";
  const discountValue = Number(parsed.pkrDiscountValue ?? parsed.discountValue ?? 0);
  const discount =
    discountType === "PERCENT" || discountType === "PERCENTAGE"
      ? totalAmount * (discountValue / 100)
      : discountValue;
  const afterDiscount = Math.max(totalAmount - discount, 0);
  const grandTotal = afterDiscount;

  return {
    itemsWithTotal,
    subAmount,
    gstAmount,
    totalAmount,
    discount,
    grandTotal,
    pkrTotal: afterDiscount,
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
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const { itemsWithTotal, subAmount, gstAmount, totalAmount, grandTotal, pkrTotal } = computeTotals(payload);

  const quotationRes = await client.query<QuotationRow>(
    `
      insert into quotations (
        customer_id, lead_id, account_holder, company, email, contact, delivery_time,
        gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount,
        grand_total, pkr_total, payment_term_percent, save_status, note, amount, created_by, updated_at
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now())
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
      payload.amount ?? totalAmount,
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
  const { itemsWithTotal, subAmount, gstAmount, totalAmount, grandTotal, pkrTotal } = computeTotals(payload);

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
             updated_at = now()
       where id = $20
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
      payload.amount ?? totalAmount,
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
               grand_total, pkr_total, payment_term_percent, save_status, note, amount,
               created_by, created_at, updated_at
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

  app.post("/api/quotations", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureQuotationTables();
      const parsed = quotationBaseSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorDetails = JSON.stringify(parsed.error.flatten(), null, 2);
        console.error("[QUOTATION] Validation failed:", errorDetails);
        require('fs').appendFileSync('/tmp/quotation_error.log', `[${new Date().toISOString()}] Validation failed: ${errorDetails}\nPayload: ${JSON.stringify(req.body, null, 2)}\n\n`);
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Validation failed for one or more fields",
          fields: parsed.error.flatten().fieldErrors,
        });
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const created = await insertQuotation(client, req.user.userId, parsed.data);
        await client.query("commit");
        res.status(201).json({ success: true, data: created });
      } catch (err: any) {
        await client.query("rollback");
        const errorMsg = `Error: ${err.message}\nStack: ${err.stack}\nDetail: ${err.detail || 'none'}\nHint: ${err.hint || 'none'}\nCode: ${err.code}\nQuery: ${err.query || 'none'}\n`;
        require('fs').appendFileSync('/tmp/quotation_error.log', `[${new Date().toISOString()}] Creation error: ${errorMsg}\nPayload: ${JSON.stringify(req.body, null, 2)}\n\n`);
        console.error("[QUOTATION] Creation error:", err);
        res.status(500).json({
          error: "InternalError",
          message: err.message || "Failed to create quotation"
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      const errorMsg = `Outer Error: ${err.message}\nStack: ${err.stack}\n`;
      require('fs').appendFileSync('/tmp/quotation_error.log', `[${new Date().toISOString()}] Outer creation error: ${errorMsg}\n`);
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
        const updated = await updateQuotation(client, req.params.id, parsed.data);
        if (!updated) {
          await client.query("rollback");
          return res.status(404).json({ error: "NotFound", message: "Quotation not found" });
        }
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
