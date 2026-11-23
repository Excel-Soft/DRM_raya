import type { Pool, PoolClient } from "pg";

export type LegacyDailyGmRow = {
  id: string;
  legacy_gm_id: string;
  drm_id: string | null;
  company_name: string | null;
  sales_person_name: string | null;
  user_bv_date: string | null;
  bv_date: string | null;
  bv_date_missing: boolean;
  start_date: string | null;
  end_date: string | null;
  last_start_date: string | null;
  last_expire_date: string | null;
  created_at: string | null;
  renewal_status: "new" | "renew" | "unknown";
  renewal_label: string;
  date_btn: string | null;
  status: string;
  package_type: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  company_pk: string | null;
};

function isBadLegacyDate(value: unknown): boolean {
  if (value == null) return true;
  const t = String(value).trim();
  if (!t) return true;
  if (t === "0000-00-00" || t === "1990-01-01") return true;
  if (t.startsWith("-0001")) return true;
  return false;
}

function normalizeLegacyDate(value: unknown): string | null {
  if (isBadLegacyDate(value)) return null;
  const t = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return t;
  return d.toISOString().slice(0, 10);
}

export async function legacyDailyGmAvailable(client: Pool | PoolClient): Promise<boolean> {
  const t = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_gmaccount'
    LIMIT 1
  `);
  return t.rows.length > 0;
}

export async function fetchLegacyDailyGmRecords(
  client: Pool | PoolClient,
  opts: {
    start?: Date | null;
    end?: Date | null;
    page: number;
    pageSize: number;
    scopedLegacyUserIds?: string[] | null;
  },
): Promise<{ rows: LegacyDailyGmRow[]; total: number }> {
  const available = await legacyDailyGmAvailable(client);
  if (!available) return { rows: [], total: 0 };

  const page = Math.max(opts.page, 1);
  const pageSize = Math.min(Math.max(opts.pageSize, 1), 2000);
  const offset = (page - 1) * pageSize;

  const params: unknown[] = [];
  const where: string[] = [`NULLIF(btrim(gm.create_data), '') IS NOT NULL`];

  if (opts.start) {
    params.push(opts.start);
    where.push(`NULLIF(gm.create_data, '')::timestamp >= $${params.length}`);
  }
  if (opts.end) {
    params.push(opts.end);
    where.push(`NULLIF(gm.create_data, '')::timestamp <= $${params.length}`);
  }
  if (opts.scopedLegacyUserIds?.length) {
    params.push(opts.scopedLegacyUserIds);
    where.push(`gm.user_id = ANY($${params.length}::text[])`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRes = await client.query(
    `SELECT COUNT(*)::int AS total FROM legacy_archive.webxl_gmaccount gm ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, pageSize, offset];
  const { rows } = await client.query(
    `
    SELECT
      gm.id AS legacy_id,
      gm.user_id,
      gm.com_id AS company_pk,
      gm.create_data,
      gm.renwal,
      gm.disable,
      gm."bvDate",
      gm."startData",
      gm."endData",
      gm."LastStartDate",
      gm."LastExpireDate",
      gm.user_bv_date,
      gm.date_btn,
      u.name AS user_name,
      c.com_id,
      c.cname,
      vgm.package,
      vgm.price,
      vgm.dollar_rate
    FROM legacy_archive.webxl_gmaccount gm
    LEFT JOIN legacy_archive.webxl_user u ON u.user_id = gm.user_id
    LEFT JOIN legacy_archive.webxl_company c ON c.id = gm.com_id
    LEFT JOIN LATERAL (
      SELECT package, price, dollar_rate
      FROM legacy_archive.webxl_verify_gm v
      WHERE v.com_id = gm.com_id
      ORDER BY NULLIF(v.id, '')::bigint DESC NULLS LAST, v.id DESC
      LIMIT 1
    ) vgm ON true
    ${whereSql}
    ORDER BY NULLIF(gm.create_data, '')::timestamp DESC NULLS LAST, NULLIF(gm.id, '')::bigint DESC NULLS LAST
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    listParams,
  );

  const mapped: LegacyDailyGmRow[] = rows.map((row) => {
    const renwal = row.renwal != null ? String(row.renwal).trim() : "";
    let renewal_status: LegacyDailyGmRow["renewal_status"] = "unknown";
    let renewal_label = "Unknown";
    if (renwal === "0") {
      renewal_status = "new";
      renewal_label = "New";
    } else if (renwal === "1") {
      renewal_status = "renew";
      renewal_label = "Renew GM";
    }

    const bvRaw = row.bvDate;
    const bv_missing = isBadLegacyDate(bvRaw);
    const bv_date = bv_missing ? null : normalizeLegacyDate(bvRaw);

    let status = "Unknown";
    const dis = row.disable != null ? String(row.disable).trim() : "";
    if (dis === "1" || dis.toLowerCase() === "yes") status = "Disabled";
    else if (dis === "0" || dis.toLowerCase() === "no") status = "Enabled";

    const price = row.price != null && String(row.price).trim() !== "" ? String(row.price).trim() : null;
    const rate = row.dollar_rate != null && String(row.dollar_rate).trim() !== "" ? Number(row.dollar_rate) : null;
    let amountPkr: string | null = null;
    if (price && rate && !Number.isNaN(rate)) amountPkr = String(Math.round(Number(price) * rate));

    const userName = row.user_name ? String(row.user_name).trim() : null;

    return {
      id: String(row.legacy_id),
      legacy_gm_id: String(row.legacy_id),
      drm_id: row.com_id ? String(row.com_id).trim() : null,
      company_pk: row.company_pk ? String(row.company_pk).trim() : null,
      company_name: row.cname ? String(row.cname).trim() : null,
      sales_person_name: userName,
      user_bv_date: normalizeLegacyDate(row.user_bv_date),
      bv_date,
      bv_date_missing: bv_missing,
      start_date: normalizeLegacyDate(row.startData),
      end_date: normalizeLegacyDate(row.endData),
      last_start_date: normalizeLegacyDate(row.LastStartDate),
      last_expire_date: normalizeLegacyDate(row.LastExpireDate),
      created_at: row.create_data ? String(row.create_data).trim() : null,
      renewal_status,
      renewal_label: renewal_label,
      date_btn: row.date_btn ? String(row.date_btn).trim().toLowerCase() : null,
      status,
      package_type: row.package ? String(row.package).trim() : null,
      amount_usd: price,
      amount_pkr: amountPkr,
    };
  });

  return { rows: mapped, total };
}
