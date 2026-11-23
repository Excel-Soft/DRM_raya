// Old DRM "Balance Report" page (balance-report.php + func.php handlers) on the copied data.
//
//   GET   /api/reports/balance-report?start=YYYY-MM-DD&end=YYYY-MM-DD
//           old `BalancestartData` two-sided Debit/Credit table
//   GET   /api/reports/balance-report/detail?filter=<id>&start=&end=
//           old `DateFillterLoaddata_For_balance_Report` detail per line item
//   GET   /api/reports/balance-report/entries
//           old bank_balance() "Balance View" list
//   POST  /api/reports/balance-report/entries        old `balance_head` (Add Bank Balance)
//   PATCH /api/reports/balance-report/entries/:id    old `updateBankBalance` (new-app rows only)
//
// Sources. Old MySQL tables are READ-ONLY text copies in legacy_archive.webxl_*. Where the new
// app records the same concept itself, its rows are added and legacy-mapped modern rows
// (migration_meta.migration_legacy_ids) are skipped so nothing is counted twice:
//   bank balance      legacy_archive.webxl_bank_balance + drm.bank_balance_entries
//                     (scripts/migration/create-bank-balance-entries.sql)
//   department pay    legacy_archive.webxl_payments + drm.ledger_entries ('Invoice Payment')
//   COA heads         legacy_archive.webxl_expense + drm.office_expenses (via drm.account_heads)
//   staff loan paid   legacy_archive.webxl_pay_loan + drm.legacy_loan_payments
//   donation          legacy_archive.webxl_donation + drm.donations
//   customer loan     legacy_archive.webxl_verify_gm_delay_amount only (no modern equivalent)
//   Alibaba/Vas/Salary/Vas-Comission detail branches (not linked from the page): archive only.
import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { normalizeRole } from "../utils/role-utils";
import { requireFinancialPermission, FINANCIAL_ACTIONS, FINANCIAL_VIEW_ROLES } from "./middleware/financial-permission";
import { recordAuditLog } from "../services/activity-service";

const BANK_TABLE = "drm.bank_balance_entries";
const LA = "legacy_archive";

// ─── access ──────────────────────────────────────────────────────────────────
// financial-permission.ts is a pass-through stub in this checkout, so the role
// check is done here as well: admin / account manager / HOD / super HOD.
const BALANCE_ROLES = new Set(["admin", "account_manager", "hod", "super_hod"]);
function callerRole(req: Request): string {
  const u = req.user as any;
  return normalizeRole(String(u?.activeRoleId ?? u?.roleId ?? u?.role ?? ""));
}
function requireBalanceRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!BALANCE_ROLES.has(callerRole(req))) return res.status(403).json({ error: "Insufficient permissions" });
  next();
}
const viewGuard = [
  requireFinancialPermission(FINANCIAL_ACTIONS.walletView, { roles: FINANCIAL_VIEW_ROLES }),
  requireBalanceRole,
];
const writeGuard = [requireFinancialPermission(FINANCIAL_ACTIONS.bankBalanceCreate), requireBalanceRole];

// ─── SQL helpers ─────────────────────────────────────────────────────────────
/** Old text number -> numeric ("1,000" -> 1000, junk -> 0). */
const NUM = (c: string) => `COALESCE(substring(replace(${c}, ',', '') from '-?[0-9]+(?:[.][0-9]+)?')::numeric, 0)`;
/** MySQL DATE(col) on an old wall-clock text column -> 'YYYY-MM-DD' (NULL when not a date). */
const DAY = (c: string) => `(CASE WHEN ${c} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(${c}, 10) END)`;
/** Integer of an old text id (for numeric ordering / MIN). */
const INT = (c: string) => `(CASE WHEN ${c} ~ '^\\s*-?[0-9]+\\s*$' THEN trim(${c})::bigint END)`;
/** New-app timestamp (server-local, no tz) -> Pakistan wall clock. */
const PK_TS = (c: string) => `((${c}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Karachi'`;
const NOT_LEGACY = (table: string, idExpr: string) =>
  `NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids lm WHERE lm.modern_table = '${table}' AND lm.modern_id = (${idExpr})::text)`;
/** MySQL ci string equality (case-insensitive, trailing spaces ignored). */
const CI_EQ = (a: string, b: string) => `lower(rtrim(${a})) = lower(rtrim(${b}))`;

async function bankTableExists(): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [BANK_TABLE]);
  return !!r.rows[0]?.ok;
}

// ─── PHP-compatible helpers ──────────────────────────────────────────────────
/** PHP round($x, 0): half away from zero. */
function phpRound(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}
function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
/** PHP date('m/d/Y', strtotime($text)) for 'YYYY-MM-DD...' text. */
function mdy(v: unknown): string {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || m[1] === "0000") return "";
  return `${m[2]}/${m[3]}/${m[1]}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** PHP date('M d, Y'). */
function mdY(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${MONTHS[Number(m) - 1]} ${d}, ${y}`;
}
/** PHP date('d-m-Y h:i A'). */
function dmyHiA(v: unknown): string {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m || m[1] === "0000") return "";
  const h = Number(m[4] ?? 0);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${m[3]}-${m[2]}-${m[1]} ${String(h12).padStart(2, "0")}:${m[5] ?? "00"} ${h < 12 ? "AM" : "PM"}`;
}
/** PHP date('Y-m-d', strtotime(x)) for the posted dates (accepts Y-m-d and Y-n-j). */
function ymd(v: unknown): string | null {
  const m = String(v ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function pkToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

// ─── summary pieces (old helper functions) ───────────────────────────────────
/** bank_balance_total($start,$end) */
async function bankBalanceTotal(start: string, end: string, hasBank: boolean): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(${NUM("amount")}), 0) AS t FROM ${LA}.webxl_bank_balance WHERE ${DAY("create_at")} BETWEEN $1 AND $2`,
    [start, end],
  );
  let total = n(r.rows[0]?.t);
  if (hasBank) {
    const m = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS t FROM ${BANK_TABLE} WHERE create_at BETWEEN $1::date AND $2::date`,
      [start, end],
    );
    total += n(m.rows[0]?.t);
  }
  return total;
}

/** Old inv_dep CTE: invoice -> MIN(webxl_quotation_services.dep_id) of its items (matched by name). */
const LEGACY_INV_DEP = `
  SELECT ii.invoice_id, MIN(${INT("qs.dep_id")}) AS dep_id
    FROM ${LA}.webxl_invoice_item ii
    JOIN ${LA}.webxl_quotation_services qs ON ${CI_EQ("qs.name", "ii.item")}
   GROUP BY ii.invoice_id`;

/** New-app invoice payments (ledger 'Invoice Payment' credits not copied from webxl_payments),
 *  with the invoice's department = MIN dep of its items (product -> services dep_id / LEGACY-N,
 *  else item name -> old quotation service), falling back to the old invoice's items. */
const MODERN_DEPT_PAYMENTS = `
  WITH pay AS (
    SELECT le.id, le.amount, le.reference_id AS invoice_id,
           ${PK_TS("COALESCE(le.date, le.entry_date, le.created_at)")} AS pk_ts
      FROM drm.ledger_entries le
     WHERE le.reference_type = 'Invoice' AND le.category = 'Invoice Payment' AND le.entry_type = 'Credit'
       AND le.reversal_of_id IS NULL
       AND ${NOT_LEGACY("ledger_entries", "le.id")}
  ),
  inv AS (
    SELECT i.*, (SELECT lm.legacy_id FROM migration_meta.migration_legacy_ids lm
                  WHERE lm.modern_table = 'invoices' AND lm.modern_id = i.id::text AND lm.legacy_table = 'webxl_invoice' LIMIT 1) AS legacy_invoice_id
      FROM drm.invoices i WHERE i.id IN (SELECT invoice_id FROM pay)
  ),
  item AS (
    SELECT inv.id AS invoice_id, it.value AS j
      FROM inv, jsonb_array_elements(CASE WHEN inv.items IS JSON ARRAY THEN inv.items::jsonb ELSE '[]'::jsonb END) it
  ),
  item_dep AS (
    SELECT item.invoice_id, item.j,
           COALESCE(
             (SELECT COALESCE(x.dep_id, substring(x.project_department from '^LEGACY-([0-9]+)$')::int)
                FROM (SELECT id::text AS id, dep_id, project_department FROM drm.services
                      UNION ALL SELECT id::text, dep_id, project_department FROM drm.service_subservices
                      UNION ALL SELECT id::text, dep_id, project_department FROM drm.service_sub_subservices) x
               WHERE x.id = item.j->>'productId' LIMIT 1),
             (SELECT MIN(${INT("qs.dep_id")}) FROM ${LA}.webxl_quotation_services qs
               WHERE ${CI_EQ("qs.name", "item.j->>'name'")} OR ${CI_EQ("qs.name", "item.j->>'detail'")})
           ) AS dep_id
      FROM item
  ),
  inv_dep AS (
    SELECT inv.id AS invoice_id,
           COALESCE((SELECT MIN(d.dep_id) FROM item_dep d WHERE d.invoice_id = inv.id),
                    (SELECT ld.dep_id FROM (${LEGACY_INV_DEP}) ld WHERE ld.invoice_id = inv.legacy_invoice_id)) AS dep_id,
           (SELECT string_agg(DISTINCT COALESCE(NULLIF(d.j->>'name', 'Service'), d.j->>'detail', d.j->>'name'), ' + ')
              FROM item_dep d WHERE d.invoice_id = inv.id) AS item,
           (SELECT MAX(d.j->>'detail') FROM item_dep d WHERE d.invoice_id = inv.id) AS detail
      FROM inv
  )
  SELECT pay.id, pay.amount, to_char(pay.pk_ts, 'YYYY-MM-DD HH24:MI:SS') AS create_date,
         inv.id AS invoice_id, inv.invoice_number, inv.legacy_invoice_id,
         COALESCE(c.company_name, inv.customer_name) AS cname,
         inv_dep.dep_id, inv_dep.item, inv_dep.detail,
         COALESCE(u.full_name, u.name) AS invoice_user_name
    FROM pay
    JOIN inv ON inv.id = pay.invoice_id
    JOIN inv_dep ON inv_dep.invoice_id = inv.id
    LEFT JOIN drm.customers c ON c.id = inv.customer_id
    LEFT JOIN drm.users u ON u.id = inv.created_by_user_id
   WHERE pay.pk_ts::date BETWEEN $1::date AND $2::date`;

/** AllDepInviceItemsOnlyAmountAmountTeast for dep 13/10/9/8 in one pass. */
async function departmentTotals(start: string, end: string): Promise<Record<string, number>> {
  const legacy = await pool.query(
    `WITH inv_dep AS (${LEGACY_INV_DEP}),
          base AS (SELECT p.invoice_id, p.amount FROM ${LA}.webxl_payments p WHERE ${DAY("p.create_date")} BETWEEN $1 AND $2)
     SELECT idmap.dep_id::text AS dep_id, COALESCE(SUM(${NUM("d.amount")}), 0) AS total
       FROM base d JOIN inv_dep idmap ON idmap.invoice_id = d.invoice_id
      WHERE idmap.dep_id IN (8, 9, 10, 13)
      GROUP BY idmap.dep_id`,
    [start, end],
  );
  const out: Record<string, number> = { "8": 0, "9": 0, "10": 0, "13": 0 };
  for (const r of legacy.rows) out[r.dep_id] = n(r.total);
  const modern = await pool.query(MODERN_DEPT_PAYMENTS, [start, end]);
  for (const r of modern.rows) {
    const k = String(r.dep_id ?? "");
    if (k in out) out[k] += n(r.amount);
  }
  return out;
}

/** AllMonthly{Assets,Liabilities,OwnerEquity,Revenue,Expense}Data: webxl_expense rolled up by
 *  COA parent -> child -> transactional head (sub-transactional head = e.phead_id). */
type CoaRow = {
  parent_id: string; parent_code: string; parent_head: string;
  child_id: string | null; child_code: string | null; child_head: string | null;
  trans_id: string | null; trans_head: string | null;
  total_amount: number; transaction_count: number;
};
async function coaData(parentId: number, start: string, end: string): Promise<CoaRow[]> {
  const legacy = await pool.query(
    `SELECT p.id AS parent_id, p.account_code AS parent_code, p.head_name AS parent_head,
            c.id AS child_id, c.account_code AS child_code, c.head_name AS child_head,
            t.id AS trans_id, t.head_name AS trans_head, t.account_code AS trans_code,
            SUM(${NUM("e.amount")}) AS total_amount, COUNT(e.id) AS transaction_count
       FROM ${LA}.webxl_expense e
       LEFT JOIN ${LA}.webxl_coa_sub_transactional_heads st ON e.phead_id = st.id
       LEFT JOIN ${LA}.webxl_coa_transactional_heads t ON st.transactional_id = t.id
       LEFT JOIN ${LA}.webxl_coa_child_heads c ON t.child_id = c.id
       LEFT JOIN ${LA}.webxl_coa_parent_heads p ON t.parent_id = p.id
      WHERE ${DAY("e.create_date")} BETWEEN $1 AND $2 AND ${INT("p.id")} = $3
      GROUP BY p.id, p.account_code, p.head_name, c.id, c.account_code, c.head_name, t.id, t.head_name, t.account_code`,
    [start, end, parentId],
  );
  // New-app office expenses (not copied from webxl_expense): expense_head = drm.account_heads id;
  // walk up the head tree (level 1 parent, 2 child, 3 transactional) and key heads that were
  // copied from webxl_coa_* by their old id so they merge with the old rows.
  const modern = await pool.query(
    `WITH RECURSIVE x AS (
       SELECT o.id AS oid, o.amount, a.id AS hid, a.parent_account_id AS pid, 0 AS depth
         FROM drm.office_expenses o
         JOIN drm.account_heads a ON a.id = o.expense_head
        WHERE to_char(o.expense_date, 'YYYY-MM-DD') BETWEEN $1 AND $2
          AND ${NOT_LEGACY("office_expenses", "o.id")}
       UNION ALL
       SELECT x.oid, x.amount, a.id, a.parent_account_id, x.depth + 1
         FROM x JOIN drm.account_heads a ON a.id = x.pid WHERE x.depth < 10
     ),
     lv AS (
       SELECT x.oid, x.amount, x.hid, (MAX(x.depth) OVER (PARTITION BY x.oid)) - x.depth + 1 AS lvl FROM x
     ),
     keyed AS (
       SELECT lv.*, h.code, h.name, h.category::text AS category,
              (SELECT lm.legacy_id FROM migration_meta.migration_legacy_ids lm
                WHERE lm.modern_table = 'account_heads' AND lm.modern_id = lv.hid
                  AND lm.legacy_table LIKE 'webxl_coa_%' LIMIT 1) AS legacy_id
         FROM lv JOIN drm.account_heads h ON h.id = lv.hid
     )
     SELECT p.oid, p.amount,
            COALESCE(p.legacy_id, 'm:' || p.hid) AS parent_id, p.code AS parent_code, p.name AS parent_head, p.category,
            COALESCE(c.legacy_id, 'm:' || c.hid) AS child_id, c.code AS child_code, c.name AS child_head,
            COALESCE(t.legacy_id, 'm:' || t.hid) AS trans_id, t.code AS trans_code, t.name AS trans_head
       FROM keyed p
       LEFT JOIN keyed c ON c.oid = p.oid AND c.lvl = 2
       LEFT JOIN keyed t ON t.oid = p.oid AND t.lvl = 3
      WHERE p.lvl = 1`,
    [start, end],
  );
  const CATEGORY_TO_PARENT: Record<string, number> = { assets: 6, liabilities: 7, ownerequity: 8, revenue: 9, expenses: 10 };
  type Acc = CoaRow & { trans_code: string | null };
  const map = new Map<string, Acc>();
  const keyOf = (p: unknown, c: unknown, t: unknown) => `${p ?? ""}|${c ?? ""}|${t ?? ""}`;
  for (const r of legacy.rows) {
    map.set(keyOf(r.parent_id, r.child_id, r.trans_id), {
      parent_id: r.parent_id, parent_code: r.parent_code ?? "", parent_head: r.parent_head ?? "",
      child_id: r.child_id, child_code: r.child_code, child_head: r.child_head,
      trans_id: r.trans_id, trans_head: r.trans_head, trans_code: r.trans_code,
      total_amount: n(r.total_amount), transaction_count: n(r.transaction_count),
    });
  }
  for (const r of modern.rows) {
    const parentMatches =
      String(r.parent_id) === String(parentId) ||
      (String(r.parent_id).startsWith("m:") && CATEGORY_TO_PARENT[String(r.category ?? "").toLowerCase().replace(/\s+/g, "")] === parentId);
    if (!parentMatches) continue;
    const k = keyOf(r.parent_id, r.child_id, r.trans_id);
    const cur = map.get(k);
    if (cur) {
      cur.total_amount += n(r.amount);
      cur.transaction_count += 1;
    } else {
      map.set(k, {
        parent_id: r.parent_id, parent_code: r.parent_code ?? "", parent_head: r.parent_head ?? "",
        child_id: r.child_id, child_code: r.child_code, child_head: r.child_head,
        trans_id: r.trans_id, trans_head: r.trans_head, trans_code: r.trans_code,
        total_amount: n(r.amount), transaction_count: 1,
      });
    }
  }
  // ORDER BY p.account_code ASC, c.account_code ASC
  const cmp = (a: string | null, b: string | null) => String(a ?? "").localeCompare(String(b ?? ""), "en", { numeric: true });
  return Array.from(map.values()).sort(
    (a, b) => cmp(a.parent_code, b.parent_code) || cmp(a.child_code, b.child_code) || cmp(a.trans_code, b.trans_code),
  );
}
function coaGrandTotal(rows: CoaRow[]): number {
  return rows.reduce((s, r) => s + r.total_amount, 0);
}

/** userloanreportfunction: SUM(webxl_pay_loan.pay) by DATE(pay_date) + new-app loan payments. */
async function staffLoanReceived(start: string, end: string): Promise<number> {
  const r = await pool.query(
    `SELECT (SELECT COALESCE(SUM(${NUM("pay")}), 0) FROM ${LA}.webxl_pay_loan WHERE ${DAY("pay_date")} BETWEEN $1 AND $2)
          + (SELECT COALESCE(SUM(lp.amount), 0) FROM drm.legacy_loan_payments lp
              WHERE (lp.paid_at AT TIME ZONE 'Asia/Karachi')::date BETWEEN $1::date AND $2::date
                AND ${NOT_LEGACY("legacy_loan_payments", "lp.id")}) AS t`,
    [start, end],
  );
  return n(r.rows[0]?.t);
}

/** customer_received_loan_report_function (archive only). */
async function customerLoan(start: string, end: string): Promise<{ loan: number; received: number }> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(${NUM("delay_pkr")}), 0) AS loan, COALESCE(SUM(${NUM("current_pkr")}), 0) AS received
       FROM ${LA}.webxl_verify_gm_delay_amount
      WHERE ${CI_EQ("delay_dollar_status", "'Delay'")} AND ${DAY("create_at")} BETWEEN $1 AND $2`,
    [start, end],
  );
  return { loan: n(r.rows[0]?.loan), received: n(r.rows[0]?.received) };
}

/** Totaldonation(): ALL donations, no date filter (as in the old code). */
const MODERN_DONATIONS = `
  SELECT d.id, d.amount, COALESCE(d.person_name, d.title, d.company_name) AS name,
         COALESCE(d.comment, d.title) AS detail, to_char(${PK_TS("d.created_at")}, 'YYYY-MM-DD HH24:MI:SS') AS create_at
    FROM drm.donations d
   WHERE ${NOT_LEGACY("donations", "d.id")} AND COALESCE(d.status, '') NOT ILIKE 'reject%'`;
async function donationTotal(): Promise<number> {
  const r = await pool.query(
    `SELECT (SELECT COALESCE(SUM(${NUM("amount")}), 0) FROM ${LA}.webxl_donation)
          + (SELECT COALESCE(SUM(m.amount), 0) FROM (${MODERN_DONATIONS}) m) AS t`,
  );
  return n(r.rows[0]?.t);
}

// ─── detail payload ──────────────────────────────────────────────────────────
type ColType = "text" | "int" | "dec2" | "raw" | "detail" | "invoice" | "badge";
interface DetailColumn { key: string; header: string; type?: ColType; align?: "left" | "right" | "center" }
interface DetailPayload {
  filter: string;
  title: string;
  info?: string[];
  columns: DetailColumn[];
  rows: Record<string, any>[];
  footer?: Record<string, string | number> | null;
  cards?: { positive: number; nonPositive: number; total: number; totalAmount: number } | null;
  note?: string;
  editableBank?: boolean;
}

// filterDuplicateBundleInvoices (old dept branch)
const BUNDLE = new Set([
  "Domain Registration", "Hosting Plan", "SSL Certificate",
  "Aluminum Hosting Plan", "Copper Hosting Plan", "Silver Hosting Plan", "Gold Hosting Plan", "Diamond Hosting Plan",
]);
type DeptRec = { create_date: string; com: string; item: string; detail: string | null; amount: number; amountText: string; invoice: any; user: string; _seq: number };
function tsOf(s: string): number {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}
function filterDuplicateBundleInvoices(records: DeptRec[]): DeptRec[] {
  const groups = new Map<string, { rows: DeptRec[]; seen: Set<string> }>();
  const result: DeptRec[] = [];
  for (const r of records) {
    const item = String(r.item ?? "").trim();
    if (!BUNDLE.has(item)) {
      result.push(r);
      continue;
    }
    const key = `${r.com}|${r.amountText.replace(/[, ]/g, "")}`;
    if (!groups.has(key)) groups.set(key, { rows: [], seen: new Set() });
    const g = groups.get(key)!;
    g.rows.push(r);
    g.seen.add(item);
  }
  for (const g of Array.from(groups.values())) {
    if (g.seen.has("Domain Registration") && g.seen.has("Hosting Plan")) {
      const rows = g.rows.slice().sort((a, b) => tsOf(b.create_date) - tsOf(a.create_date));
      const base = { ...rows[0] };
      const services = ["Domain Registration", "Hosting Plan"];
      if (g.seen.has("SSL Certificate")) services.push("SSL Certificate");
      base.item = services.join(" + ");
      result.push(base);
    } else {
      result.push(...g.rows);
    }
  }
  return result.sort((a, b) => tsOf(b.create_date) - tsOf(a.create_date) || a._seq - b._seq);
}

const DEPT_NAMES: Record<string, string> = { "13": "IT Department", "10": "Development Department", "9": "Posting Department", "8": "SEO/SMM Department" };

async function deptDetail(dep: string, start: string, end: string): Promise<DetailPayload> {
  // AllDepInviceItemsAmount
  const legacy = await pool.query(
    `WITH inv_dep AS (${LEGACY_INV_DEP}),
          base AS (SELECT p.* FROM ${LA}.webxl_payments p WHERE ${DAY("p.create_date")} BETWEEN $1 AND $2)
     SELECT base.id, base.invoice_id, base.com_id, base.amount, ${NUM("base.amount")} AS amount_num, base.method, base.create_date,
            string_agg(DISTINCT ii.item, ' + ' ORDER BY ii.item) AS item,
            MAX(ii.detail) AS detail,
            inv.user_id AS invoice_user_id, u.name AS invoice_user_name,
            (SELECT co.cname FROM ${LA}.webxl_company co WHERE co.id = base.com_id LIMIT 1) AS cname,
            (SELECT lm.modern_id FROM migration_meta.migration_legacy_ids lm
              WHERE lm.legacy_table = 'webxl_invoice' AND lm.legacy_id = base.invoice_id AND lm.modern_table = 'invoices' LIMIT 1) AS modern_invoice_id
       FROM base
       JOIN inv_dep idmap ON idmap.invoice_id = base.invoice_id
       LEFT JOIN ${LA}.webxl_invoice_item ii ON ii.invoice_id = base.invoice_id
       LEFT JOIN ${LA}.webxl_invoice inv ON inv.invoice_id = base.invoice_id
       LEFT JOIN ${LA}.webxl_user u ON u.user_id = inv.user_id
      WHERE idmap.dep_id = $3
      GROUP BY base.id, base.invoice_id, base.com_id, base.amount, base.method, base.create_date, inv.user_id, u.name
      ORDER BY base.create_date DESC, ${INT("base.id")} DESC`,
    [start, end, Number(dep)],
  );
  let seq = 0;
  const recs: DeptRec[] = legacy.rows.map((r) => ({
    create_date: r.create_date, com: r.cname ?? "", item: r.item ?? "", detail: r.detail,
    amount: n(r.amount_num),
    amountText: String(r.amount ?? ""),
    invoice: { label: String(r.invoice_id ?? ""), legacyInvoiceId: r.invoice_id, modernInvoiceId: r.modern_invoice_id ?? null },
    user: r.invoice_user_name ?? "", _seq: seq++,
  }));
  const modern = await pool.query(MODERN_DEPT_PAYMENTS, [start, end]);
  for (const r of modern.rows.sort((a, b) => String(b.create_date).localeCompare(String(a.create_date)))) {
    if (String(r.dep_id ?? "") !== dep) continue;
    recs.push({
      create_date: r.create_date, com: r.cname ?? "", item: r.item ?? "", detail: r.detail,
      amount: n(r.amount), amountText: String(r.amount ?? ""),
      invoice: { label: r.invoice_number || r.legacy_invoice_id || r.invoice_id, legacyInvoiceId: r.legacy_invoice_id, modernInvoiceId: r.invoice_id },
      user: r.invoice_user_name ?? "", _seq: seq++,
    });
  }
  const list = filterDuplicateBundleInvoices(recs);
  let positive = 0;
  let nonPositive = 0;
  let totalAmount = 0;
  const rows = list.map((r, i) => {
    totalAmount += r.amount;
    if (r.amount > 0) positive++;
    else nonPositive++;
    return {
      n: i + 1, date: mdy(r.create_date), company: r.com, project: r.item, detail: r.detail ?? "",
      invoice: r.invoice, amount: r.amount, createdBy: r.user, _tone: r.amount > 0 ? "success" : "danger",
    };
  });
  return {
    filter: dep,
    title: `${DEPT_NAMES[dep]} — Invoice Report`,
    columns: [
      { key: "n", header: "#" },
      { key: "date", header: "Date" },
      { key: "company", header: "Company" },
      { key: "project", header: "Project" },
      { key: "detail", header: "Project Details", type: "detail" },
      { key: "invoice", header: "Invoice", type: "invoice", align: "center" },
      { key: "amount", header: "Received Amount", type: "int", align: "right" },
      { key: "createdBy", header: "Created By" },
    ],
    rows,
    cards: { positive, nonPositive, total: positive + nonPositive, totalAmount },
  };
}

const COA_PARENTS: Record<string, { id: number; label: string; title: string }> = {
  Expense: { id: 10, label: "Expense", title: "Expense Report" },
  Assets: { id: 6, label: "Assets (ID: 6)", title: "Assets Report" },
  OwnerEquity: { id: 8, label: "Owner Equity", title: "Owner Equity Report" },
  Liabilities: { id: 7, label: "Liabilities", title: "Liabilities Report" },
  Revenue: { id: 9, label: "Revenue", title: "Revenue Report" },
};
async function coaDetail(filter: string, start: string, end: string): Promise<DetailPayload> {
  const cfg = COA_PARENTS[filter];
  const data = await coaData(cfg.id, start, end);
  // hierarchical build (parent -> children -> transactions, first-seen order)
  const parents = new Map<string, { row: CoaRow; total: number; tx: number; children: Map<string, { row: CoaRow; total: number; tx: number; trans: CoaRow[] }> }>();
  let grand = 0;
  let grandTx = 0;
  for (const r of data) {
    grand += r.total_amount;
    grandTx += r.transaction_count;
    const pk = String(r.parent_id ?? "");
    if (!parents.has(pk)) parents.set(pk, { row: r, total: 0, tx: 0, children: new Map() });
    const p = parents.get(pk)!;
    const ck = String(r.child_id ?? "");
    if (!p.children.has(ck)) p.children.set(ck, { row: r, total: 0, tx: 0, trans: [] });
    const c = p.children.get(ck)!;
    c.trans.push(r);
    p.total += r.total_amount;
    p.tx += r.transaction_count;
    c.total += r.total_amount;
    c.tx += r.transaction_count;
  }
  const rows: Record<string, any>[] = [];
  let sno = 0;
  for (const p of Array.from(parents.values())) {
    if (!p.row.parent_id) continue;
    rows.push({ sno: ++sno, parentCode: p.row.parent_code, parentHead: String(p.row.parent_head ?? "").toUpperCase(), childCode: "", childHead: "", transactions: p.tx, amount: p.total, _tone: "parent" });
    for (const c of Array.from(p.children.values())) {
      rows.push({ sno: ++sno, parentCode: "", parentHead: "", childCode: c.row.child_code ?? "", childHead: c.row.child_head ?? "", transactions: c.tx, amount: c.total, _tone: "child" });
      for (const t of c.trans) {
        rows.push({ sno: ++sno, parentCode: "", parentHead: "", childCode: "", childHead: t.trans_head ?? "", transactions: t.transaction_count, amount: t.total_amount, _tone: "trans" });
      }
    }
  }
  return {
    filter,
    title: cfg.title,
    info: [`Report Period: ${mdY(start)} to ${mdY(end)}`, `Accounting Head: ${cfg.label}`, "Offices: All"],
    columns: [
      { key: "sno", header: "S.No" },
      { key: "parentCode", header: "Parent Code" },
      { key: "parentHead", header: "Parent Head" },
      { key: "childCode", header: "Child Code" },
      { key: "childHead", header: "Child Head" },
      { key: "transactions", header: "Transactions", type: "int", align: "center" },
      { key: "amount", header: "Total Amount (PKR)", type: "dec2", align: "right" },
    ],
    rows,
    footer: { childHead: "Grand Total:", transactions: grandTx, amount: grand },
  };
}

async function bankDetail(start: string, end: string, req: Request): Promise<DetailPayload> {
  const hasBank = await bankTableExists();
  const r = await pool.query(
    `SELECT * FROM (
       SELECT 'legacy:' || b.id AS id, false AS editable, b.create_at, b.head, ${NUM("b.amount")} AS amount, b.detail
         FROM ${LA}.webxl_bank_balance b WHERE ${DAY("b.create_at")} BETWEEN $1 AND $2
       ${hasBank ? `UNION ALL
       SELECT e.id::text, true, to_char(e.create_at, 'YYYY-MM-DD') || ' 00:00:00', e.head, e.amount, e.detail
         FROM ${BANK_TABLE} e WHERE e.create_at BETWEEN $1::date AND $2::date` : ""}
     ) x ORDER BY x.create_at DESC`,
    [start, end],
  );
  let total = 0;
  const rows = r.rows.map((x, i) => {
    total += n(x.amount);
    return { n: i + 1, id: x.id, editable: !!x.editable, date: mdy(x.create_at), dateIso: String(x.create_at ?? "").slice(0, 10), head: x.head ?? "", amount: n(x.amount), detail: x.detail ?? "" };
  });
  return {
    filter: "Bank-Balance",
    title: "Bank Balance Report",
    info: [`Report Period: ${mdY(start)} to ${mdY(end)}`],
    columns: [
      { key: "n", header: "#" },
      { key: "date", header: "Date" },
      { key: "head", header: "Head" },
      { key: "amount", header: "Amount", type: "dec2", align: "right" },
      { key: "detail", header: "Detail" },
    ],
    rows,
    footer: rows.length ? { head: "Total:", amount: total } : null,
    editableBank: BALANCE_ROLES.has(callerRole(req)),
    note: "Rows copied from the old DRM are read-only; rows added in this app can be edited.",
  };
}

async function staffLoanDetail(start: string, end: string): Promise<DetailPayload> {
  // Old query: webxl_pay_loan LEFT JOIN webxl_addvance_salary ON user_id (one line per advance-salary
  // record of the user), WHERE p.pay_date BETWEEN 'start' AND 'end' (no DATE(): the end day is only
  // included at 00:00:00), ORDER BY p.pay_date DESC.
  const r = await pool.query(
    `SELECT * FROM (
       SELECT p.pay_date, ${NUM("p.pay")} AS pay, u.name AS user_name,
              a.salary, a.instalment, a.detail, a.remaning, a.status, a.create_date, a.manager, a.mng_comm, a.hod, a.hod_comm
         FROM ${LA}.webxl_pay_loan p
         LEFT JOIN ${LA}.webxl_addvance_salary a ON p.user_id = a.user_id
         LEFT JOIN ${LA}.webxl_user u ON u.user_id = p.user_id
        WHERE p.pay_date >= $1 AND p.pay_date <= $2
       UNION ALL
       SELECT to_char(lp.paid_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS'), lp.amount, COALESCE(u.full_name, u.name),
              lr.amount::text, lr.installment_amount::text, lr.detail, lr.remaining_amount::text,
              CASE WHEN lr.status::text = 'Completed' THEN 'Complete' ELSE lr.status::text END,
              to_char(${PK_TS("lr.created_at")}, 'YYYY-MM-DD HH24:MI:SS'),
              COALESCE(mu.full_name, mu.name), CASE WHEN lr.manager_approved_at IS NOT NULL THEN 'Approved' END,
              COALESCE(hu.full_name, hu.name), CASE WHEN lr.hod_approved_at IS NOT NULL THEN 'Approved' END
         FROM drm.legacy_loan_payments lp
         LEFT JOIN drm.loan_requests lr ON lr.id::text = lp.legacy_loan_id
         LEFT JOIN drm.users u ON u.id = lp.user_id
         LEFT JOIN drm.users mu ON mu.id = lr.manager_approved_by_user_id
         LEFT JOIN drm.users hu ON hu.id = lr.hod_approved_by_user_id
        WHERE ${NOT_LEGACY("legacy_loan_payments", "lp.id")}
          AND to_char(lp.paid_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS') >= $1
          AND to_char(lp.paid_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS') <= $2
     ) x ORDER BY x.pay_date DESC`,
    [start, end],
  );
  let total = 0;
  const num = (v: unknown) => n(String(v ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  const rows = r.rows.map((x, i) => {
    total += n(x.pay);
    return {
      n: i + 1, userName: x.user_name ?? "", salary: num(x.salary), installment: num(x.instalment),
      detail: x.detail ?? "N/A", remaining: num(x.remaning),
      status: x.status === "Complete" ? "Complete" : "Pending",
      payDate: mdy(x.pay_date), pay: n(x.pay), manager: x.manager ?? "N/A",
      mngComm: x.mng_comm === "Approved" ? "Approved" : "Pending",
      hod: x.hod ?? "N/A", hodComm: x.hod_comm ?? "N/A", created: mdy(x.create_date),
    };
  });
  return {
    filter: "user-loan-report",
    title: "User Loan Report",
    columns: [
      { key: "n", header: "#" },
      { key: "userName", header: "User Name" },
      { key: "salary", header: "Salary", type: "int", align: "right" },
      { key: "installment", header: "Installment", type: "int", align: "right" },
      { key: "detail", header: "Detail", type: "detail" },
      { key: "remaining", header: "Remaining", type: "int", align: "right" },
      { key: "status", header: "Status", type: "badge", align: "center" },
      { key: "payDate", header: "Pay Date" },
      { key: "pay", header: "Pay Amount", type: "int", align: "right" },
      { key: "manager", header: "Manager Status" },
      { key: "mngComm", header: "Manager Comment", type: "badge", align: "center" },
      { key: "hod", header: "HOD" },
      { key: "hodComm", header: "HOD Comment" },
      { key: "created", header: "Created Date" },
    ],
    rows,
    footer: { payDate: "Total Pay Amount:", pay: total },
    note:
      "Same query as the old page: each payment is joined to every advance-salary record of the user, and the end date only counts payments at 00:00:00 — so this total can differ from the summary line.",
  };
}

async function customerLoanDetail(filter: string, start: string, end: string): Promise<DetailPayload> {
  const r = await pool.query(
    `SELECT d.delay_pkr, d.current_pkr, d.pay_date, d.create_at, d.delay_dollar_status, c.cname, u.name AS user_name
       FROM ${LA}.webxl_verify_gm_delay_amount d
       LEFT JOIN ${LA}.webxl_company c ON d.com_id = c.id
       LEFT JOIN ${LA}.webxl_user u ON u.user_id = d.user_id
      WHERE ${CI_EQ("d.delay_dollar_status", "'Delay'")} AND ${DAY("d.create_at")} BETWEEN $1 AND $2
      ORDER BY d.create_at DESC`,
    [start, end],
  );
  let loan = 0;
  let received = 0;
  const rows = r.rows.map((x, i) => {
    const dp = n(String(x.delay_pkr ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    const cp = n(String(x.current_pkr ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    loan += dp;
    received += cp;
    return {
      n: i + 1, company: x.cname ?? "N/A", user: x.user_name ?? "", delayPkr: dp, currentPkr: cp,
      payDate: mdy(x.pay_date) || "-", created: mdy(x.create_at),
      status: String(x.delay_dollar_status ?? "").trim().toLowerCase() === "delay" ? "Delay" : "Clear",
    };
  });
  return {
    filter,
    title: filter === "customer-paid-loan-report" ? "Customer Loan Paid" : "Customer Loan Received",
    columns: [
      { key: "n", header: "#" },
      { key: "company", header: "Company" },
      { key: "user", header: "User" },
      { key: "delayPkr", header: "Delay PKR (Loan Amount)", type: "int", align: "right" },
      { key: "currentPkr", header: "Current PKR (Received Amount)", type: "int", align: "right" },
      { key: "payDate", header: "Pay Date" },
      { key: "created", header: "Create Date" },
      { key: "status", header: "Status", type: "badge", align: "center" },
    ],
    rows,
    footer: { user: "Total Loan Amount:", delayPkr: loan, currentPkr: received },
    note:
      (filter === "customer-paid-loan-report"
        ? "The old page had no detail for this line (it showed an empty table); the same Delay records are shown — the line total is the Delay PKR column. "
        : "") + "Old DRM marked this report \"in progress\". Source: old DRM data only (copied up to 2026-11-03).",
  };
}

async function donationDetail(): Promise<DetailPayload> {
  const r = await pool.query(
    `SELECT * FROM (
       SELECT 0 AS src, ${INT("id")} AS ord, create_at, name, amount AS amount_text, ${NUM("amount")} AS amount, detail
         FROM ${LA}.webxl_donation
       UNION ALL
       SELECT 1, NULL, m.create_at, m.name, m.amount::text, m.amount, m.detail FROM (${MODERN_DONATIONS}) m
     ) x ORDER BY x.src DESC, x.ord DESC NULLS LAST, x.create_at DESC`,
  );
  let total = 0;
  const rows = r.rows.map((x, i) => {
    total += n(x.amount);
    return { n: i + 1, create: mdy(x.create_at), name: x.name ?? "", amount: x.amount_text ?? "", detail: x.detail ?? "" };
  });
  return {
    filter: "Donation",
    title: "Donation",
    columns: [
      { key: "n", header: "#" },
      { key: "create", header: "Create" },
      { key: "name", header: "Name" },
      { key: "amount", header: "Amount", type: "raw", align: "right" },
      { key: "detail", header: "Detail", type: "detail" },
    ],
    rows,
    footer: { name: "Total", amount: phpRound(total) },
    note: "As in the old page, Donation is the all-time total (not limited to the selected dates).",
  };
}

// ── detail branches not linked from the page (kept for parity; old DRM data only) ──
async function alibabaDetail(start: string, end: string): Promise<DetailPayload> {
  const r = await pool.query(
    `SELECT g.package, g.amount, g.status, g.pay_date, g.renwal, g.create_date, ${DAY("g.create_date")} AS day,
            co.cname, us.name AS person,
            (SELECT ga."startData" FROM ${LA}.webxl_gmaccount ga WHERE ga.com_id = g.com_id ORDER BY ${INT("ga.id")} LIMIT 1) AS bv_date
       FROM ${LA}.webxl_verify_gm g
       LEFT JOIN ${LA}.webxl_company co ON co.id = g.com_id
       LEFT JOIN ${LA}.webxl_user us ON us.user_id = co."assignId"
      ORDER BY ${INT("g.id")} DESC`,
  );
  let payDate = "";
  let renwal = "";
  let total = 0;
  const rows: Record<string, any>[] = [];
  for (const g of r.rows) {
    // PHP keeps $renwal / $pay_date from the previous row when not set on this one.
    // PHP 8 loose ==: null == 0 is true, "" == 0 is false.
    const rv = g.renwal == null ? null : String(g.renwal).trim();
    if (rv !== null && /^-?\d+(\.\d+)?$/.test(rv) && Number(rv) === 1) renwal = "New";
    if (rv === null || (/^-?\d+(\.\d+)?$/.test(rv) && Number(rv) === 0)) renwal = "Rc";
    if (rv !== null && /^-?\d+(\.\d+)?$/.test(rv) && Number(rv) === 2) renwal = "Ec";
    if (g.pay_date !== "0000-00-00 00:00:00") payDate = String(g.pay_date ?? "").slice(0, 10);
    if (g.day && g.day >= start && g.day <= end) {
      const amt = n(String(g.amount ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
      total += amt;
      rows.push({
        n: rows.length + 1, company: g.cname ?? "", package: g.package ?? "", amount: g.amount ?? "", method: g.status ?? "",
        payDate, bvDate: g.bv_date ?? "", person: g.person ?? "", type: renwal, created: dmyHiA(g.create_date),
      });
    }
  }
  return {
    filter: "Alibaba",
    title: "Alibaba",
    columns: [
      { key: "n", header: "#" }, { key: "company", header: "Company" }, { key: "package", header: "Package" },
      { key: "amount", header: "Amount", type: "raw", align: "right" }, { key: "method", header: "Method" },
      { key: "payDate", header: "Pay Date" }, { key: "bvDate", header: "BV Date" }, { key: "person", header: "Person" },
      { key: "type", header: "Type" }, { key: "created", header: "Create Date" },
    ],
    rows,
    footer: { package: "Total", amount: total },
    note: "Old DRM data only (copied up to 2026-11-03).",
  };
}

async function vasDetail(start: string, end: string): Promise<DetailPayload> {
  const r = await pool.query(
    `SELECT p.amount, p.method, p.create_date, co.cname,
            (SELECT i.domain_renewal FROM ${LA}.webxl_invoice i WHERE i.invoice_id = p.invoice_id LIMIT 1) AS domain_renewal,
            EXISTS (SELECT 1 FROM ${LA}.webxl_invoice i WHERE i.invoice_id = p.invoice_id) AS has_invoice
       FROM ${LA}.webxl_payments p
       LEFT JOIN ${LA}.webxl_company co ON co.id = p.com_id
      WHERE ${DAY("p.create_date")} BETWEEN $1 AND $2
      ORDER BY ${INT("p.id")} DESC`,
    [start, end],
  );
  let total = 0;
  const rows = r.rows.map((x, i) => {
    total += n(String(x.amount ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
    // PHP 8: null == 0 and "0" == 0 are true; "" == 0 is false.
    const dr = x.has_invoice ? x.domain_renewal : null;
    const isNew = dr == null || (/^\s*-?\d+(\.\d+)?\s*$/.test(String(dr)) && Number(dr) === 0);
    return { n: i + 1, company: x.cname ?? "", amount: x.amount ?? "", method: x.method ?? "", status: isNew ? "New" : "Renewal", date: x.create_date ?? "" };
  });
  return {
    filter: "Vas",
    title: "Vas",
    columns: [
      { key: "n", header: "#" }, { key: "company", header: "Company" }, { key: "amount", header: "Amount", type: "raw", align: "right" },
      { key: "method", header: "Method" }, { key: "status", header: "Status" }, { key: "date", header: "Date" },
    ],
    rows,
    footer: { company: "Total", amount: total },
    note: "Old DRM data only (copied up to 2026-11-03).",
  };
}

async function salaryDetail(start: string, end: string): Promise<DetailPayload> {
  const r = await pool.query(
    `SELECT s.id, s."grossSalary", s.vas, s.commission3, s.alibaba, s."projectCommission", s.pppcommission,
            s."postingCommission", s.overtimers, s.reward, s.tcutting, ${NUM('s."totalSalary"')} AS total, u.name
       FROM ${LA}.webxl_tem_salary_ship s LEFT JOIN ${LA}.webxl_user u ON u.user_id = s.user_id
      WHERE ${DAY("s.create_date")} BETWEEN $1 AND $2
      ORDER BY ${INT("s.id")}`,
    [start, end],
  );
  let total = 0;
  const rows = r.rows.map((x) => {
    const t = phpRound(n(x.total));
    total += t;
    return {
      id: x.id, name: x.name ?? "", gross: x.grossSalary ?? "", vas: x.vas ?? "", c3: x.commission3 ?? "", ab: x.alibaba ?? "",
      project: x.projectCommission ?? "", ppp: x.pppcommission ?? "", pp: x.postingCommission ?? "", ot: x.overtimers ?? "",
      reward: x.reward ?? "", cutting: x.tcutting ?? "", total: t,
    };
  });
  return {
    filter: "Salary",
    title: "Salary",
    columns: [
      { key: "id", header: "#" }, { key: "name", header: "Name" }, { key: "gross", header: "Gross Salary" }, { key: "vas", header: "VAS" },
      { key: "c3", header: "3 % Bonus" }, { key: "ab", header: "AB Bonus" }, { key: "project", header: "Project Bonus" },
      { key: "ppp", header: "PPP Bonus" }, { key: "pp", header: "PP Bonus" }, { key: "ot", header: "OT RS" }, { key: "reward", header: "Reward" },
      { key: "cutting", header: "Total Cutting" }, { key: "total", header: "Total Salary", type: "raw", align: "right" },
    ],
    rows,
    footer: { name: "Total", total },
    note: "Old DRM salary slips only (copied up to 2026-11-03).",
  };
}

async function vasCommissionDetail(start: string, end: string): Promise<DetailPayload> {
  // userMonthlyAchiveTarget50Kor100Kor150K2Inv per user (user 43: only domain_renewal = 0 invoices)
  const r = await pool.query(
    `WITH tot AS (
       SELECT inv.user_id,
              SUM(${NUM("p.amount")}) AS total,
              SUM(${NUM("p.amount")}) FILTER (WHERE inv.domain_renewal IS NOT NULL AND ${NUM("inv.domain_renewal")} = 0) AS total_new
         FROM ${LA}.webxl_payments p
         LEFT JOIN ${LA}.webxl_invoice inv ON p.com_id = inv.com_id AND p.invoice_id = inv.invoice_id
        WHERE ${DAY("p.create_date")} >= $1 AND ${DAY("p.create_date")} <= $2
        GROUP BY inv.user_id
     )
     SELECT DISTINCT ON (${INT("u.user_id")}) u.user_id, u.name, tot.total, tot.total_new
       FROM ${LA}.webxl_user u LEFT JOIN tot ON tot.user_id = u.user_id
      ORDER BY ${INT("u.user_id")}, u._archive_row_id`,
    [start, end],
  );
  let finalTotal = 0;
  const rows: Record<string, any>[] = [];
  const range = `${mdy(start)} To ${mdy(end)}`;
  for (const u of r.rows) {
    const totalAmount = String(u.user_id).trim() === "43" ? n(u.total_new) : n(u.total);
    if (totalAmount === 0) continue;
    let per = 0;
    let reward = 0;
    if (totalAmount >= 50000 && totalAmount < 100000) { reward = 2500; per = 15; }
    else if (totalAmount >= 100000 && totalAmount < 150000) { reward = 5000; per = 15; }
    else if (totalAmount >= 150000) { reward = 8000; per = 15; }
    else if (totalAmount >= 1000 && totalAmount < 50000) { reward = 0; per = 10; }
    const comm = (per / 100) * totalAmount;
    const finalcomm = reward + comm;
    finalTotal += finalcomm;
    rows.push({ n: rows.length + 1, date: range, person: u.name ?? "", total: totalAmount, per, reward, comm, amount: finalcomm });
  }
  return {
    filter: "Vas-Comission",
    title: "Vas Commission",
    columns: [
      { key: "n", header: "#" }, { key: "date", header: "Date" }, { key: "person", header: "Person" },
      { key: "total", header: "Total", type: "raw" }, { key: "per", header: "%", type: "raw" }, { key: "reward", header: "Reward", type: "raw" },
      { key: "comm", header: "Comm", type: "raw" }, { key: "amount", header: "Amount", type: "raw" },
    ],
    rows,
    footer: { date: "Total", amount: phpRound(finalTotal) },
    note: "Old DRM data only (copied up to 2026-11-03).",
  };
}

// ─── routes ──────────────────────────────────────────────────────────────────
function readRange(req: Request, res: Response): { start: string; end: string } | null {
  const start = ymd(req.query.start ?? req.query.startDate);
  const end = ymd(req.query.end ?? req.query.endDate);
  if (!start || !end) {
    res.status(400).json({ error: "start and end dates (YYYY-MM-DD) are required" });
    return null;
  }
  return { start, end };
}

export function registerBalanceReportRoutes(app: Express) {
  // Old BalancestartData
  app.get("/api/reports/balance-report", ...viewGuard, async (req: Request, res: Response) => {
    const range = readRange(req, res);
    if (!range) return;
    const { start, end } = range;
    try {
      const hasBank = await bankTableExists();
      const [bank, dept, assets, expense, liabilities, equity, revenue, staffLoan, cust, donation] = await Promise.all([
        bankBalanceTotal(start, end, hasBank),
        departmentTotals(start, end),
        coaData(6, start, end).then(coaGrandTotal),
        coaData(10, start, end).then(coaGrandTotal),
        coaData(7, start, end).then(coaGrandTotal),
        coaData(8, start, end).then(coaGrandTotal),
        coaData(9, start, end).then(coaGrandTotal),
        staffLoanReceived(start, end),
        customerLoan(start, end),
        donationTotal(),
      ]);
      const v = {
        bank: phpRound(bank),
        it: phpRound(dept["13"]),
        dev: phpRound(dept["10"]),
        posting: phpRound(dept["9"]),
        seo: phpRound(dept["8"]),
        assets: phpRound(assets),
        expense: phpRound(expense),
        liabilities: phpRound(liabilities),
        equity: phpRound(equity),
        revenue: phpRound(revenue),
        staffLoan: phpRound(staffLoan),
        loanPaid: phpRound(cust.loan),
        loanReceived: phpRound(cust.received),
        donation: phpRound(donation),
      };
      const totalDebit = phpRound(v.bank + v.it + v.dev + v.posting + v.seo + v.staffLoan + v.loanReceived + v.revenue);
      const totalCredit = phpRound(v.assets + v.expense + v.liabilities + v.equity + v.loanPaid + v.donation);
      const item = (filter: string, label: string, amount: number, inProgress = false) => ({ filter, label, amount, inProgress });
      res.json({
        start,
        end,
        rows: [
          { debit: item("Bank-Balance", "AB Received", v.bank), credit: item("Assets", "Assets", v.assets) },
          { debit: item("13", "IT Department", v.it), credit: item("Expense", "Expense", v.expense) },
          { debit: item("10", "Development Department", v.dev), credit: item("Liabilities", "Liabilities", v.liabilities) },
          { debit: item("9", "Posting Department", v.posting), credit: item("OwnerEquity", "Owner Equity", v.equity) },
          { debit: item("8", "SEO/SMM Department", v.seo), credit: item("Donation", "Donation", v.donation) },
          { debit: item("user-loan-report", "Staff Loan received", v.staffLoan), credit: item("customer-paid-loan-report", "Customer Loan Paid.", v.loanPaid, true) },
          { debit: item("customer-received-loan-report", "Customer Loan Received.", v.loanReceived, true), credit: null },
          { debit: item("Revenue", "Revenue", v.revenue), credit: "stars" },
        ],
        totalDebit,
        totalCredit,
        totalBalance: phpRound(totalDebit - totalCredit),
      });
    } catch (error) {
      console.error("[balance-report] summary failed:", error);
      res.status(500).json({ error: "Failed to load balance report" });
    }
  });

  // Old DateFillterLoaddata_For_balance_Report
  app.get("/api/reports/balance-report/detail", ...viewGuard, async (req: Request, res: Response) => {
    const range = readRange(req, res);
    if (!range) return;
    const { start, end } = range;
    const filter = String(req.query.filter ?? "").trim();
    try {
      let payload: DetailPayload;
      if (filter === "13" || filter === "10" || filter === "9" || filter === "8") payload = await deptDetail(filter, start, end);
      else if (filter in COA_PARENTS) payload = await coaDetail(filter, start, end);
      else if (filter === "Bank-Balance") payload = await bankDetail(start, end, req);
      else if (filter === "user-loan-report") payload = await staffLoanDetail(start, end);
      else if (filter === "customer-received-loan-report" || filter === "customer-paid-loan-report") payload = await customerLoanDetail(filter, start, end);
      else if (filter === "Donation") payload = await donationDetail();
      else if (filter === "Alibaba") payload = await alibabaDetail(start, end);
      else if (filter === "Vas") payload = await vasDetail(start, end);
      else if (filter === "Salary") payload = await salaryDetail(start, end);
      else if (filter === "Vas-Comission") payload = await vasCommissionDetail(start, end);
      else if (filter === "Alibaba-Comission") {
        payload = {
          filter, title: "Alibaba Commission", columns: [], rows: [],
          note: "The old per-user Alibaba commission calculation is not linked from the Balance Report and is not available here.",
        };
      } else return res.status(400).json({ error: "Unknown filter" });
      res.json({ ...payload, start, end });
    } catch (error) {
      console.error("[balance-report] detail failed:", error);
      res.status(500).json({ error: "Failed to load detail" });
    }
  });

  // Old bank_balance(): every bank balance row, newest first.
  app.get("/api/reports/balance-report/entries", ...viewGuard, async (_req: Request, res: Response) => {
    try {
      const hasBank = await bankTableExists();
      const r = await pool.query(
        `SELECT * FROM (
           ${hasBank ? `SELECT e.id::text AS id, 'new' AS source, e.head, e.detail, e.amount::text AS amount,
                  to_char(e.create_at, 'YYYY-MM-DD') AS create_at, COALESCE(u.full_name, u.name) AS user_name,
                  1 AS src, e.created_at AS ord_ts, NULL::bigint AS ord_id
             FROM ${BANK_TABLE} e LEFT JOIN drm.users u ON u.id = e.user_id
           UNION ALL` : ""}
           SELECT 'legacy:' || b.id, 'legacy', b.head, b.detail, b.amount, b.create_at, u.name,
                  0, NULL::timestamptz, ${INT("b.id")}
             FROM ${LA}.webxl_bank_balance b LEFT JOIN ${LA}.webxl_user u ON u.user_id = b.user_id
         ) x ORDER BY x.src DESC, x.ord_ts DESC NULLS LAST, x.ord_id DESC NULLS LAST`,
      );
      res.json({
        canAdd: BALANCE_ROLES.has(callerRole(_req)) && hasBank,
        tableReady: hasBank,
        data: r.rows.map((x) => ({
          id: x.id, source: x.source, head: x.head ?? "", detail: x.detail ?? "", amount: x.amount ?? "",
          createAt: x.create_at ?? "", userName: x.user_name ?? "",
        })),
      });
    } catch (error) {
      console.error("[balance-report] entries failed:", error);
      res.status(500).json({ error: "Failed to load bank balance entries" });
    }
  });

  // Old balance_head (Add Bank Balance)
  app.post("/api/reports/balance-report/entries", ...writeGuard, async (req: Request, res: Response) => {
    try {
      if (!(await bankTableExists())) {
        return res.status(503).json({ error: "Bank balance table is not set up yet (run scripts/migration/create-bank-balance-entries.sql)" });
      }
      const body = req.body || {};
      const head = String(body.head ?? body.balance_head ?? "").trim();
      const detail = String(body.detail ?? body.balance_head_detail ?? "").trim();
      const amountRaw = String(body.amount ?? body.balance_head_amount ?? "").replace(/,/g, "").trim();
      const amount = Number(amountRaw);
      const createAt = body.createDate || body.balance_create_date ? ymd(body.createDate ?? body.balance_create_date) : pkToday();
      if (!head) return res.status(400).json({ error: "Head is required" });
      if (!amountRaw || !Number.isFinite(amount)) return res.status(400).json({ error: "A valid amount is required" });
      if (!createAt) return res.status(400).json({ error: "Create Date must be YYYY-MM-DD" });
      const u = req.user as any;
      const userId = u?.userId ?? u?.id ?? null;
      const ins = await pool.query(
        `INSERT INTO ${BANK_TABLE} (user_id, head, detail, amount, create_at)
         VALUES ((SELECT id FROM drm.users WHERE id::text = $1::text), $2, $3, $4, $5::date)
         RETURNING id::text, head, detail, amount::text, to_char(create_at, 'YYYY-MM-DD') AS create_at`,
        [userId, head, detail || null, amount, createAt],
      );
      recordAuditLog({
        actorUserId: userId ?? undefined,
        activeRole: callerRole(req),
        action: "balance_report.bank_balance.create",
        module: "accounts",
        entityType: "BankBalanceEntry",
        entityId: ins.rows[0].id,
        after: ins.rows[0],
        req,
      }).catch((e) => console.error("[balance-report] audit log failed:", e));
      res.status(201).json({ message: "Data Add In Balance", entry: ins.rows[0] });
    } catch (error) {
      console.error("[balance-report] add failed:", error);
      res.status(500).json({ error: "Failed to add bank balance" });
    }
  });

  // Old updateBankBalance (only rows added in this app; the old copy is read-only)
  app.patch("/api/reports/balance-report/entries/:id", ...writeGuard, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(400).json({ error: "Only bank balance rows added in this app can be edited" });
      }
      if (!(await bankTableExists())) return res.status(503).json({ error: "Bank balance table is not set up yet" });
      const body = req.body || {};
      const createAt = ymd(body.createAt ?? body.create_at);
      const amount = Number(String(body.amount ?? "").replace(/,/g, ""));
      const detail = String(body.detail ?? "");
      if (!createAt || !(amount > 0)) return res.status(400).json({ error: "Date and Amount are required" });
      const before = await pool.query(`SELECT id::text, head, detail, amount::text, create_at::text FROM ${BANK_TABLE} WHERE id = $1`, [id]);
      if (!before.rows[0]) return res.status(404).json({ error: "Not found" });
      const upd = await pool.query(
        `UPDATE ${BANK_TABLE} SET create_at = $2::date, amount = $3, detail = $4, updated_at = now() WHERE id = $1
         RETURNING id::text, head, detail, amount::text, to_char(create_at, 'YYYY-MM-DD') AS create_at`,
        [id, createAt, amount, detail],
      );
      const u = req.user as any;
      recordAuditLog({
        actorUserId: u?.userId ?? u?.id,
        activeRole: callerRole(req),
        action: "balance_report.bank_balance.update",
        module: "accounts",
        entityType: "BankBalanceEntry",
        entityId: id,
        before: before.rows[0],
        after: upd.rows[0],
        req,
      }).catch((e) => console.error("[balance-report] audit log failed:", e));
      res.json({ success: true, message: "Bank balance updated successfully", entry: upd.rows[0] });
    } catch (error) {
      console.error("[balance-report] update failed:", error);
      res.status(500).json({ error: "Failed to update bank balance" });
    }
  });
}
