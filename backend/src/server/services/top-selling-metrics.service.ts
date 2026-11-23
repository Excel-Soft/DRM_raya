import { pool } from "../db";

export type TopSellingMetrics = {
  totalProjects: number;
  free: number;
  verification: number;
  dataPending: number;
};

/**
 * Top Selling pipeline counts (legacy create_project + modern drm.projects).
 * - Free: project created with invoice amount 0 (or payment marked free).
 * - Verification: HOD + Account approved, then document department approved.
 * - Data pending: non-free projects in the period still missing that full chain.
 */
export async function fetchTopSellingMetrics(dateFrom: Date | null): Promise<TopSellingMetrics> {
  const params: unknown[] = [];
  let modernPeriod = "";
  let legacyPeriod = "";
  if (dateFrom) {
    params.push(dateFrom);
    modernPeriod = `AND p.created_at >= $${params.length}`;
    legacyPeriod = `
      AND CASE WHEN pg_input_is_valid(trim(cp.create_data), 'timestamp')
           THEN trim(cp.create_data)::timestamptz END >= $${params.length}`;
  }

  try {
    const { rows: modernRows } = await pool.query<{
      total: string;
      free_count: string;
      verification_count: string;
    }>(
      `
      SELECT
        count(*)::int AS total,
        count(*) FILTER (
          WHERE COALESCE(i.amount, 0)::numeric = 0
             OR lower(trim(coalesce(i.payment_method, ''))) = 'free'
        )::int AS free_count,
        count(*) FILTER (
          WHERE i.hod_approved_at IS NOT NULL
            AND i.accounts_approved_at IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM drm.project_documents pd
              WHERE pd.project_id = p.id AND pd.status = 'APPROVED'
            )
        )::int AS verification_count
      FROM drm.projects p
      LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
      WHERE coalesce(p.is_deleted, false) = false
        AND NOT EXISTS (
          SELECT 1 FROM migration_meta.migration_legacy_ids m
          WHERE m.modern_table = 'projects'
            AND m.modern_id = p.id::text
            AND m.legacy_table = 'webxl_create_project'
        )
        ${modernPeriod}
    `,
      params,
    );

    const { rows: legacyRows } = await pool.query<{
      total: string;
      free_count: string;
      verification_count: string;
    }>(
      `
      WITH period_cp AS (
        SELECT DISTINCT ON (trim(cp.pro_id))
          trim(cp.pro_id) AS pro_id,
          trim(cp.com_id) AS com_id,
          CASE WHEN pg_input_is_valid(trim(cp.create_data), 'timestamp')
               THEN trim(cp.create_data)::timestamptz END AS created_at
        FROM legacy_archive.webxl_create_project cp
        WHERE trim(coalesce(cp.pro_id, '')) <> ''
          ${legacyPeriod}
        ORDER BY trim(cp.pro_id),
          CASE WHEN pg_input_is_valid(trim(cp.create_data), 'timestamp')
               THEN trim(cp.create_data)::timestamptz END DESC NULLS LAST
      ),
      inv AS (
        SELECT DISTINCT ON (trim(i.com_id))
          trim(i.com_id) AS com_id,
          COALESCE(
            NULLIF(regexp_replace(trim(i.grand_total::text), '[^0-9.\\-]', '', 'g'), '')::numeric,
            0
          ) AS grand_total
        FROM legacy_archive.webxl_invoice i
        WHERE trim(coalesce(i.com_id::text, '')) <> ''
        ORDER BY trim(i.com_id),
          NULLIF(regexp_replace(trim(i.invoice_id::text), '[^0-9]', '', 'g'), '')::bigint
          DESC NULLS LAST
      ),
      classified AS (
        SELECT
          p.pro_id,
          COALESCE(inv.grand_total, -1) = 0 AS is_free,
          (
            EXISTS (
              SELECT 1 FROM legacy_archive.webxl_status_hod h
              WHERE trim(h.com_id::text) = p.com_id
                AND COALESCE(
                  NULLIF(regexp_replace(trim(h.hod_status::text), '[^0-9]', '', 'g'), '')::int,
                  0
                ) = 1
                AND COALESCE(
                  NULLIF(regexp_replace(trim(h.acc_status::text), '[^0-9]', '', 'g'), '')::int,
                  0
                ) = 1
            )
            AND (
              EXISTS (
                SELECT 1 FROM legacy_archive.webxl_gm_doc d
                WHERE trim(d.com_id::text) = p.com_id
                  AND d.upload IS NOT NULL
                  AND trim(d.upload::text) NOT IN ('', '0000-00-00')
              )
              OR EXISTS (
                SELECT 1 FROM legacy_archive.webxl_project_status ps
                WHERE trim(ps.pro_id::text) = p.pro_id
                  AND ps.upload_doc IS NOT NULL
                  AND trim(ps.upload_doc::text) NOT IN ('', '0000-00-00 00:00:00')
              )
            )
          ) AS is_verified
        FROM period_cp p
        LEFT JOIN inv ON inv.com_id = p.com_id
      )
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_free)::int AS free_count,
        count(*) FILTER (WHERE is_verified)::int AS verification_count
      FROM classified
    `,
      params,
    );

    const modern = modernRows[0] || { total: "0", free_count: "0", verification_count: "0" };
    const legacy = legacyRows[0] || { total: "0", free_count: "0", verification_count: "0" };

    const totalProjects =
      Number(modern.total || 0) + Number(legacy.total || 0);
    const free = Number(modern.free_count || 0) + Number(legacy.free_count || 0);
    const verification =
      Number(modern.verification_count || 0) + Number(legacy.verification_count || 0);
    const dataPending = Math.max(0, totalProjects - free - verification);

    return { totalProjects, free, verification, dataPending };
  } catch (err) {
    console.error("Top selling metrics failed (non-fatal):", err);
    return { totalProjects: 0, free: 0, verification: 0, dataPending: 0 };
  }
}