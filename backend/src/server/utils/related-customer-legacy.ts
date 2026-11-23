import type { Pool, PoolClient } from "pg";

export interface LegacyRelatedCustomerRow {
  id: string;
  legacyCompanyId: string;
  companyId: string;
  customerName: string;
  personName: string | null;
  followStatus: string;
  invoiceNumber: string;
  receiptNumber: string;
  packageType: string;
  gmAmount: string;
  payDate: string;
  bvDate: string;
  crmCustomerId: string | null;
  legacySource: true;
  isDisabled: boolean;
}

async function legacyArchiveAvailable(client: Pool | PoolClient): Promise<boolean> {
  const res = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_company'
    LIMIT 1
  `);
  return res.rows.length > 0;
}

export interface LegacyRelatedCustomerPage {
  items: LegacyRelatedCustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  source: "legacy";
}

function buildLegacyCompanyWhere(q: string): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  let where = `(c.disable IS NULL OR btrim(coalesce(c.disable, '')) = '')`;

  if (q) {
    params.push(`${q}%`);
    params.push(`%${q}%`);
    where += ` AND (c.cname ILIKE $2 OR c.com_id ILIKE $2 OR c.cname ILIKE $1 OR c.com_id ILIKE $1)`;
  }
  return { where, params };
}

export async function countLegacyRelatedCustomers(
  client: Pool | PoolClient,
  q?: string,
): Promise<number> {
  const available = await legacyArchiveAvailable(client);
  if (!available) return 0;

  const term = (q ?? "").trim();
  const { where, params } = buildLegacyCompanyWhere(term);
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM legacy_archive.webxl_company c WHERE ${where}`,
    params,
  );
  return rows[0]?.n ?? 0;
}

export async function searchLegacyRelatedCustomers(
  client: Pool | PoolClient,
  opts: { q?: string; page?: number; pageSize?: number },
): Promise<LegacyRelatedCustomerPage> {
  const available = await legacyArchiveAvailable(client);
  if (!available) {
    return { items: [], total: 0, page: 1, pageSize: opts.pageSize ?? 50, source: "legacy" };
  }

  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const q = (opts.q ?? "").trim();

  const { where, params: whereParams } = buildLegacyCompanyWhere(q);
  const total = await countLegacyRelatedCustomers(client, q);

  const listParams = [...whereParams, pageSize, offset];

  const { rows } = await client.query(
    `
    SELECT
      c.id AS legacy_company_id,
      c.com_id,
      c.cname,
      COALESCE(u.name, '') AS person_name,
      CASE WHEN lf.create_date IS NOT NULL AND btrim(lf.create_date) <> '' AND lf.create_date <> '0000-00-00'
        THEN 'Yes' ELSE 'No' END AS follow_status,
      CASE WHEN inv.invoice_id IS NOT NULL AND btrim(inv.invoice_id) <> ''
        THEN inv.invoice_id || '(' || coalesce(nullif(btrim(inv.grand_total), ''), '0') || ')'
        ELSE '0' END AS invoice_display,
      CASE WHEN pay.id IS NOT NULL AND btrim(pay.id) <> ''
        THEN pay.id || '(' || coalesce(nullif(btrim(pay.amount), ''), '0') || ')'
        ELSE '0' END AS receipt_display,
      CASE WHEN vgm.package IS NOT NULL AND btrim(vgm.package) <> ''
        THEN vgm.package || '(' || coalesce(nullif(btrim(vgm.price), ''), '0') || ')'
        ELSE '0' END AS package_display,
      coalesce(nullif(btrim(vgm.create_date), ''), '') AS gm_date,
      coalesce(nullif(btrim(vgm.pay_date), ''), '') AS pay_date,
      coalesce(nullif(btrim(gma."startData"), ''), '') AS bv_date,
      cust.id::text AS crm_customer_id
    FROM legacy_archive.webxl_company c
    LEFT JOIN legacy_archive.webxl_user u ON u.user_id = c."assignId"
    LEFT JOIN LATERAL (
      SELECT lf1.create_date
      FROM legacy_archive.webxl_last_followup lf1
      WHERE lf1.com_id = c.id
      ORDER BY NULLIF(lf1.id, '')::bigint DESC NULLS LAST, lf1.id DESC
      LIMIT 1
    ) lf ON true
    LEFT JOIN LATERAL (
      SELECT i.invoice_id, i.grand_total
      FROM legacy_archive.webxl_invoice i
      WHERE i.com_id = c.id
      ORDER BY NULLIF(i.invoice_id, '')::bigint DESC NULLS LAST, i.invoice_id DESC
      LIMIT 1
    ) inv ON true
    LEFT JOIN LATERAL (
      SELECT p.id, p.amount
      FROM legacy_archive.webxl_payments p
      WHERE p.invoice_id = inv.invoice_id
      ORDER BY NULLIF(p.id, '')::bigint DESC NULLS LAST, p.id DESC
      LIMIT 1
    ) pay ON inv.invoice_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT v.package, v.price, v.create_date, v.pay_date
      FROM legacy_archive.webxl_verify_gm v
      WHERE v.com_id = c.id
        AND (v.package IS NULL OR btrim(v.package) NOT IN ('Kwa', 'Ai', 'CAT'))
      ORDER BY NULLIF(v.id, '')::bigint DESC NULLS LAST, v.id DESC
      LIMIT 1
    ) vgm ON true
    LEFT JOIN legacy_archive.webxl_gmaccount gma ON gma.com_id = c.id
    LEFT JOIN drm.customers cust ON cust.drm_id = c.com_id
    WHERE ${where}
    ORDER BY
      NULLIF(c.create_date, '')::timestamp DESC NULLS LAST,
      c._archive_row_id DESC
    LIMIT $${whereParams.length + 1}
    OFFSET $${whereParams.length + 2}
    `,
    listParams,
  );

  const items = rows.map((row) => ({
    id: String(row.legacy_company_id),
    legacyCompanyId: String(row.legacy_company_id),
    companyId: row.com_id ? String(row.com_id) : "",
    customerName: row.cname ? String(row.cname) : "",
    personName: row.person_name ? String(row.person_name) : null,
    followStatus: String(row.follow_status || "No"),
    invoiceNumber: String(row.invoice_display || "0"),
    receiptNumber: String(row.receipt_display || "0"),
    packageType: String(row.package_display || "0"),
    gmAmount: String(row.gm_date || ""),
    payDate: String(row.pay_date || ""),
    bvDate: row.bv_date === "0000-00-00" ? "" : String(row.bv_date || ""),
    crmCustomerId: row.crm_customer_id ? String(row.crm_customer_id) : null,
    legacySource: true as const,
    isDisabled: false,
  }));

  return { items, total, page, pageSize, source: "legacy" };
}

export async function disableLegacyCompany(
  client: Pool | PoolClient,
  legacyCompanyId: string,
): Promise<{ ok: boolean; error?: string }> {
  const available = await legacyArchiveAvailable(client);
  if (!available) return { ok: false, error: "Legacy archive not available" };

  const id = String(legacyCompanyId).trim();
  if (!id) return { ok: false, error: "Invalid company id" };

  const result = await client.query(
    `UPDATE legacy_archive.webxl_company SET disable = 'Yes' WHERE id = $1`,
    [id],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { ok: false, error: "Company not found" };
  }
  return { ok: true };
}
