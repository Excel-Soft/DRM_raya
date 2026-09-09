/**
 * Link Report (Team Report submodule) service — all DB access for the link report.
 *
 * Honest, real data only. The report is a normalized UNION of three sources:
 *   - drm.link_reports                     (manual / future submissions)
 *   - drm.product_posting_evidence_links   (links submitted in product posting)
 *   - drm.software_evidence_links          (links submitted in software workflow)
 * Each evidence link is joined projects -> customers to derive a company name.
 *
 * Display ID: link_reports rows use their serial display_id. Evidence-link rows
 * have UUID primary keys with no numeric id, so we derive a STABLE numeric id
 * from md5(uuid) (same uuid -> same number) instead of showing a raw UUID.
 */
import { pool } from "../db";

export interface LinkReportRow {
  id: string;
  displayId: string;
  company: string;
  links: string;
  date: string | null;
  sourceModule: string;
  sourceRecordId: string;
}

export interface LinkReportResult {
  rows: LinkReportRow[];
  summary: {
    total: number;
    reward: number;
    commissionVerified: boolean;
  };
}

export interface ReportUser {
  id: string;
  name: string;
  fullName: string | null;
  email: string;
  role: string | null;
  roleId: string | null;
  department: string | null;
  isActive: boolean;
}

/** Active users for the dropdown, optionally scoped to an allowed id list. */
export async function listUsersForReport(allowedIds: string[] | null): Promise<ReportUser[]> {
  if (allowedIds !== null && allowedIds.length === 0) return [];
  const params: any[] = [];
  let where = "is_active = true";
  if (allowedIds !== null) {
    params.push(allowedIds);
    where += ` and id::text = any($${params.length}::text[])`;
  }
  const { rows } = await pool.query(
    `select id, coalesce(full_name, name, email) as name, full_name as "fullName",
            email, role, role_id as "roleId", department, is_active as "isActive"
       from drm.users
      where ${where}
      order by coalesce(full_name, name, email) asc`,
    params,
  );
  return rows as ReportUser[];
}

/**
 * Normalized link report for one user within an inclusive date range.
 * startDate / endDate are YYYY-MM-DD strings.
 */
export async function listLinkReport(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<LinkReportRow[]> {
  const { rows } = await pool.query(
    `
    with combined as (
      select
        lr.id::text                                        as id,
        lr.display_id::text                                as display_id,
        coalesce(nullif(lr.company_name, ''), 'Unknown')   as company,
        lr.link_url                                        as links,
        lr.submitted_at                                    as date,
        lr.source_module                                   as source_module,
        lr.id::text                                        as source_record_id
      from drm.link_reports lr
      where lr.deleted_at is null
        and lr.submitted_by_user_id::text = $1::text

      union all

      select
        ppl.id::text,
        (('x' || substr(md5(ppl.id::text), 1, 6))::bit(24)::int)::text,
        coalesce(c.company_name, p.name, 'Unknown'),
        ppl.url,
        ppl.created_at,
        'product_posting',
        ppl.id::text
      from drm.product_posting_evidence_links ppl
      left join drm.projects p  on ppl.project_id = p.id
      left join drm.customers c on p.customer_id = c.id
      where ppl.created_by_user_id::text = $1::text

      union all

      select
        sel.id::text,
        (('x' || substr(md5(sel.id::text), 1, 6))::bit(24)::int)::text,
        coalesce(c.company_name, p.name, 'Unknown'),
        sel.url,
        sel.created_at,
        'software',
        sel.id::text
      from drm.software_evidence_links sel
      left join drm.projects p  on sel.project_id = p.id
      left join drm.customers c on p.customer_id = c.id
      where sel.created_by_user_id::text = $1::text
    )
    select id, display_id as "displayId", company, links, date,
           source_module as "sourceModule", source_record_id as "sourceRecordId"
      from combined
     where date >= $2::date
       and date < ($3::date + interval '1 day')
     order by date asc
    `,
    [userId, startDate, endDate],
  );
  return rows as LinkReportRow[];
}

/** Existing verification for a user + exact date range, if any. */
export async function getVerification(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{ id: string; totalLinks: number; reward: string; status: string } | null> {
  const { rows } = await pool.query(
    `select id, total_links as "totalLinks", reward, status
       from drm.link_report_commission_verifications
      where user_id::text = $1::text and start_date = $2::date and end_date = $3::date
      order by created_at desc
      limit 1`,
    [userId, startDate, endDate],
  );
  return rows[0] ?? null;
}

/**
 * Record a commission verification for a user + date range. The submitted
 * linkReportIds must all belong to the rows returned by the same filter.
 * Reward defaults to 0 (matching the screenshot). Idempotent per range.
 */
export async function verifyCommission(params: {
  userId: string;
  verifiedByUserId: string;
  startDate: string;
  endDate: string;
  linkReportIds: string[];
}): Promise<{
  id: string;
  userId: string;
  verifiedByUserId: string;
  startDate: string;
  endDate: string;
  totalLinks: number;
  reward: string;
  status: string;
  createdAt: string;
}> {
  const { userId, verifiedByUserId, startDate, endDate, linkReportIds } = params;

  const reportRows = await listLinkReport(userId, startDate, endDate);
  const validIds = new Set(reportRows.map((r) => r.id));
  const ids = Array.from(new Set((linkReportIds ?? []).map(String)));
  for (const id of ids) {
    if (!validIds.has(id)) {
      throw Object.assign(new Error("One or more link ids do not match the selected filter"), {
        statusCode: 400,
      });
    }
  }
  const effectiveIds = ids.length > 0 ? ids : Array.from(validIds);
  const totalLinks = effectiveIds.length;

  // Race-safe upsert: one verification per (user_id, start_date, end_date).
  const { rows } = await pool.query(
    `insert into drm.link_report_commission_verifications
        (user_id, verified_by_user_id, start_date, end_date, link_report_ids, total_links, reward, status)
     values ($1, $2, $3::date, $4::date, $5::jsonb, $6, 0, 'VERIFIED')
     on conflict (user_id, start_date, end_date) do update
        set link_report_ids = excluded.link_report_ids,
            total_links = excluded.total_links,
            verified_by_user_id = excluded.verified_by_user_id,
            status = 'VERIFIED',
            updated_at = now()
     returning id, user_id as "userId", verified_by_user_id as "verifiedByUserId",
               start_date as "startDate", end_date as "endDate",
               total_links as "totalLinks", reward, status, created_at as "createdAt"`,
    [userId, verifiedByUserId, startDate, endDate, JSON.stringify(effectiveIds), totalLinks],
  );
  return rows[0];
}

/** Optional: create a manual link report row. */
export async function createLinkReport(params: {
  submittedByUserId: string;
  companyName: string;
  linkUrl: string;
  companyId?: string | null;
}): Promise<{ id: string; displayId: number }> {
  const { submittedByUserId, companyName, linkUrl, companyId } = params;
  const { rows } = await pool.query(
    `insert into drm.link_reports
        (submitted_by_user_id, company_id, company_name, link_url, source_module)
     values ($1, $2, $3, $4, 'manual')
     returning id, display_id as "displayId"`,
    [submittedByUserId, companyId ?? null, companyName ?? "", linkUrl],
  );
  return rows[0];
}
