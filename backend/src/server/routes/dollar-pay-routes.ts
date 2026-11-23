import type { Express, Request, Response } from "express";
import { pool } from "../db";
import {
  requireFinancialPermission,
  FINANCIAL_ACTIONS,
  FINANCIAL_VIEW_ROLES,
  FINANCIAL_WRITE_ROLES,
} from "./middleware/financial-permission";
import { AuditLogService } from "./services/audit-log.service";

/*
 * Dollar Pay page (/account/dollar-pay) — port of the old DRM dollarpay.php page.
 *
 *   GET  /api/account/dollar-pay/full                  func.php `page_dollar_gm2`
 *   GET  /api/account/dollar-pay/full/:id/buyers       func.php `payId_buyerDetail`
 *   GET  /api/account/dollar-pay/partial               func.php `page_dollar_gm_partial`
 *   GET  /api/account/dollar-pay/partial/:id/buyers    func.php `payId_buyerDetail2`
 *   POST /api/account/dollar-pay/history               func.php `type_fillter_pay_ab`
 *   POST /api/account/dollar-pay/partial/:id/ab-status func.php `dollar_pay_ab_gm_id2_partial`
 *
 * Data sources:
 *   - legacy_archive.webxl_dollar_pay / webxl_verify_gm_delay_amount / webxl_verify_gm /
 *     webxl_company / webxl_user (READ-ONLY, all columns text, joined via _legacy_pk).
 *     drm.legacy_dollar_pay / drm.legacy_verify_gm_delay are 1:1 legacy-mapped copies of
 *     those archive tables, so they are NOT read (would double count).
 *   - drm.ab_payments (modern "pay to Alibaba" rows) are merged in: rows linked to a
 *     partial receipt go to the Partial card, others to the Full card. Rows that are
 *     themselves legacy-mapped, or whose GM / partial receipt maps to a legacy row that
 *     already appears in the card, are excluded.
 *   - Ab Payment Status updates for archive rows are stored in
 *     drm.dollar_pay_ab_confirm_overrides and overlaid on the archive value.
 */

/** Old MySQL numeric coercion of a text column: strip commas/$/blanks, take the leading
 *  number ("279..81" -> 279, "1119$" -> 1119, "1,565.07" -> 1565.07); NaN/Infinity/'' -> NULL. */
const NN = (col: string) =>
  `nullif(substring(regexp_replace(coalesce(${col}::text, ''), '[,$[:space:]]', '', 'g') from '^-?[0-9]*\\.?[0-9]+'), '')::numeric`;
/** Old MySQL string equality (case-insensitive, trailing-space-insensitive). */
const EQ = (col: string, literal: string) => `lower(btrim(coalesce(${col}, ''))) = '${literal}'`;

const A = (table: string, alias: string, keyExpr: string) =>
  `legacy_archive.${table} ${alias} ON ${alias}._source_table = '${table}' AND ${alias}._legacy_pk = btrim(${keyExpr})`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAY_STATUSES = ["paid", "refund", "processing"] as const;

function intParam(v: unknown, def: number, min: number, max: number) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseBuyerDetail(raw: unknown): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function earnings(customerPkr: number | null, payPkr: number | null, payRate: number | null) {
  // Old JS/PHP: diff = customer_pkr - pay_pkr; profit_loss = diff / pay rate.
  const diff = (customerPkr ?? 0) - (payPkr ?? 0);
  const label = diff > 0 ? "Profit" : diff < 0 ? "Loss" : "Equal";
  const amount = payRate ? diff / payRate : null;
  return { label, amount: amount === null || !Number.isFinite(amount) ? null : amount };
}

// ─── Full payments (page_dollar_gm2) ────────────────────────────────────────

/** Modern ab_payments that must not be shown because they are legacy copies or duplicate a legacy row. */
const MODERN_AB_NOT_LEGACY = `
  NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
               WHERE m.modern_table = 'ab_payments' AND m.modern_id = ap.id::text)`;

function fullSql(search: string, fromDate: string, toDate: string) {
  const params: unknown[] = [`%${search}%`];
  const legacyWhere: string[] = [
    // MySQL `cname LIKE '%..%'` is NULL (row dropped) when the company is missing — same here.
    `(c.cname ILIKE $1 OR c.com_id ILIKE $1)`,
    EQ("v.webxl_pay_status", "yes"),
    EQ("v.acc_disc_status", "approved"),
    EQ("v.ceo_disc_status", "approved"),
  ];
  const modernWhere: string[] = [
    `coalesce(ap.is_deleted, false) = false`,
    `ap.partial_receipt_id IS NULL`,
    `ap.status IN ('paid', 'refund', 'processing')`,
    MODERN_AB_NOT_LEGACY,
    // A modern AB payment for a legacy GM that already has a webxl_dollar_pay row is a duplicate.
    `NOT EXISTS (
       SELECT 1 FROM migration_meta.migration_legacy_ids mg
         JOIN legacy_archive.webxl_dollar_pay dpx ON btrim(dpx.gmid) = mg.legacy_id
        WHERE mg.modern_table = 'gm_entries' AND mg.legacy_table = 'webxl_verify_gm'
          AND mg.modern_id = ap.gm_entry_id::text)`,
    `(coalesce(ap.company_name, g.company_name) ILIKE $1 OR coalesce(g.drm_id, ap.gm_drm_id) ILIKE $1)`,
  ];
  if (DATE_RE.test(fromDate)) {
    params.push(fromDate);
    legacyWhere.push(`left(btrim(dp.create_at), 10) >= $${params.length}`);
    modernWhere.push(`(ap.created_at AT TIME ZONE 'Asia/Karachi')::date >= $${params.length}::date`);
  }
  if (DATE_RE.test(toDate)) {
    params.push(toDate);
    legacyWhere.push(`left(btrim(dp.create_at), 10) <= $${params.length}`);
    modernWhere.push(`(ap.created_at AT TIME ZONE 'Asia/Karachi')::date <= $${params.length}::date`);
  }

  const base = `
    SELECT 'legacy'::text AS src,
           dp.id AS payid,
           dp.gmid,
           dp.member_id,
           dp.order_id,
           left(btrim(dp.pay_date), 10) AS pay_date,
           dp.type,
           dp.pay_status,
           ${NN("dp.dollars")} AS dollars,
           ${NN("dp.dollar_rate")} AS dollar_rate,
           ${NN("dp.pkr_amount")} AS pkr_amount,
           ${NN("dp.cus_dollar_rate")} AS cus_dollar_rate,
           ${NN("dp.cus_profit")} AS cus_profit,
           dp.detail,
           dp.create_at,
           v.package,
           ${NN("v.price")} AS price,
           ${NN("v.dollar_rate")} AS customer_dollar_rate,
           c.com_id,
           c.cname,
           u.name,
           0 AS sort_group,
           NULL::timestamptz AS sort_ts,
           ${NN("v.id")} AS sort_id,
           ${NN("dp.id")} AS sort_id2
      FROM legacy_archive.webxl_dollar_pay dp
      LEFT JOIN ${A("webxl_verify_gm", "v", "dp.gmid")} AND btrim(v.com_id) = btrim(dp.com_id)
      LEFT JOIN ${A("webxl_company", "c", "dp.com_id")}
      LEFT JOIN ${A("webxl_user", "u", "dp.user_id")}
     WHERE ${legacyWhere.join("\n       AND ")}
    UNION ALL
    SELECT 'modern'::text,
           ap.id::text,
           ap.gm_entry_id::text,
           coalesce(ap.member_id, ap.ab_id, g.member_id),
           coalesce(ap.order_id, g.order_id),
           coalesce(ap.paid_date, (ap.created_at AT TIME ZONE 'Asia/Karachi')::date)::text,
           ap.type,
           ap.status,
           ap.amount_usd,
           coalesce(ap.dollar_rate, ap.rate),
           ap.amount_pkr,
           NULL::numeric,
           NULL::numeric,
           ap.notes,
           to_char(ap.created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS'),
           g.package_type,
           g.amount_usd,
           g.dollar_rate,
           coalesce(g.drm_id, ap.gm_drm_id),
           coalesce(ap.company_name, g.company_name),
           coalesce(g.sales_person_name, cu.name),
           -1,
           ap.created_at,
           NULL::numeric,
           ap.id::numeric
      FROM drm.ab_payments ap
      LEFT JOIN drm.gm_entries g ON g.id = ap.gm_entry_id
      LEFT JOIN drm.users cu ON cu.id = ap.created_by
     WHERE ${modernWhere.join("\n       AND ")}`;
  return { base, params };
}

// ─── Partial payments (page_dollar_gm_partial) ──────────────────────────────

function partialSql(search: string) {
  const params: unknown[] = [`%${search}%`];
  const base = `
    SELECT 'legacy'::text AS src,
           d.id AS partial_gm_id,
           d.gmid AS delay_gmid,
           d.com_id AS delay_com_id,
           left(btrim(d.pay_date), 10) AS delay_pay_date,
           ${NN("d.current_dollar_pay")} AS current_dollar_pay,
           ${NN("d.current_dollar_rate")} AS current_dollar_rate,
           ${NN("d.ab_pay_dollar")} AS ab_pay_dollar,
           ${NN("d.pay_dollar_rate")} AS pay_dollar_rate,
           ${NN("d.cus_profit")} AS cus_profit,
           ${NN("d.cus_dollar_rate")} AS cus_dollar_rate,
           ${NN("v.dollar_rate")} AS dollar_rate, -- old JS row.dollar_rate = webxl_verify_gm.dollar_rate
           d.pay_type,
           coalesce(o.ab_confirm_status, d.ab_confirm_status) AS ab_confirm_status,
           (o.legacy_delay_id IS NOT NULL) AS status_overridden,
           v.member_id,
           v.order_id,
           v.package,
           c.com_id,
           c.cname,
           u.name,
           0 AS sort_group,
           NULL::timestamptz AS sort_ts,
           ${NN("d.id")} AS sort_id
      FROM legacy_archive.webxl_verify_gm_delay_amount d
      LEFT JOIN ${A("webxl_verify_gm", "v", "d.gmid")}
      LEFT JOIN ${A("webxl_company", "c", "v.com_id")}
      LEFT JOIN ${A("webxl_user", "u", "v.user_id")}
      LEFT JOIN drm.dollar_pay_ab_confirm_overrides o ON o.legacy_delay_id = d.id
     WHERE (c.cname ILIKE $1 OR c.com_id ILIKE $1)
       AND ${EQ("d.acc_status", "paid")}
       AND ${EQ("d.alibaba", "paid")}
    UNION ALL
    SELECT 'modern'::text,
           ap.id::text,
           coalesce(ap.gm_entry_id::text, r.gm_id),
           NULL,
           coalesce((r.receipt_date)::date, ap.paid_date, (ap.created_at AT TIME ZONE 'Asia/Karachi')::date)::text,
           r.amount_usd,
           r.dollar_rate,
           ap.amount_usd,
           coalesce(ap.dollar_rate, ap.rate),
           NULL::numeric,
           NULL::numeric,
           g.dollar_rate,
           ap.type,
           ap.status,
           false,
           coalesce(ap.member_id, ap.ab_id, g.member_id),
           coalesce(ap.order_id, g.order_id),
           g.package_type,
           coalesce(g.drm_id, ap.gm_drm_id),
           coalesce(ap.company_name, g.company_name),
           coalesce(g.sales_person_name, cu.name),
           -1,
           ap.created_at,
           ap.id::numeric
      FROM drm.ab_payments ap
      LEFT JOIN drm.gm_partial_receipts r ON r.id = ap.partial_receipt_id
      LEFT JOIN drm.gm_entries g ON g.id::text = coalesce(ap.gm_entry_id::text, r.gm_id)
      LEFT JOIN drm.users cu ON cu.id = ap.created_by
     WHERE coalesce(ap.is_deleted, false) = false
       AND ap.partial_receipt_id IS NOT NULL
       AND ap.status IN ('paid', 'refund', 'processing')
       AND ${MODERN_AB_NOT_LEGACY}
       -- partial receipt copied from a legacy delay row that is already listed above -> duplicate
       AND NOT EXISTS (
         SELECT 1 FROM migration_meta.migration_legacy_ids mr
           JOIN legacy_archive.webxl_verify_gm_delay_amount dx
             ON dx._source_table = 'webxl_verify_gm_delay_amount' AND dx._legacy_pk = mr.legacy_id
          WHERE mr.modern_table = 'gm_partial_receipts' AND mr.legacy_table = 'webxl_verify_gm_delay_amount'
            AND mr.modern_id = ap.partial_receipt_id
            AND ${EQ("dx.acc_status", "paid")} AND ${EQ("dx.alibaba", "paid")})
       AND (coalesce(ap.company_name, g.company_name) ILIKE $1 OR coalesce(g.drm_id, ap.gm_drm_id) ILIKE $1)`;
  return { base, params };
}

function callerUserId(req: Request): string | null {
  const u = req.user as any;
  return (u?.userId ?? u?.id ?? null) as string | null;
}

export function registerDollarPayRoutes(app: Express) {
  const view = requireFinancialPermission(FINANCIAL_ACTIONS.walletView, { roles: FINANCIAL_VIEW_ROLES });
  const write = requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentStatusUpdate, { roles: FINANCIAL_WRITE_ROLES });

  // GET /api/account/dollar-pay/full?page=&search=&pageSize=&fromDate=&toDate=
  app.get("/api/account/dollar-pay/full", view, async (req: Request, res: Response) => {
    try {
      const pageSize = intParam(req.query.pageSize, 50, 1, 200); // old $limit = 50
      const page = intParam(req.query.page, 1, 1, 1_000_000);
      const search = String(req.query.search ?? "").trim();
      const fromDate = String(req.query.fromDate ?? "").slice(0, 10);
      const toDate = String(req.query.toDate ?? "").slice(0, 10);
      const { base, params } = fullSql(search, fromDate, toDate);

      const agg = await pool.query(
        `WITH b AS (${base})
         SELECT count(*)::int AS total,
                coalesce(sum(dollars), 0)::float8 AS total_dollar,
                coalesce(sum(pkr_amount), 0)::float8 AS total_pkr
           FROM b`,
        params,
      );
      const list = await pool.query(
        `WITH b AS (${base})
         SELECT * FROM b
          ORDER BY sort_group, sort_ts DESC NULLS LAST, sort_id DESC NULLS LAST, sort_id2 DESC NULLS LAST
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      );

      const totalRecords = Number(agg.rows[0]?.total ?? 0);
      const records = list.rows.map((r: any) => {
        const price = num(r.price);
        const cusRate = num(r.customer_dollar_rate);
        const dollars = num(r.dollars);
        const rate = num(r.dollar_rate);
        const e = earnings(price !== null && cusRate !== null ? price * cusRate : null,
          dollars !== null && rate !== null ? dollars * rate : null, rate);
        return {
          src: r.src,
          payid: r.payid,
          gmid: r.gmid,
          payDate: r.pay_date,
          drmId: r.com_id,
          memberId: r.member_id,
          orderId: r.order_id,
          companyName: r.cname,
          salePerson: r.name,
          dollars,
          dollarRate: rate,
          pkrAmount: num(r.pkr_amount),
          package: r.package,
          type: r.type,
          payStatus: r.pay_status,
          price,
          customerDollarRate: cusRate,
          cusDollarRate: num(r.cus_dollar_rate),
          cusProfit: num(r.cus_profit),
          earningLabel: e.label,
          earningAmount: e.amount,
          detail: r.detail,
          createAt: r.create_at,
        };
      });
      res.json({
        records,
        page,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
        grandTotals: {
          total_dollar: round2(Number(agg.rows[0]?.total_dollar ?? 0)),
          total_pkr: round2(Number(agg.rows[0]?.total_pkr ?? 0)),
        },
      });
    } catch (error) {
      console.error("[dollar-pay] full list error:", error);
      res.status(500).json({ error: "Failed to fetch full payments" });
    }
  });

  // GET /api/account/dollar-pay/full/:id/buyers?src=legacy|modern
  app.get("/api/account/dollar-pay/full/:id/buyers", view, async (req: Request, res: Response) => {
    try {
      if (String(req.query.src ?? "legacy") === "modern") return res.json({ buyers: [] });
      const { rows } = await pool.query(
        `SELECT buyer_detail FROM legacy_archive.webxl_dollar_pay
          WHERE _source_table = 'webxl_dollar_pay' AND _legacy_pk = $1`,
        [String(req.params.id).trim()],
      );
      if (!rows.length) return res.status(404).json({ error: "Payment not found" });
      res.json({ buyers: parseBuyerDetail(rows[0].buyer_detail) });
    } catch (error) {
      console.error("[dollar-pay] full buyers error:", error);
      res.status(500).json({ error: "Failed to fetch buyer detail" });
    }
  });

  // GET /api/account/dollar-pay/partial?page=&search=&pageSize=
  app.get("/api/account/dollar-pay/partial", view, async (req: Request, res: Response) => {
    try {
      const pageSize = intParam(req.query.pageSize, 10, 1, 200); // old $limit = 10
      const page = intParam(req.query.page, 1, 1, 1_000_000);
      const search = String(req.query.search ?? "").trim();
      const { base, params } = partialSql(search);

      const agg = await pool.query(`WITH b AS (${base}) SELECT count(*)::int AS total FROM b`, params);
      const list = await pool.query(
        `WITH b AS (${base})
         SELECT * FROM b
          ORDER BY sort_group, sort_ts DESC NULLS LAST, sort_id DESC NULLS LAST
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      );

      const totalRecords = Number(agg.rows[0]?.total ?? 0);
      const records = list.rows.map((r: any) => {
        const cur = num(r.current_dollar_pay);
        const curRate = num(r.current_dollar_rate);
        const abDollar = num(r.ab_pay_dollar);
        const payRate = num(r.pay_dollar_rate);
        const e = earnings(cur !== null && curRate !== null ? cur * curRate : null,
          abDollar !== null && payRate !== null ? abDollar * payRate : null, payRate);
        return {
          src: r.src,
          partialGmId: r.partial_gm_id,
          delayGmId: r.delay_gmid,
          payDate: r.delay_pay_date,
          drmId: r.com_id,
          memberId: r.member_id,
          orderId: r.order_id,
          companyName: r.cname,
          salePerson: r.name,
          currentDollarPay: cur,
          currentDollarRate: curRate,
          abPayDollar: abDollar,
          payDollarRate: payRate,
          package: r.package,
          payType: r.pay_type,
          abConfirmStatus: r.ab_confirm_status,
          statusOverridden: !!r.status_overridden,
          dollarRate: num(r.dollar_rate),
          cusDollarRate: num(r.cus_dollar_rate),
          cusProfit: num(r.cus_profit),
          earningLabel: e.label,
          earningAmount: e.amount,
        };
      });
      res.json({ records, page, pageSize, totalRecords, totalPages: Math.ceil(totalRecords / pageSize) });
    } catch (error) {
      console.error("[dollar-pay] partial list error:", error);
      res.status(500).json({ error: "Failed to fetch partial payments" });
    }
  });

  // GET /api/account/dollar-pay/partial/:id/buyers?src=legacy|modern
  app.get("/api/account/dollar-pay/partial/:id/buyers", view, async (req: Request, res: Response) => {
    try {
      if (String(req.query.src ?? "legacy") === "modern") return res.json({ buyers: [] });
      const { rows } = await pool.query(
        `SELECT buyer_detail FROM legacy_archive.webxl_verify_gm_delay_amount
          WHERE _source_table = 'webxl_verify_gm_delay_amount' AND _legacy_pk = $1`,
        [String(req.params.id).trim()],
      );
      if (!rows.length) return res.status(404).json({ error: "Partial payment not found" });
      res.json({ buyers: parseBuyerDetail(rows[0].buyer_detail) });
    } catch (error) {
      console.error("[dollar-pay] partial buyers error:", error);
      res.status(500).json({ error: "Failed to fetch buyer detail" });
    }
  });

  // POST /api/account/dollar-pay/history  { type, paymentStatus, paymentType, startDate, endDate, extraDisc? }
  app.post("/api/account/dollar-pay/history", view, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const type = String(body.type ?? "All").trim() || "All";
      const payStatus = String(body.paymentStatus ?? "All").trim() || "All";
      const paymentType = String(body.paymentType ?? "All").trim() || "All";
      // Old form had no extraDisc field: $_POST['extraDisc'] was null -> "show every row".
      const extraDisc = body.extraDisc === undefined || body.extraDisc === null ? null : String(body.extraDisc);
      const startDate = String(body.startDate ?? "").slice(0, 10);
      const endDate = String(body.endDate ?? "").slice(0, 10);

      const params: unknown[] = [];
      const lw: string[] = [];
      const mw: string[] = [
        `coalesce(ap.is_deleted, false) = false`,
        `ap.partial_receipt_id IS NULL`,
        `ap.status IN ('paid', 'refund', 'processing')`,
        MODERN_AB_NOT_LEGACY,
      ];
      const modernDate = `coalesce(ap.paid_date, (ap.created_at AT TIME ZONE 'Asia/Karachi')::date)`;
      if (type !== "All") {
        params.push(type.toLowerCase());
        lw.push(`lower(btrim(coalesce(dp.type, ''))) = $${params.length}`);
        mw.push(`lower(btrim(coalesce(ap.type, ''))) = $${params.length}`);
      }
      if (payStatus !== "All") {
        params.push(payStatus.toLowerCase());
        lw.push(`lower(btrim(coalesce(dp.pay_status, ''))) = $${params.length}`);
        mw.push(`ap.status = $${params.length}`);
      }
      if (DATE_RE.test(startDate)) {
        params.push(startDate);
        lw.push(`left(btrim(dp.pay_date), 10) >= $${params.length}`);
        mw.push(`${modernDate} >= $${params.length}::date`);
      }
      if (DATE_RE.test(endDate)) {
        params.push(endDate);
        lw.push(`left(btrim(dp.pay_date), 10) <= $${params.length}`);
        mw.push(`${modernDate} <= $${params.length}::date`);
      }
      const ci = (a: string, b: string) => `lower(btrim(${a})) = lower(btrim(${b}))`;

      const { rows } = await pool.query(
        `SELECT * FROM (
           SELECT 'legacy'::text AS src, dp.id, left(btrim(dp.pay_date), 10) AS pay_date,
                  c.com_id, dp.member_id, dp.order_id, c.cname, u.name,
                  ${NN("dp.dollars")} AS dollars, ${NN("dp.dollar_rate")} AS dollar_rate,
                  ${NN("v.discount")} AS discount, ${NN("v.extra_discount")} AS extra_discount,
                  ${NN("dp.cus_profit")} AS cus_profit, v.package, dp.type, dp.pay_status,
                  ${NN("v.price")} AS price, ${NN("v.dollar_rate")} AS customer_dollar_rate,
                  0 AS sort_group, NULL::timestamptz AS sort_ts, ${NN("dp.id")} AS sort_id
             FROM legacy_archive.webxl_dollar_pay dp
             LEFT JOIN ${A("webxl_verify_gm", "v", "dp.gmid")}
                   AND ${ci("v.com_id", "dp.com_id")} AND ${ci("v.member_id", "dp.member_id")}
                   AND ${ci("v.order_id", "dp.order_id")} AND ${ci("v.user_id", "dp.user_id")}
             LEFT JOIN ${A("webxl_company", "c", "dp.com_id")}
             LEFT JOIN ${A("webxl_user", "u", "dp.user_id")}
            ${lw.length ? `WHERE ${lw.join(" AND ")}` : ""}
           UNION ALL
           SELECT 'modern', ap.id::text, ${modernDate}::text,
                  coalesce(g.drm_id, ap.gm_drm_id), coalesce(ap.member_id, ap.ab_id, g.member_id),
                  coalesce(ap.order_id, g.order_id), coalesce(ap.company_name, g.company_name),
                  coalesce(g.sales_person_name, cu.name),
                  ap.amount_usd, coalesce(ap.dollar_rate, ap.rate),
                  g.alibaba_discount_usd, g.extra_discount_usd,
                  NULL::numeric, g.package_type, ap.type, ap.status,
                  g.amount_usd, g.dollar_rate,
                  -1, ap.created_at, ap.id::numeric
             FROM drm.ab_payments ap
             LEFT JOIN drm.gm_entries g ON g.id = ap.gm_entry_id
             LEFT JOIN drm.users cu ON cu.id = ap.created_by
            WHERE ${mw.join(" AND ")}
         ) h
         ORDER BY sort_group, sort_ts DESC NULLS LAST, sort_id DESC NULLS LAST`,
        params,
      );

      // Old handler: $n and every footer total run over ALL fetched rows; the
      // Payment Type / extraDisc conditions only decide which rows are printed.
      const totals = { dollars: 0, profit: 0, loss: 0, abDisc: 0, extraDisc: 0 };
      const records: Record<string, unknown>[] = [];
      rows.forEach((r: any, i: number) => {
        const dollars = num(r.dollars) ?? 0;
        const rate = num(r.dollar_rate);
        const price = num(r.price);
        const cusRate = num(r.customer_dollar_rate);
        const cusProfit = num(r.cus_profit) ?? 0;
        const discount = num(r.discount) ?? 0;
        const extra = num(r.extra_discount) ?? 0;
        totals.dollars += dollars;
        if (cusProfit > 0) totals.profit += cusProfit;
        else if (cusProfit < 0) totals.loss += cusProfit;
        totals.abDisc += discount;
        totals.extraDisc += extra;

        let show: boolean;
        if (paymentType === "All") show = extraDisc === "All" ? extra > 0 : true;
        else if (paymentType === "Profit") show = cusProfit > 0;
        else if (paymentType === "Loss") show = cusProfit < 0;
        else show = cusProfit === 0;
        if (!show) return;

        const e = earnings((price ?? 0) * (cusRate ?? 0), dollars * (rate ?? 0), rate);
        records.push({
          n: i + 1,
          src: r.src,
          id: r.id,
          payDate: r.pay_date,
          drmId: r.com_id,
          memberId: r.member_id,
          orderId: r.order_id,
          companyName: r.cname,
          person: r.name,
          dollars: num(r.dollars),
          dollarRate: rate,
          abDisc: num(r.discount),
          extraDisc: num(r.extra_discount),
          cusLabel: cusProfit > 0 ? "Profit" : cusProfit < 0 ? "Loss" : "Equal",
          cusProfit: round2(cusProfit),
          package: r.package,
          type: r.type,
          payStatus: r.pay_status,
          earningLabel: e.label,
          earningAmount: e.amount === null ? null : round2(e.amount),
        });
      });

      res.json({
        records,
        fetched: rows.length,
        totals: {
          dollars: round2(totals.dollars),
          abDisc: round2(totals.abDisc),
          extraDisc: round2(totals.extraDisc),
          profit: round2(totals.profit),
          loss: round2(totals.loss),
        },
      });
    } catch (error) {
      console.error("[dollar-pay] history error:", error);
      res.status(500).json({ error: "Failed to fetch dollar pay history" });
    }
  });

  // POST /api/account/dollar-pay/partial/:id/ab-status  { gmId, status, date, note }
  // Old handler UPDATEd webxl_verify_gm_delay_amount; the archive is read-only, so the
  // new value is stored in drm.dollar_pay_ab_confirm_overrides.
  app.post("/api/account/dollar-pay/partial/:id/ab-status", write, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const gmId = String(body.gmId ?? "").trim();
      const status = String(body.status ?? "").trim().toLowerCase();
      const date = String(body.date ?? "").trim().slice(0, 10);
      const note = body.note === undefined || body.note === null ? null : String(body.note).slice(0, 5000);

      if (!id || !gmId) return res.status(400).json({ error: "Partial payment id and GM id are required" });
      if (!(PAY_STATUSES as readonly string[]).includes(status)) {
        return res.status(400).json({ error: "Ab Payment Status must be paid, refund or processing" });
      }
      if (date && !DATE_RE.test(date)) return res.status(400).json({ error: "Ab Pay Date must be YYYY-MM-DD" });

      // Old: WHERE id='$payid2' AND gmid='$gmid'
      const target = await pool.query(
        `SELECT d.id, d.ab_confirm_status, o.ab_confirm_status AS override_status
           FROM legacy_archive.webxl_verify_gm_delay_amount d
           LEFT JOIN drm.dollar_pay_ab_confirm_overrides o ON o.legacy_delay_id = d.id
          WHERE d._source_table = 'webxl_verify_gm_delay_amount' AND d._legacy_pk = $1
            AND btrim(d.gmid) = $2`,
        [id, gmId],
      );
      if (!target.rows.length) return res.status(404).json({ error: "Partial payment not found" });
      const before = target.rows[0].override_status ?? target.rows[0].ab_confirm_status ?? null;

      const userId = callerUserId(req);
      let userName: string | null = null;
      if (userId) {
        const u = await pool.query(`SELECT coalesce(name, full_name, username) AS name FROM drm.users WHERE id::text = $1`, [userId]);
        userName = u.rows[0]?.name ?? null;
      }
      const isUuid = !!userId && /^[0-9a-f-]{36}$/i.test(userId);

      const { rows } = await pool.query(
        `INSERT INTO drm.dollar_pay_ab_confirm_overrides
           (legacy_delay_id, legacy_gm_id, ab_confirm_status, ab_confirm_date, ab_confirm_detail,
            ab_confirm_by, ab_confirm_by_name, archive_status)
         VALUES ($1, $2, $3, $4::date, $5, $6::uuid, $7, $8)
         ON CONFLICT (legacy_delay_id) DO UPDATE SET
           ab_confirm_status = EXCLUDED.ab_confirm_status,
           ab_confirm_date = EXCLUDED.ab_confirm_date,
           ab_confirm_detail = EXCLUDED.ab_confirm_detail,
           ab_confirm_by = EXCLUDED.ab_confirm_by,
           ab_confirm_by_name = EXCLUDED.ab_confirm_by_name,
           updated_at = now()
         RETURNING legacy_delay_id, legacy_gm_id, ab_confirm_status, ab_confirm_date::text AS ab_confirm_date,
                   ab_confirm_detail, ab_confirm_by, ab_confirm_by_name, archive_status, updated_at`,
        [id, gmId, status, date || null, note, isUuid ? userId : null, userName, target.rows[0].ab_confirm_status ?? null],
      );

      try {
        await AuditLogService.record({
          actorUserId: userId,
          action: "dollar_pay.ab_confirm_status",
          module: "dollar_system",
          entityType: "legacy_verify_gm_delay_amount",
          entityId: id,
          before: { ab_confirm_status: before },
          after: { ab_confirm_status: status, ab_confirm_date: date || null, gmId },
          req,
        } as any);
      } catch (auditErr) {
        console.warn("[dollar-pay] audit log failed:", auditErr);
      }

      res.json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("[dollar-pay] ab-status update error:", error);
      res.status(500).json({ error: "Failed to update Ab payment status" });
    }
  });
}
