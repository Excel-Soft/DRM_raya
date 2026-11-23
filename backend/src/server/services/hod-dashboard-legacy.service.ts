import { pool } from "../db";

export type HodDailyReportRow = {
  id: string;
  name: string;
  company: string;
  project: string;
  free: string;
  task: string;
  status: string;
  run: string;
  spent: string | number;
  createdAt?: Date;
};

export type HodProjectDeadlineRow = {
  id: string;
  userName: string;
  companyName: string;
  project: string;
  dep: string;
  deadlines: Date | string;
};

function dailyReportPeriodSql(period: string): { sql: string; days: number } {
  const p = period.toLowerCase();
  if (p === "weekly" || p === "wk") return { sql: "CURRENT_DATE - INTERVAL '30 days'", days: 30 };
  if (p === "monthly" || p === "mo") return { sql: "CURRENT_DATE - INTERVAL '90 days'", days: 90 };
  // "daily" / today: recent activity window (legacy data rarely has same-calendar-day updates)
  return { sql: "CURRENT_DATE - INTERVAL '7 days'", days: 7 };
}

function deadlineWindowSql(filter: string): { lower: string; upper: string } {
  const f = filter.toUpperCase();
  if (f === "TD") {
    return {
      lower: "NOW() - INTERVAL '7 days'",
      upper: "NOW() + INTERVAL '3 days'",
    };
  }
  if (f === "MN" || f === "MO" || f === "LD") {
    return {
      lower: "NOW() - INTERVAL '30 days'",
      upper: "NOW() + INTERVAL '30 days'",
    };
  }
  // WK default
  return {
    lower: "NOW() - INTERVAL '14 days'",
    upper: "NOW() + INTERVAL '7 days'",
  };
}

export async function fetchHodLegacyDailyReport(period: string): Promise<HodDailyReportRow[]> {
  const { sql: periodStart } = dailyReportPeriodSql(period);
  try {
    const { rows } = await pool.query<HodDailyReportRow>(
      `
      WITH latest_inv AS (
        SELECT DISTINCT ON (trim(i.com_id))
          trim(i.com_id) AS com_id,
          COALESCE(
            NULLIF(regexp_replace(trim(i.grand_total::text), '[^0-9.\\-]', '', 'g'), '')::numeric,
            0
          ) AS grand_total
        FROM legacy_archive.webxl_invoice i
        WHERE trim(coalesce(i.com_id::text, '')) <> ''
        ORDER BY trim(i.com_id),
          NULLIF(regexp_replace(trim(i.invoice_id::text), '[^0-9]', '', 'g'), '')::bigint DESC NULLS LAST
      )
      SELECT
        'L-' || trim(a._legacy_pk) AS id,
        COALESCE(
          NULLIF(trim(du.full_name), ''),
          NULLIF(trim(du.name), ''),
          NULLIF(trim(lu.name), ''),
          'Unknown'
        ) AS name,
        COALESCE(
          NULLIF(trim(a.soft_task_cname), ''),
          co.cname,
          'Unknown'
        ) AS company,
        COALESCE(
          NULLIF(trim(tl.task_name), ''),
          NULLIF(trim(cp.project), ''),
          NULLIF(trim(a.soft_task_name), ''),
          '-'
        ) AS project,
        CASE WHEN COALESCE(li.grand_total, -1) = 0 THEN '1' ELSE '0' END AS free,
        COALESCE(NULLIF(trim(tl.task_name), ''), NULLIF(trim(a.soft_task_name), ''), 'Task') AS task,
        CASE
          WHEN lower(trim(coalesce(a.stauts, ''))) IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
            THEN 'Completed'
          WHEN lower(trim(coalesce(a.stauts, ''))) IN ('', 'todo', 'panding', 'pending', 'waiting', 'wait', 'assign', 'new')
            THEN 'Pending'
          ELSE initcap(replace(trim(a.stauts), '_', ' '))
        END AS status,
        '0' AS run,
        COALESCE(NULLIF(regexp_replace(trim(a.timespent::text), '[^0-9]', '', 'g'), '')::int, 0)::text || ' mins' AS spent,
        coalesce(
          NULLIF(trim(a.last_update), '')::timestamptz,
          NULLIF(trim(a.assign_date), '')::timestamptz,
          now()
        ) AS "createdAt"
      FROM legacy_archive.webxl_task_assign a
      LEFT JOIN legacy_archive.webxl_tasks_list tl
        ON trim(tl._legacy_pk) = trim(a.task_id) OR trim(tl.id) = trim(a.task_id)
      LEFT JOIN legacy_archive.webxl_create_project cp ON trim(cp.pro_id) = trim(a.pro_id)
      LEFT JOIN legacy_archive.webxl_company co
        ON trim(co._legacy_pk) = trim(cp.com_id)
      LEFT JOIN latest_inv li ON li.com_id = trim(cp.com_id)
      LEFT JOIN migration_meta.migration_legacy_ids um
        ON um.legacy_table = 'webxl_user'
       AND um.legacy_id = trim(a.user_id)
      LEFT JOIN drm.users du ON du.id = um.modern_id::uuid
      LEFT JOIN legacy_archive.webxl_user lu ON trim(lu._legacy_pk) = trim(a.user_id)
      WHERE trim(coalesce(a.pro_id, '')) <> ''
        AND coalesce(
          NULLIF(trim(a.last_update), '')::timestamptz,
          NULLIF(trim(a.assign_date), '')::timestamptz,
          now()
        ) >= ${periodStart}
      ORDER BY coalesce(
        NULLIF(trim(a.last_update), '')::timestamptz,
        NULLIF(trim(a.assign_date), '')::timestamptz,
        now()
      ) DESC
      LIMIT 40
    `,
    );
    return rows;
  } catch (err) {
    console.error("HOD legacy daily report failed (non-fatal):", err);
    return [];
  }
}

export async function fetchHodLegacyProjectDeadlines(filter: string): Promise<HodProjectDeadlineRow[]> {
  const { lower, upper } = deadlineWindowSql(filter);
  try {
    const { rows } = await pool.query<HodProjectDeadlineRow>(
      `
      WITH latest_assign AS (
        SELECT DISTINCT ON (trim(a.pro_id))
          trim(a.pro_id) AS pro_id,
          lower(trim(coalesce(a.stauts, ''))) AS status
        FROM legacy_archive.webxl_task_assign a
        WHERE trim(coalesce(a.pro_id, '')) <> ''
        ORDER BY trim(a.pro_id),
          coalesce(
            NULLIF(trim(a.last_update), '')::timestamptz,
            NULLIF(trim(a.assign_date), '')::timestamptz,
            now()
          ) DESC
      ),
      base AS (
        SELECT DISTINCT ON (trim(cp.pro_id))
          trim(cp.pro_id) AS id,
          trim(cp.com_id) AS com_id,
          trim(cp.user_id) AS user_id,
          cp.project,
          CASE WHEN pg_input_is_valid(trim(cp.create_data), 'timestamp')
               THEN trim(cp.create_data)::timestamptz END AS created_at
        FROM legacy_archive.webxl_create_project cp
        WHERE trim(coalesce(cp.pro_id, '')) <> ''
        ORDER BY trim(cp.pro_id),
          CASE WHEN pg_input_is_valid(trim(cp.create_data), 'timestamp')
               THEN trim(cp.create_data)::timestamptz END DESC NULLS LAST
      ),
      calc AS (
        SELECT
          b.id,
          COALESCE(NULLIF(trim(wu.name), ''), 'Unknown') AS "userName",
          COALESCE(NULLIF(trim(co.cname), ''), 'Unknown') AS "companyName",
          COALESCE(NULLIF(trim(b.project), ''), '-') AS project,
          COALESCE(NULLIF(trim(qs.name), ''), NULLIF(trim(d.name), ''), '—') AS dep,
          (b.created_at + (GREATEST(COALESCE(NULLIF(trim(qs.min_day), '')::int, 0), 1) || ' days')::interval) AS deadlines
        FROM base b
        JOIN latest_assign la ON la.pro_id = b.id
        LEFT JOIN legacy_archive.webxl_company co ON trim(co._legacy_pk) = trim(b.com_id)
        LEFT JOIN legacy_archive.webxl_user wu ON trim(wu._legacy_pk) = trim(b.user_id)
        LEFT JOIN legacy_archive.webxl_quotation_services qs
          ON lower(trim(qs.name)) = lower(trim(b.project))
        LEFT JOIN legacy_archive.webxl_department d
          ON trim(d._legacy_pk) = trim(qs.dep_id)
        WHERE b.created_at IS NOT NULL
          AND la.status NOT IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
      )
      SELECT id, "userName", "companyName", project, dep, deadlines
      FROM calc
      WHERE deadlines >= ${lower}
        AND deadlines <= ${upper}
      ORDER BY deadlines ASC
      LIMIT 30
    `,
    );
    return rows;
  } catch (err) {
    console.error("HOD legacy project deadlines failed (non-fatal):", err);
    return [];
  }
}