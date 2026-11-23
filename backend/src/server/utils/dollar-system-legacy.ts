import type { Pool } from "pg";

const NUM = (col: string) => `coalesce(nullif(btrim(${col}), '')::numeric, 0)`;

export async function legacyDollarHistoryAvailable(pool: Pool): Promise<boolean> {
  const t = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_dollars_received_history'
    LIMIT 1
  `);
  return t.rows.length > 0;
}

type TxRow = {
  id: string;
  name: string;
  date: string;
  email: string;
  amount: number;
  rate: number;
  txType: string;
  balanceStatus?: string | null;
  balanceStatusDate?: string | null;
  screenshotUrl?: string | null;
};

function mapHistoryRow(row: Record<string, unknown>, txType: string): TxRow {
  return {
    id: String(row.id ?? row._legacy_pk ?? ""),
    name: String(row.buyer_main ?? row.buyer_reference ?? "Buyer").trim() || "Buyer",
    date: row.buy_date ? String(row.buy_date).trim() : row.create_at ? String(row.create_at).trim() : "",
    email: String(row.buyer_reference_paypal_email ?? row.buyer_account_no ?? "").trim(),
    amount: Number(String(row.dollars ?? "").replace(/[^\d.-]/g, "")) || 0,
    rate: Number(String(row.dollar_rate ?? "").replace(/[^\d.-]/g, "")) || 0,
    txType,
    balanceStatus: row.acc_pay_status ? String(row.acc_pay_status) : null,
    balanceStatusDate: row.acc_pay_date ? String(row.acc_pay_date) : null,
    screenshotUrl: row.screen_shot ? String(row.screen_shot) : null,
  };
}

/**
 * Old DRM "Current Day Transactions" tabs (dollarsystem.php + func.php), read-only:
 *   Balance  = webxl_dollar_buyer_dollars  show_ab='Show' AND dollars != 0   (remaining balance)
 *   Buy      = webxl_dollars_received_history show_ab='Show' AND DATE(create_at)=today
 *   Sell     = webxl_dollar_pay DATE(create_at)=today
 *   Martini  = webxl_dollars_received_history show_ab='Not Show'
 *   Not Used = webxl_dollars_received_history show_ab='Not Used'
 * "today" is Pakistan date (old timestamps are Pakistan wall-clock text).
 * Rows carry source:'legacy' so the page can hide new-app actions on them.
 */
export async function fetchLegacyDollarDailyTx(pool: Pool): Promise<{
  balance: TxRow[];
  buy: TxRow[];
  martini: TxRow[];
  notUsed: TxRow[];
  sell: TxRow[];
}> {
  const num = (col: string) =>
    `COALESCE(substring(regexp_replace(replace(${col}, ',', ''), '[.]{2,}', '.', 'g') from '-?[0-9]+(?:[.][0-9]+)?')::numeric, 0)::float8`;
  const today = `to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD')`;
  const cols = (t: string, status: string) => `
    'legacy-' || ${t}._legacy_pk AS id, COALESCE(u.name, 'Buyer') AS name,
    left(COALESCE(NULLIF(${t}.buy_date, ''), ${t}.create_at), 10) AS date,
    COALESCE(NULLIF(${t}.buyer_reference_paypal_email, ''), ${t}.buyer_account_no, '') AS email,
    ${num(`${t}.dollars`)} AS amount, ${num(`${t}.dollar_rate`)} AS rate,
    ${status} AS "balanceStatus", 'legacy' AS source`;
  const userJoin = (t: string) =>
    `LEFT JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = ${t}.buyer_main`;

  const [balance, buy, martini, notUsed, sell] = await Promise.all([
    pool.query(`SELECT ${cols("d", "d.show_ab")}, 'balance' AS "txType"
                  FROM legacy_archive.webxl_dollar_buyer_dollars d ${userJoin("d")}
                 WHERE btrim(d.show_ab) = 'Show' AND ${num("d.dollars")} <> 0
                   -- slots copied into drm.dollar_buying are listed as new-app rows
                   AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                                    WHERE m.legacy_table = 'webxl_dollar_buyer_dollars' AND m.legacy_id = d._legacy_pk)
                 ORDER BY d.buy_date DESC`),
    pool.query(`SELECT ${cols("h", "h.show_ab")}, 'buy' AS "txType"
                  FROM legacy_archive.webxl_dollars_received_history h ${userJoin("h")}
                 WHERE btrim(h.show_ab) = 'Show' AND left(h.create_at, 10) = ${today}
                 ORDER BY h.create_at DESC`),
    pool.query(`SELECT ${cols("h", "h.show_ab")}, 'martini' AS "txType", NULLIF(h.screen_shot, '') AS "screenshotUrl"
                  FROM legacy_archive.webxl_dollars_received_history h ${userJoin("h")}
                 WHERE btrim(h.show_ab) IN ('Not Show', 'Not-Show')
                 ORDER BY h.buy_date DESC`),
    pool.query(`SELECT ${cols("h", "h.show_ab")}, 'notUsed' AS "txType"
                  FROM legacy_archive.webxl_dollars_received_history h ${userJoin("h")}
                 WHERE btrim(h.show_ab) = 'Not Used'
                 ORDER BY h.buy_date DESC`),
    pool.query(`SELECT 'legacy-' || p._legacy_pk AS id, COALESCE(c.cname, 'Payment') AS name,
                       left(p.create_at, 10) AS date, COALESCE(p.order_id, '') AS email,
                       ${num("p.dollars")} AS amount, ${num("p.dollar_rate")} AS rate,
                       'sell' AS "txType", 'legacy' AS source
                  FROM legacy_archive.webxl_dollar_pay p
                  LEFT JOIN legacy_archive.webxl_company c ON c._source_table = 'webxl_company' AND c._legacy_pk = p.com_id
                 WHERE left(p.create_at, 10) = ${today}
                 ORDER BY p.create_at DESC`),
  ]);
  return {
    balance: balance.rows,
    buy: buy.rows,
    martini: martini.rows,
    notUsed: notUsed.rows,
    sell: sell.rows,
  };
}

export async function fetchLegacyMonthBuyingUsd(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT coalesce(sum(${NUM("dollars")}), 0)::float AS usd
     FROM legacy_archive.webxl_dollars_received_history
     WHERE date_trunc('month', NULLIF(left(coalesce(buy_date, create_at), 10), '')::date)
           = date_trunc('month', CURRENT_DATE)`,
  );
  return Number(rows[0]?.usd || 0);
}

export async function modernDollarBuyingEmpty(pool: Pool): Promise<boolean> {
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM drm.dollar_buying`);
  return (rows[0]?.c ?? 0) === 0;
}

/** Legacy `webxl_verify_gm` archive — source of truth for Dollar System Full tab. */
export async function legacyVerifyGmAvailable(pool: Pool): Promise<boolean> {
  const t = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_verify_gm'
    LIMIT 1
  `);
  return t.rows.length > 0;
}

export type DollarFullPaymentsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  start?: string;
  end?: string;
  type?: string;
};

export type DollarFullPaymentsResult = {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; nc: number; rc: number; ec: number };
  totals: { usd: number; pkr: number };
};

/** Mirrors func.php `page_dollar_gm` ($32575–32628): Account+HOD approved, AB pay pending, not installment-behalf. */
function legacyFullGmKindSql() {
  return `CASE
    WHEN btrim(v.renwal::text) = '1' THEN 'New'
    WHEN btrim(v.renwal::text) = '0' THEN 'Rc'
    WHEN btrim(v.renwal::text) = '2' THEN 'Ec'
    WHEN btrim(v.renwal::text) = '3' THEN 'Rc-Up'
    ELSE 'New' END`;
}

function legacyFullUsdSql() {
  return `CASE WHEN btrim(coalesce(v.acc_pay_status, '')) = 'Customer Paid'
    THEN ${NUM("v.extra_discount")}
    ELSE ${NUM("v.price")} END`;
}

function legacyFullPkrSql() {
  return `CASE WHEN btrim(coalesce(v.acc_pay_status, '')) = 'Customer Paid'
    THEN ${NUM("v.extra_pkr_discount")}
    ELSE ${NUM("v.amount")} END`;
}

export async function fetchLegacyDollarFullPayments(
  pool: Pool,
  opts: DollarFullPaymentsQuery,
): Promise<DollarFullPaymentsResult> {
  const { page, pageSize, search = "", start = "", end = "", type = "all" } = opts;
  const params: unknown[] = [];
  const where: string[] = [
    `coalesce(v.webxl_pay_status, '') = 'Pending'`,
    `coalesce(v.acc_disc_status, '') = 'Approved'`,
    `coalesce(v.ceo_disc_status, '') = 'Approved'`,
    `(v.webxl_behalf IS DISTINCT FROM 'Installment')`,
  ];

  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    params.push(start);
    where.push(`left(v.create_date, 10) >= $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    params.push(end);
    where.push(`left(v.create_date, 10) <= $${params.length}`);
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(c.cname ILIKE ${p} OR c.com_id ILIKE ${p} OR v.member_id ILIKE ${p} OR v.order_id ILIKE ${p})`);
  }

  const gmKind = legacyFullGmKindSql();
  const usdExpr = legacyFullUsdSql();
  const pkrExpr = legacyFullPkrSql();
  const baseFrom = `
    FROM legacy_archive.webxl_verify_gm v
    LEFT JOIN legacy_archive.webxl_company c ON v.com_id::text = c.id::text
    LEFT JOIN legacy_archive.webxl_user u ON v.user_id::text = u.user_id::text
    WHERE ${where.join(" AND ")}`;

  const typeWhere =
    type === "New" ? "gm_kind = 'New'"
    : type === "Rc" ? "gm_kind IN ('Rc', 'Rc-Up')"
    : type === "Ec" ? "gm_kind = 'Ec'"
    : "true";

  const aggRes = await pool.query(
    `WITH raw AS (
       SELECT v.id, ${gmKind} AS gm_kind, ${usdExpr} AS usd_amt, ${pkrExpr} AS pkr_amt
       ${baseFrom}
     ),
     b AS (SELECT * FROM raw)
     SELECT count(*)::int AS all_count,
            count(*) FILTER (WHERE gm_kind = 'New')::int AS nc,
            count(*) FILTER (WHERE gm_kind IN ('Rc', 'Rc-Up'))::int AS rc,
            count(*) FILTER (WHERE gm_kind = 'Ec')::int AS ec,
            count(*) FILTER (WHERE ${typeWhere})::int AS total,
            coalesce(sum(usd_amt) FILTER (WHERE ${typeWhere}), 0)::float AS usd,
            coalesce(sum(pkr_amt) FILTER (WHERE ${typeWhere}), 0)::float AS pkr
       FROM b`,
    params,
  );
  const agg = aggRes.rows[0] || {};

  const listRes = await pool.query(
    `WITH raw AS (
       SELECT
         v.id,
         c.com_id,
         v.create_date,
         c.cname,
         u.name AS sale_person,
         ${usdExpr} AS dollar,
         ${NUM("v.customer_dollars")} AS customer_dollar_raw,
         ${pkrExpr} AS pkr,
         ${NUM("v.dollar_rate")} AS rate,
         ${NUM("v.extra_discount")} AS ex_disc,
         ${NUM("v.extra_pkr_discount")} AS ex_disc_pkr,
         v.member_id,
         v.order_id,
         v.package,
         ${gmKind} AS gm_kind,
         v.expire_date,
         v.droupout,
         v.status
       ${baseFrom}
     )
     SELECT
       id::text,
       coalesce(com_id, member_id, id::text) AS "drmId",
       create_date AS "date",
       cname AS "company",
       sale_person AS "salePerson",
       dollar,
       CASE WHEN customer_dollar_raw > 0 THEN customer_dollar_raw ELSE dollar END AS "customerDollar",
       pkr,
       rate,
       ex_disc AS "exDisc",
       ex_disc_pkr AS "exDiscPkr",
       member_id AS "memberId",
       order_id AS "orderId",
       package,
       gm_kind AS "type",
       expire_date AS "expireDate",
       nullif(btrim(droupout::text), '') AS "dropout",
       status
     FROM raw
     WHERE ${typeWhere}
     ORDER BY id::bigint DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return {
    data: listRes.rows,
    total: Number(agg.total || 0),
    page,
    pageSize,
    counts: {
      all: Number(agg.all_count || 0),
      nc: Number(agg.nc || 0),
      rc: Number(agg.rc || 0),
      ec: Number(agg.ec || 0),
    },
    totals: { usd: Number(agg.usd || 0), pkr: Number(agg.pkr || 0) },
  };
}

export async function countLegacyDollarFullPayments(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    SELECT count(*)::int AS c
    FROM legacy_archive.webxl_verify_gm v
    WHERE coalesce(v.webxl_pay_status, '') = 'Pending'
      AND coalesce(v.acc_disc_status, '') = 'Approved'
      AND coalesce(v.ceo_disc_status, '') = 'Approved'
      AND (v.webxl_behalf IS DISTINCT FROM 'Installment')
  `);
  return Number(rows[0]?.c ?? 0);
}

export type DollarPartialPaymentsQuery = DollarFullPaymentsQuery & {
  mode: "cleared" | "pending";
};

export type DollarPartialPaymentsResult = Omit<DollarFullPaymentsResult, "counts"> & {
  counts?: { all: number; nc: number; rc: number; ec: number };
};

const LEGACY_PARTIAL_INST = `
  SELECT
    count(*) FILTER (WHERE coalesce(d.delay_dollar_status, '') = 'Installment')::int AS inst_total,
    count(*) FILTER (
      WHERE coalesce(d.delay_dollar_status, '') = 'Installment'
        AND coalesce(d.acc_status, '') IN ('Paid', 'Recoverd')
    )::int AS inst_paid
  FROM legacy_archive.webxl_verify_gm_delay_amount d
  WHERE d.gmid::text = v.id::text
`;

/** Cleared = Full jaisi (Account+HOD approved, AB pending) + Installment; pending = abhi installments collect ho rahi hain. */
function legacyPartialModeSql(mode: "cleared" | "pending"): string[] {
  if (mode === "cleared") {
    return [
      `coalesce(v.webxl_pay_status, '') = 'Pending'`,
      `coalesce(v.acc_disc_status, '') = 'Approved'`,
      `coalesce(v.ceo_disc_status, '') = 'Approved'`,
      `coalesce(v.webxl_behalf, '') = 'Installment'`,
    ];
  }
  return [
    `coalesce(v.alibaba, '') = 'Pending'`,
    `coalesce(v.webxl_behalf, '') = 'Installment'`,
    `coalesce(v.ceo_disc_status, '') <> 'Rejected'`,
    `coalesce(v.acc_disc_status, '') <> 'Rejected'`,
    `coalesce(v.acc_disc_status, '') <> 'Refund'`,
  ];
}

export async function fetchLegacyDollarPartialPayments(
  pool: Pool,
  opts: DollarPartialPaymentsQuery,
): Promise<DollarPartialPaymentsResult> {
  const { page, pageSize, search = "", start = "", end = "", type = "all", mode } = opts;
  const params: unknown[] = [];
  const where = [...legacyPartialModeSql(mode)];

  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    params.push(start);
    where.push(`left(coalesce(v.create_date, v.create_request, ''), 10) >= $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    params.push(end);
    where.push(`left(coalesce(v.create_date, v.create_request, ''), 10) <= $${params.length}`);
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(c.cname ILIKE ${p} OR c.com_id ILIKE ${p} OR v.member_id ILIKE ${p} OR v.order_id ILIKE ${p})`);
  }

  const instHaving =
    mode === "cleared"
      ? `inst.inst_total > 0 AND inst.inst_paid = inst.inst_total`
      : `inst.inst_total > 0 AND inst.inst_paid < inst.inst_total`;

  const gmKind = legacyFullGmKindSql();
  const usdExpr = legacyFullUsdSql();
  const pkrExpr = legacyFullPkrSql();

  const baseCte = `
    WITH base AS (
      SELECT
        v.id,
        c.com_id,
        coalesce(v.create_date, v.create_request) AS create_date,
        c.cname,
        u.name AS sale_person,
        ${usdExpr} AS dollar,
        ${NUM("v.customer_dollars")} AS customer_dollar_raw,
        ${pkrExpr} AS pkr,
        ${NUM("v.dollar_rate")} AS rate,
        ${NUM("v.discount")} AS discount,
        ${NUM("v.extra_discount")} AS ex_disc,
        ${NUM("v.extra_pkr_discount")} AS ex_disc_pkr,
        v.member_id,
        v.order_id,
        v.package,
        ${gmKind} AS gm_kind,
        v.expire_date,
        v.droupout,
        v.status,
        v.acc_disc_status,
        v.ceo_disc_status,
        v.pay_date,
        inst.inst_total,
        inst.inst_paid,
        ${mode === "cleared" ? "true" : "false"} AS fully_paid
      FROM legacy_archive.webxl_verify_gm v
      LEFT JOIN legacy_archive.webxl_company c ON v.com_id::text = c.id::text
      LEFT JOIN legacy_archive.webxl_user u ON v.user_id::text = u.user_id::text
      LEFT JOIN LATERAL (${LEGACY_PARTIAL_INST}) inst ON true
      WHERE ${where.join(" AND ")}
        AND ${instHaving}
    )`;

  const typeWhere =
    type === "New" ? "gm_kind = 'New'"
    : type === "Rc" ? "gm_kind IN ('Rc', 'Rc-Up')"
    : type === "Ec" ? "gm_kind = 'Ec'"
    : "true";

  const aggRes = await pool.query(
    `${baseCte}
     SELECT count(*) FILTER (WHERE ${typeWhere})::int AS total,
            coalesce(sum(dollar) FILTER (WHERE ${typeWhere}), 0)::float AS usd,
            coalesce(sum(pkr) FILTER (WHERE ${typeWhere}), 0)::float AS pkr
       FROM base`,
    params,
  );
  const agg = aggRes.rows[0] || {};

  const listRes = await pool.query(
    `${baseCte}
     SELECT
       id::text,
       coalesce(com_id, member_id, id::text) AS "drmId",
       create_date AS "date",
       cname AS "company",
       sale_person AS "salePerson",
       dollar,
       CASE WHEN customer_dollar_raw > 0 THEN customer_dollar_raw ELSE dollar END AS "customerDollar",
       pkr,
       rate,
       discount,
       ex_disc AS "exDisc",
       ex_disc_pkr AS "exDiscPkr",
       member_id AS "memberId",
       order_id AS "orderId",
       package,
       gm_kind AS "type",
       expire_date AS "expireDate",
       nullif(btrim(droupout::text), '') AS "dropout",
       status AS "paymentStatus",
       CASE WHEN btrim(coalesce(acc_disc_status, '')) = 'Approved' THEN 'Done' ELSE acc_disc_status END AS "accountantStatus",
       ceo_disc_status AS "hodStatus",
       pay_date AS "payDate",
       inst_total AS "installmentsTotal",
       inst_paid AS "installmentsCollected",
       fully_paid AS "fullyPaid"
     FROM base
     WHERE ${typeWhere}
     ORDER BY id::bigint DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return {
    data: listRes.rows,
    total: Number(agg.total || 0),
    page,
    pageSize,
    totals: { usd: Number(agg.usd || 0), pkr: Number(agg.pkr || 0) },
  };
}

export async function countLegacyDollarPartialCleared(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS c
     FROM legacy_archive.webxl_verify_gm v
     LEFT JOIN LATERAL (${LEGACY_PARTIAL_INST}) inst ON true
     WHERE coalesce(v.webxl_pay_status, '') = 'Pending'
       AND coalesce(v.acc_disc_status, '') = 'Approved'
       AND coalesce(v.ceo_disc_status, '') = 'Approved'
       AND coalesce(v.webxl_behalf, '') = 'Installment'
       AND inst.inst_total > 0
       AND inst.inst_paid = inst.inst_total`,
  );
  return Number(rows[0]?.c ?? 0);
}

export async function countLegacyDollarPartialPending(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS c
     FROM legacy_archive.webxl_verify_gm v
     LEFT JOIN LATERAL (${LEGACY_PARTIAL_INST}) inst ON true
     WHERE coalesce(v.alibaba, '') = 'Pending'
       AND coalesce(v.webxl_behalf, '') = 'Installment'
       AND coalesce(v.ceo_disc_status, '') <> 'Rejected'
       AND coalesce(v.acc_disc_status, '') NOT IN ('Rejected', 'Refund')
       AND inst.inst_total > 0
       AND inst.inst_paid < inst.inst_total`,
  );
  return Number(rows[0]?.c ?? 0);
}

/** Modern fallback when legacy archive is absent — pending Alibaba pay only. */
export function modernDollarFullPaymentsWhere(params: unknown[], extra: { search?: string; start?: string; end?: string } = {}) {
  const where: string[] = [
    "coalesce(g.is_deleted, false) = false",
    "coalesce(g.is_loan, 0) = 0",
    "coalesce(g.is_partial_payment, 0) = 0",
    `lower(coalesce(g.hod_status, '')) IN ('approved', 'approve')`,
    `lower(coalesce(g.accountant_status, '')) IN ('approved', 'approve')`,
    `lower(coalesce(g.alibaba_status, 'pending')) IN ('pending', 'no', '')`,
    `NOT EXISTS (SELECT 1 FROM drm.ab_payments ap
                  WHERE ap.gm_entry_id = g.id AND coalesce(ap.is_deleted, false) = false)`,
  ];
  const { search = "", start = "", end = "" } = extra;
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    params.push(start);
    where.push(`g.created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    params.push(end);
    where.push(`g.created_at < ($${params.length}::date + 1)`);
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(g.drm_id ILIKE ${p} OR g.company_name ILIKE ${p} OR g.sales_person_name ILIKE ${p}
                 OR g.member_id ILIKE ${p} OR g.order_id ILIKE ${p})`);
  }
  return where;
}

export type LegacyDollarAbLiabilities = {
  fullOnlinePaidUsd: number;
  fullOnlinePaidPkr: number;
  fullCashReceivedUsd: number;
  fullCashReceivedPkr: number;
  fullExtraDiscountUsd: number;
  fullExtraDiscountPkr: number;
  fullOnlinePaidCount: number;
  fullCashReceivedCount: number;
  partialOnlinePaidUsd: number;
  partialOnlinePaidPkr: number;
  partialCashReceivedUsd: number;
  partialCashReceivedPkr: number;
  partialInstallmentExtraDiscountUsd: number;
  partialInstallmentExtraDiscountPkr: number;
  partialOnlinePaidCount: number;
  partialCashReceivedCount: number;
  uncompletedPartialsCount: number;
  uncompletedOnlinePaidUsd: number;
  uncompletedOnlinePaidPkr: number;
  uncompletedCashReceivedUsd: number;
  uncompletedCashReceivedPkr: number;
  uncompletedExtraDiscountUsd: number;
  uncompletedExtraDiscountPkr: number;
  vendorOutstandingUsd: number;
  vendorOutstandingPkr: number;
  vendorOutstandingCount: number;
};

const FULL_LIABILITY_BASE = `
  coalesce(v.webxl_pay_status, '') = 'Pending'
  AND coalesce(v.acc_disc_status, '') = 'Approved'
  AND coalesce(v.ceo_disc_status, '') = 'Approved'
  AND (v.webxl_behalf IS DISTINCT FROM 'Installment')`;

const PARTIAL_GM_LIABILITY_BASE = `
  coalesce(v.webxl_pay_status, '') = 'Pending'
  AND coalesce(v.acc_disc_status, '') = 'Approved'
  AND coalesce(v.ceo_disc_status, '') = 'Approved'
  AND coalesce(v.webxl_behalf, '') = 'Installment'`;

/** Mirrors dollarsystem.php AB Liabilities block + func.php cash_in_hand_* helpers. */
export type WalletPeriod = {
  filter: string;
  start: string;
  end: string;
  loanStart: string;
  loanEnd: string;
  label: string;
};

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Same windows as func.php AutoQueSystemDate (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar). */
function autoQueSystemRange(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const today = isoDate(ref);
  const ranges = [
    { start: `${y}-04-01`, end: `${y}-06-30` },
    { start: `${y}-07-01`, end: `${y}-09-30` },
    { start: `${y}-10-01`, end: `${y}-12-31` },
    { start: `${y}-01-01`, end: `${y}-03-31` },
  ];
  return ranges.find((r) => today >= r.start && today <= r.end) ?? ranges[0];
}

function calendarQuarterContaining(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  if (m <= 3) return { start: `${y}-01-01`, end: `${y}-03-31` };
  if (m <= 6) return { start: `${y}-04-01`, end: `${y}-06-30` };
  if (m <= 9) return { start: `${y}-07-01`, end: `${y}-09-30` };
  return { start: `${y}-10-01`, end: `${y}-12-31` };
}

function lastCalendarQuarter(ref: Date): { start: string; end: string } {
  const cq = calendarQuarterContaining(ref);
  const dayBefore = new Date(`${cq.start}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return calendarQuarterContaining(dayBefore);
}

function lastSemesterRange(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  if (m >= 4 && m <= 9) return { start: `${y - 1}-10-01`, end: `${y}-03-31` };
  if (m >= 10) return { start: `${y}-04-01`, end: `${y}-09-30` };
  return { start: `${y - 1}-04-01`, end: `${y - 1}-09-30` };
}

export function resolveWalletPeriod(filter: string, ref = new Date()): WalletPeriod {
  const f = (filter || "CQ").toUpperCase();
  const primary =
    f === "LQ" ? lastCalendarQuarter(ref)
    : f === "LS" ? lastSemesterRange(ref)
    : f === "LY" ? { start: `${ref.getFullYear() - 1}-01-01`, end: `${ref.getFullYear() - 1}-12-31` }
    : autoQueSystemRange(ref);
  const dayBeforePrimary = new Date(`${primary.start}T12:00:00`);
  dayBeforePrimary.setDate(dayBeforePrimary.getDate() - 1);
  const loan = f === "CQ" ? lastCalendarQuarter(ref) : lastCalendarQuarter(dayBeforePrimary);
  const label =
    f === "LQ" ? "Last Q"
    : f === "LS" ? "Last S"
    : f === "LY" ? "Last Y"
    : "Current Q";
  return {
    filter: f,
    start: primary.start,
    end: primary.end,
    loanStart: loan.start,
    loanEnd: loan.end,
    label: `${label} (${primary.start} – ${primary.end})`,
  };
}

export type LegacyWalletStats = {
  availableCash: number;
  availableCashPkr: number;
  availableLoan: number;
  availableLoanPkr: number;
  requiredToPay: number;
  cashInHand: number;
  /** webxl_recoverd_ab_payments (bottom green — legacy page is all-time). */
  cashRecovered: number;
  dollarRecovered: number;
  /** Top links: pending Delay recovery (webxl_recover_dollars*). */
  recoveryDollarsPending: number;
  recoveryCashPending: number;
  partialDollarsRecovery: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dollarBalance: number;
};

/** Wallets card — dollarsystem.php left column (buyer pool, required AB pay, cash in hand). */
export async function computeLegacyWalletStats(pool: Pool, period: WalletPeriod): Promise<LegacyWalletStats> {
  const { start, end, loanStart, loanEnd } = period;
  const between = (col: string) => `left(coalesce(${col}, ''), 10) >= $1 AND left(coalesce(${col}, ''), 10) <= $2`;

  const [
    cBal,
    lBal,
    reqFull,
    reqPart,
    dolRec,
    cashRecLink,
    partRec,
    cashRecBottom,
    dollarRecBottom,
    chequeDollar,
    chequeRecovery,
    closingLq,
    martiniPaidPkr,
  ] = await Promise.all([
    pool.query(
      `SELECT coalesce(sum(${NUM("dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("pkr_amount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_dollar_buyer_dollars
        WHERE coalesce(show_ab, '') = 'Show' AND ${between("buy_date")}`,
      [start, end],
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("pkr_amount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_dollar_buyer_dollars
        WHERE coalesce(show_ab, '') = 'Show' AND ${between("buy_date")}`,
      [loanStart, loanEnd],
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("price")}), 0)::float AS usd
         FROM legacy_archive.webxl_verify_gm
        WHERE coalesce(webxl_pay_status, '') = 'Pending'
          AND coalesce(acc_disc_status, '') = 'Approved'
          AND coalesce(ceo_disc_status, '') = 'Approved'
          AND (webxl_behalf IS DISTINCT FROM 'Installment')`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("current_dollar_pay")}), 0)::float AS usd
         FROM legacy_archive.webxl_verify_gm_delay_amount
        WHERE coalesce(cash_status, '') <> 'Customer Paid'
          AND coalesce(delay_dollar_status, '') = 'Installment'
          AND coalesce(acc_status, '') = 'Paid'
          AND coalesce(alibaba, '') = 'Pending'
          AND (ab_confirm_status IS NULL OR btrim(ab_confirm_status::text) = '')`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("d.delay_dollars")}), 0)::float AS usd
         FROM legacy_archive.webxl_verify_gm_delay_amount d
         LEFT JOIN legacy_archive.webxl_verify_gm g ON d.gmid::text = g.id::text
        WHERE coalesce(d.delay_dollar_status, '') = 'Delay'
          AND coalesce(d.acc_status, '') = 'Pending'
          AND coalesce(g.acc_disc_status, '') = 'Approved'
          AND coalesce(g.ceo_disc_status, '') = 'Approved'`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("d.delay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm_delay_amount d
         LEFT JOIN legacy_archive.webxl_verify_gm g ON d.gmid::text = g.id::text
        WHERE coalesce(d.delay_dollar_status, '') = 'Delay'
          AND coalesce(d.acc_status, '') = 'Pending'
          AND coalesce(g.acc_disc_status, '') = 'Approved'
          AND coalesce(g.ceo_disc_status, '') = 'Approved'`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("delay_dollars")}), 0)::float AS usd
         FROM legacy_archive.webxl_verify_gm_delay_amount
        WHERE coalesce(delay_dollar_status, '') = 'Installment'
          AND coalesce(acc_status, '') = 'Pending'`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("pkr_balance")}), 0)::float AS pkr
         FROM legacy_archive.webxl_recoverd_ab_payments
        WHERE coalesce(recovery_type, '') = 'Cash'`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("dollar_balance")}), 0)::float AS usd
         FROM legacy_archive.webxl_recoverd_ab_payments
        WHERE coalesce(recovery_type, '') = 'Dollar'`,
    ),
    pool.query(
      `SELECT coalesce(sum(${NUM("remain_amount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_cheque_system
        WHERE coalesce(cheque_type, '') = 'For Dollar'
          AND coalesce(cheque_status, '') = 'used'
          AND ${between("cheque_date")}
          AND ${NUM("remain_amount")} <> 0`,
      [start, end],
    ).catch(() => ({ rows: [{ pkr: 0 }] })),
    pool.query(
      `SELECT coalesce(sum(${NUM("remain_amount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_cheque_system
        WHERE coalesce(cheque_type, '') = 'Recovery'
          AND coalesce(cheque_status, '') = 'used'
          AND ${between("cheque_date")}
          AND ${NUM("remain_amount")} <> 0`,
      [start, end],
    ).catch(() => ({ rows: [{ pkr: 0 }] })),
    pool.query(
      `SELECT coalesce(sum(${NUM("remain_amount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_cheque_system
        WHERE coalesce(cheque_type, '') = 'Closing'
          AND coalesce(cheque_status, '') = 'used'
          AND coalesce(closing_status, '') = 'quarter'
          AND ${between("cheque_date")}
          AND ${NUM("remain_amount")} <> 0`,
      [start, end],
    ).catch(() => ({ rows: [{ pkr: 0 }] })),
    pool.query(
      `SELECT coalesce(sum(${NUM("acc_pay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_dollars_received_history
        WHERE coalesce(show_ab, '') = 'Show'
          AND ${between("acc_pay_date")}`,
      [start, end],
    ),
  ]);

  // Cash in hand (PKR): func.php dollarsystem.php formula — simplified single-query parts
  const cashParts = await pool.query(
    `SELECT
      (SELECT coalesce(sum(${NUM("amount")}), 0) FROM legacy_archive.webxl_verify_gm
        WHERE coalesce(acc_pay_status, '') IN ('Cash Received', 'Online Paid')
          AND coalesce(acc_disc_status, '') = 'Approved'
          AND left(coalesce(create_date, ''), 10) >= $1 AND left(coalesce(create_date, ''), 10) <= $2
          AND (webxl_behalf IS DISTINCT FROM 'Installment' AND webxl_behalf IS DISTINCT FROM 'Delay')) AS full_pkr,
      (SELECT coalesce(sum(${NUM("current_pkr")}), 0) FROM legacy_archive.webxl_verify_gm_delay_amount
        WHERE coalesce(delay_dollar_status, '') = 'Installment' AND coalesce(acc_status, '') = 'Paid'
          AND coalesce(cash_status, '') IN ('Cash Received', 'Online Paid')
          AND left(coalesce(current_pay_date, ''), 10) >= $1 AND left(coalesce(current_pay_date, ''), 10) <= $2) AS inst_a,
      (SELECT coalesce(sum(${NUM("current_pkr")}), 0) FROM legacy_archive.webxl_verify_gm_delay_amount
        WHERE coalesce(delay_dollar_status, '') = 'Installment' AND coalesce(acc_status, '') = 'Paid'
          AND coalesce(cash_status, '') IN ('Cash Received', 'Online Paid')
          AND left(coalesce(current_pay_date, ''), 10) >= $1 AND left(coalesce(current_pay_date, ''), 10) <= $2) AS inst_b`,
    [start, end],
  );
  const cp = cashParts.rows[0] || {};
  const chequePkr =
    Number(chequeDollar.rows[0]?.pkr || 0) +
    Number(chequeRecovery.rows[0]?.pkr || 0) +
    Number(closingLq.rows[0]?.pkr || 0);
  const cashInHand = Math.round(
    Number(cp.full_pkr || 0) +
      Number(cp.inst_a || 0) +
      Number(cp.inst_b || 0) +
      chequePkr -
      Number(martiniPaidPkr.rows[0]?.pkr || 0),
  );

  const availableCash = Number(cBal.rows[0]?.usd || 0);
  return {
    availableCash,
    availableCashPkr: Number(cBal.rows[0]?.pkr || 0),
    availableLoan: Number(lBal.rows[0]?.usd || 0),
    availableLoanPkr: Number(lBal.rows[0]?.pkr || 0),
    requiredToPay: Number(reqFull.rows[0]?.usd || 0) + Number(reqPart.rows[0]?.usd || 0),
    cashInHand,
    cashRecovered: Number(cashRecBottom.rows[0]?.pkr || 0),
    dollarRecovered: Number(dollarRecBottom.rows[0]?.usd || 0),
    recoveryDollarsPending: Number(dolRec.rows[0]?.usd || 0),
    recoveryCashPending: Number(cashRecLink.rows[0]?.pkr || 0),
    partialDollarsRecovery: Number(partRec.rows[0]?.usd || 0),
    periodLabel: period.label,
    periodStart: start,
    periodEnd: end,
    dollarBalance: availableCash,
  };
}

export async function computeLegacyDollarAbLiabilities(pool: Pool): Promise<LegacyDollarAbLiabilities> {
  const fullMode = async (accPayStatus: string) => {
    const isCust = accPayStatus === "Customer Paid";
    const usdExpr = isCust ? NUM("v.extra_discount") : NUM("v.customer_dollars");
    const pkrExpr = isCust ? NUM("v.extra_pkr_discount") : NUM("v.amount");
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${usdExpr}), 0)::float AS usd,
              coalesce(sum(${pkrExpr}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm v
        WHERE ${FULL_LIABILITY_BASE}
          AND coalesce(v.acc_pay_status, '') = $1`,
      [accPayStatus],
    );
    return rows[0] || { c: 0, usd: 0, pkr: 0 };
  };

  const partialGmMode = async (accPayStatus: string) => {
    if (accPayStatus === "Extra Discount Paid") {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS c,
                coalesce(sum(${NUM("v.extra_discount")}), 0)::float AS usd,
                coalesce(sum(${NUM("v.extra_pkr_discount")}), 0)::float AS pkr
           FROM legacy_archive.webxl_verify_gm v
          WHERE ${PARTIAL_GM_LIABILITY_BASE}
            AND coalesce(v.acc_pay_status, '') IN ('Online Paid', 'Cash Received', 'Customer Paid')
            AND ${NUM("v.extra_discount")} > 0`,
      );
      return rows[0] || { c: 0, usd: 0, pkr: 0 };
    }
    const isCust = accPayStatus === "Customer Paid";
    const usdExpr = isCust ? NUM("v.extra_discount") : NUM("v.customer_dollars");
    const pkrExpr = isCust ? NUM("v.extra_pkr_discount") : NUM("v.amount");
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${usdExpr}), 0)::float AS usd,
              coalesce(sum(${pkrExpr}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm v
        WHERE ${PARTIAL_GM_LIABILITY_BASE}
          AND coalesce(v.acc_pay_status, '') = $1`,
      [accPayStatus],
    );
    return rows[0] || { c: 0, usd: 0, pkr: 0 };
  };

  const [
    fullOnline,
    fullCash,
    fullExtra,
    partialOnline,
    partialCash,
    partialExtra,
    uncOnline,
    uncCash,
    uncExtra,
    vendor,
  ] = await Promise.all([
    fullMode("Online Paid"),
    fullMode("Cash Received"),
    pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${NUM("extra_discount")}), 0)::float AS usd,
              coalesce(sum(${NUM("extra_pkr_discount")}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm
        WHERE coalesce(acc_pay_status, '') IN ('Online Paid', 'Cash Received', 'Customer Paid')
          AND ${NUM("extra_discount")} > 0
          AND coalesce(acc_disc_status, '') = 'Approved'
          AND coalesce(ceo_disc_status, '') = 'Approved'
          AND coalesce(webxl_pay_status, '') = 'Pending'
          AND (webxl_behalf IS DISTINCT FROM 'Installment')`,
    ).then((r) => r.rows[0]),
    partialGmMode("Online Paid"),
    partialGmMode("Cash Received"),
    partialGmMode("Extra Discount Paid"),
    pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${NUM("d2.delay_dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("d2.delay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm_delay_amount d2
         INNER JOIN legacy_archive.webxl_verify_gm g ON d2.gmid::text = g.id::text
        WHERE coalesce(d2.delay_dollar_status, '') = 'Installment'
          AND coalesce(d2.acc_status, '') IN ('Paid', 'Recoverd')
          AND g.id::text IN (
            SELECT d.gmid::text FROM legacy_archive.webxl_verify_gm_delay_amount d
            WHERE coalesce(d.delay_dollar_status, '') = 'Installment'
              AND coalesce(d.acc_status, '') = 'Pending'
          )
          AND coalesce(g.alibaba, '') = 'Pending'
          AND coalesce(g.webxl_behalf, '') = 'Installment'
          AND coalesce(g.ceo_disc_status, '') <> 'Rejected'
          AND coalesce(g.acc_disc_status, '') NOT IN ('Rejected', 'Refund')
          AND coalesce(d2.cash_status, '') = 'Online Paid'`,
    ).then((r) => r.rows[0]),
    pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${NUM("d2.delay_dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("d2.delay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm_delay_amount d2
         INNER JOIN legacy_archive.webxl_verify_gm g ON d2.gmid::text = g.id::text
        WHERE coalesce(d2.delay_dollar_status, '') = 'Installment'
          AND coalesce(d2.acc_status, '') IN ('Paid', 'Recoverd')
          AND g.id::text IN (
            SELECT d.gmid::text FROM legacy_archive.webxl_verify_gm_delay_amount d
            WHERE coalesce(d.delay_dollar_status, '') = 'Installment'
              AND coalesce(d.acc_status, '') = 'Pending'
          )
          AND coalesce(g.alibaba, '') = 'Pending'
          AND coalesce(g.webxl_behalf, '') = 'Installment'
          AND coalesce(g.ceo_disc_status, '') <> 'Rejected'
          AND coalesce(g.acc_disc_status, '') NOT IN ('Rejected', 'Refund')
          AND coalesce(d2.cash_status, '') = 'Cash Received'`,
    ).then((r) => r.rows[0]),
    pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${NUM("d2.delay_dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("d2.delay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_verify_gm_delay_amount d2
         INNER JOIN legacy_archive.webxl_verify_gm g ON d2.gmid::text = g.id::text
        WHERE coalesce(d2.delay_dollar_status, '') = 'Installment'
          AND coalesce(d2.acc_status, '') IN ('Paid', 'Recoverd')
          AND g.id::text IN (
            SELECT d.gmid::text FROM legacy_archive.webxl_verify_gm_delay_amount d
            WHERE coalesce(d.delay_dollar_status, '') = 'Installment'
              AND coalesce(d.acc_status, '') = 'Pending'
          )
          AND coalesce(g.alibaba, '') = 'Pending'
          AND coalesce(g.webxl_behalf, '') = 'Installment'
          AND coalesce(g.ceo_disc_status, '') <> 'Rejected'
          AND coalesce(g.acc_disc_status, '') NOT IN ('Rejected', 'Refund')
          AND (coalesce(d2.cash_status, '') IN ('Extra Discount Paid', 'Extra Discount'))`,
    ).then((r) => r.rows[0]),
    pool.query(
      `SELECT count(*)::int AS c,
              coalesce(sum(${NUM("dollars")}), 0)::float AS usd,
              coalesce(sum(${NUM("pkr_amount")} - ${NUM("acc_pay_pkr")}), 0)::float AS pkr
         FROM legacy_archive.webxl_dollars_received_history wdrh
        WHERE coalesce(show_ab, '') NOT IN ('Refund', 'delete')
          AND ${NUM("acc_pay_pkr")} < ${NUM("pkr_amount")}
          AND (
            coalesce(acc_pay_status, '') = 'Installment'
            OR acc_pay_pkr IS NULL
            OR btrim(coalesce(acc_pay_pkr::text, '')) = ''
          )`,
    ).then((r) => r.rows[0]),
  ]);

  const uncompletedCount =
    Number(uncOnline?.c || 0) + Number(uncCash?.c || 0) + Number(uncExtra?.c || 0);

  return {
    fullOnlinePaidUsd: Number(fullOnline.usd || 0),
    fullOnlinePaidPkr: Number(fullOnline.pkr || 0),
    fullCashReceivedUsd: Number(fullCash.usd || 0),
    fullCashReceivedPkr: Number(fullCash.pkr || 0),
    fullExtraDiscountUsd: Number(fullExtra?.usd || 0),
    fullExtraDiscountPkr: Number(fullExtra?.pkr || 0),
    fullOnlinePaidCount: Number(fullOnline.c || 0),
    fullCashReceivedCount: Number(fullCash.c || 0),
    partialOnlinePaidUsd: Number(partialOnline.usd || 0),
    partialOnlinePaidPkr: Number(partialOnline.pkr || 0),
    partialCashReceivedUsd: Number(partialCash.usd || 0),
    partialCashReceivedPkr: Number(partialCash.pkr || 0),
    partialInstallmentExtraDiscountUsd: Number(partialExtra.usd || 0),
    partialInstallmentExtraDiscountPkr: Number(partialExtra.pkr || 0),
    partialOnlinePaidCount: Number(partialOnline.c || 0),
    partialCashReceivedCount: Number(partialCash.c || 0),
    uncompletedPartialsCount: uncompletedCount,
    uncompletedOnlinePaidUsd: Number(uncOnline?.usd || 0),
    uncompletedOnlinePaidPkr: Number(uncOnline?.pkr || 0),
    uncompletedCashReceivedUsd: Number(uncCash?.usd || 0),
    uncompletedCashReceivedPkr: Number(uncCash?.pkr || 0),
    uncompletedExtraDiscountUsd: Number(uncExtra?.usd || 0),
    uncompletedExtraDiscountPkr: Number(uncExtra?.pkr || 0),
    vendorOutstandingUsd: Number(vendor?.usd || 0),
    vendorOutstandingPkr: Number(vendor?.pkr || 0),
    vendorOutstandingCount: Number(vendor?.c || 0),
  };
}


/**
 * AB Report -> "Dollar System" section, old func.php `Ab_report_startData` handler.
 * Rows per table section + PKR/USD totals that feed the Full Report formulas.
 *   Client Payment: verify_gm acc_disc 'Approved', DATE(create_date) in range,
 *                   acc_pay_status <> 'Customer Paid' (NULL never matched in MySQL),
 *                   webxl_behalf not Installment/Delay; $ = customer_dollars, PKR = amount.
 *     + Loan First Payment Received: delay_amount 'Delay', acc_status 'Paid',
 *       cash_status not Extra Discount Paid / Customer Paid, current_pay_date in range.
 *     + Partial Payment: same with 'Installment'.
 *   Dollar Buy (received_history show_ab 'Show', buy_date in range, PKR = acc_pay_pkr):
 *     main = cheque_id '' + acc_pay_status 'Paid'; Martini Due = cheque_id '' + acc_pay_status NULL;
 *     Cheque = cheque_id 'Cheque Dollar' + Paid; Recovery = cheque_id 'Recovery Dollar' + Paid.
 *   AliBaba Paid: verify_gm approved by Account + CEO, alibaba 'Yes', acc_pay_status <> 'Customer Paid',
 *     pay_date in range; $ = price, rate = latest webxl_dollar_pay.dollar_rate, PKR = price * rate.
 */
export async function fetchLegacyAbDollarSystem(pool: Pool, start: string, end: string) {
  const N = (c: string) =>
    `COALESCE(substring(regexp_replace(replace(${c}, ',', ''), '[.]{2,}', '.', 'g') from '-?[0-9]+(?:[.][0-9]+)?')::numeric, 0)::float8`;
  const cname = (comCol: string) =>
    `(SELECT upper(c.cname) FROM legacy_archive.webxl_company c WHERE c._source_table = 'webxl_company' AND c._legacy_pk = btrim(${comCol}))`;
  const [client, delay, buys, ab] = await Promise.all([
    pool.query(
      `SELECT 'client' AS section, left(v.create_date, 10) AS date, ${cname("v.com_id")} AS company,
              ${N("v.customer_dollars")} AS dollar, ${N("v.dollar_rate")} AS rate, ${N("v.amount")} AS received
         FROM legacy_archive.webxl_verify_gm v
        WHERE btrim(v.acc_disc_status) = 'Approved'
          AND left(v.create_date, 10) BETWEEN $1 AND $2
          AND v.acc_pay_status IS NOT NULL AND btrim(v.acc_pay_status) <> 'Customer Paid'
          AND (v.webxl_behalf IS NULL OR (btrim(v.webxl_behalf) <> 'Installment' AND btrim(v.webxl_behalf) <> 'Delay'))
        ORDER BY v.create_date ASC`,
      [start, end],
    ),
    pool.query(
      `SELECT CASE WHEN btrim(d.delay_dollar_status) = 'Delay' THEN 'loan' ELSE 'partial' END AS section,
              left(d.current_pay_date, 10) AS date, ${cname("d.com_id")} AS company,
              ${N("d.current_dollar_pay")} AS dollar, ${N("d.current_dollar_rate")} AS rate, ${N("d.current_pkr")} AS received
         FROM legacy_archive.webxl_verify_gm_delay_amount d
        WHERE btrim(d.delay_dollar_status) IN ('Delay', 'Installment') AND btrim(d.acc_status) = 'Paid'
          AND d.cash_status IS NOT NULL AND btrim(d.cash_status) NOT IN ('Extra Discount Paid', 'Customer Paid')
          AND left(d.current_pay_date, 10) BETWEEN $1 AND $2
        ORDER BY d.current_pay_date ASC`,
      [start, end],
    ),
    pool.query(
      `SELECT CASE WHEN h.cheque_id = '' AND btrim(h.acc_pay_status) = 'Paid' THEN 'main'
                   WHEN h.cheque_id = '' AND h.acc_pay_status IS NULL THEN 'martiniDue'
                   WHEN btrim(h.cheque_id) = 'Cheque Dollar' THEN 'cheque'
                   ELSE 'recovery' END AS section,
              left(h.buy_date, 10) AS date, lower(h.buyer_reference_paypal_email) AS "paypalEmail",
              ${N("h.dollars")} AS dollar, ${N("h.dollar_rate")} AS rate, ${N("h.acc_pay_pkr")} AS received
         FROM legacy_archive.webxl_dollars_received_history h
        WHERE btrim(h.show_ab) = 'Show' AND left(h.buy_date, 10) BETWEEN $1 AND $2
          AND ((h.cheque_id = '' AND (btrim(h.acc_pay_status) = 'Paid' OR h.acc_pay_status IS NULL))
               OR (btrim(h.cheque_id) IN ('Cheque Dollar', 'Recovery Dollar') AND btrim(h.acc_pay_status) = 'Paid'))
        ORDER BY h.buy_date ASC`,
      [start, end],
    ),
    pool.query(
      `SELECT left(v.pay_date, 10) AS paid_date, ${cname("v.com_id")} AS company_name, v.member_id AS ab_id,
              ${N("v.price")} AS amount_usd, ${N("dp.dollar_rate")} AS rate,
              ${N("v.price")} * ${N("dp.dollar_rate")} AS amount_pkr, 'paid' AS status, 'legacy' AS source
         FROM legacy_archive.webxl_verify_gm v
         LEFT JOIN LATERAL (
           SELECT p.dollar_rate FROM legacy_archive.webxl_dollar_pay p
            WHERE btrim(p.com_id) = btrim(v.com_id) AND btrim(p.gmid) = v._legacy_pk
            ORDER BY p._legacy_pk::bigint DESC LIMIT 1
         ) dp ON true
        WHERE v.acc_pay_status IS NOT NULL AND btrim(v.acc_pay_status) <> 'Customer Paid'
          AND btrim(v.acc_disc_status) = 'Approved' AND btrim(v.ceo_disc_status) = 'Approved'
          AND btrim(v.alibaba) = 'Yes' AND left(v.pay_date, 10) BETWEEN $1 AND $2
        ORDER BY v.pay_date ASC`,
      [start, end],
    ),
  ]);
  const sum = (rows: any[], f: string) => rows.reduce((s, r) => s + Number(r[f] || 0), 0);
  const clientRows = [...client.rows, ...delay.rows.filter((r: any) => r.section === "loan"), ...delay.rows.filter((r: any) => r.section === "partial")];
  const buyRows = ["main", "martiniDue", "cheque", "recovery"].flatMap((s) => buys.rows.filter((r: any) => r.section === s));
  const by = (rows: any[], s: string) => rows.filter((r: any) => r.section === s);
  return {
    clientRows,
    buyRows,
    abRows: ab.rows,
    totals: {
      clientPkr: sum(clientRows, "received"),
      clientUsd: sum(clientRows, "dollar"),
      buyPkr: sum(by(buyRows, "main"), "received"),
      buyUsd: sum(by(buyRows, "main"), "dollar"),
      buyChequePkr: sum(by(buyRows, "cheque"), "received"),
      buyChequeUsd: sum(by(buyRows, "cheque"), "dollar"),
      buyRecoveryPkr: sum(by(buyRows, "recovery"), "received"),
      buyRecoveryUsd: sum(by(buyRows, "recovery"), "dollar"),
      abPkr: sum(ab.rows, "amount_pkr"),
      abUsd: sum(ab.rows, "amount_usd"),
    },
  };
}
