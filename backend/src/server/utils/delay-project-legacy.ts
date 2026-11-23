import type { Pool } from "pg";
import { pool } from "../db";

const EXCLUDED_PROJECTS = [
  "Domain Registration",
  "1 Year",
  "country Base Domain",
  "On Request (Custom Price)",
  "Pk Domain (2 Years)",
  "Hosting Plan",
  "Aluminum Hosting Plan",
  "Copper Hosting Plan",
  "Silver Hosting Plan",
  "Gold Hosting Plan",
  "Diamond Hosting Plan",
  "Platinum Hosting Plan",
  "SSL Certificate",
  "Cloud Vps Professional",
  "Cloud Vps Business",
];

export type DelaySection =
  | "all"
  | "ab-doc"
  | "vas-doc"
  | "hod"
  | "dep-not-assign"
  | "not-start"
  | "qa-dep"
  | "vf-dep";

export interface LegacyDelayProjectFilters {
  departmentId?: string;
  userId?: string;
  section?: DelaySection;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function parseTs(raw: string | null | undefined): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const d = new Date(String(raw).trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mirrors legacy PHP `calculateDelay` badge values (0 = on time, N/A = unknown, else delay days). */
function delayBadge(start: Date | null, finish: Date | null, offsetDays: number): string {
  if (!start) return "N/A";
  const deadline = new Date(start);
  deadline.setUTCDate(deadline.getUTCDate() + offsetDays);
  const end = finish ?? new Date();
  if (finish && end.getTime() <= deadline.getTime()) return "0";
  const ms = end.getTime() - deadline.getTime();
  const days = Math.ceil(ms / 86_400_000);
  return days > 0 ? String(days) : "0";
}

export interface LegacyDelayProjectRow {
  id: string;
  project: string;
  createDate: string | null;
  company: string;
  person: string;
  dep: string;
  deadline: string | null;
  days: string;
  hod: string;
  vasDocs: string;
  depApp: string;
  depNotAssign: string;
  taskNotStart: string;
  depNotEnd: string;
  qaDepP: string;
  vfyDepP: string;
  projectDeadLine: string;
  delaySection: string | null;
  legacySource: true;
}

function sectionFilterSql(section: DelaySection): string {
  switch (section) {
    case "ab-doc":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_verify_gm v WHERE v.com_id = b.com_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM legacy_archive.webxl_gm_doc g WHERE g.com_id = b.com_id
        )`;
    case "vas-doc":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_project_status ps
          WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
            AND lower(trim(ps.status)) LIKE '%document%pand%'
        )`;
    case "hod":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_status_hod h
          WHERE h.com_id = b.com_id AND trim(coalesce(h.hod_status, '')) = '0'
        )`;
    case "dep-not-assign":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_project_status ps
          WHERE ps.pro_id = b.pro_id AND trim(coalesce(ps.mag_verify, '')) = '1'
            AND trim(coalesce(ps.status, '')) = 'Start Work'
        )
        AND NOT EXISTS (
          SELECT 1 FROM legacy_archive.webxl_task_assign ta WHERE ta.pro_id = b.pro_id
        )`;
    case "not-start":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_task_assign ta
          WHERE ta.pro_id = b.pro_id AND lower(trim(coalesce(ta.stauts, ''))) = 'panding'
        )`;
    case "qa-dep":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_task_assign ta
          WHERE ta.pro_id = b.pro_id
            AND lower(trim(coalesce(ta.mng_status, ''))) = 'complete'
            AND (ta.qa_status IS NULL OR trim(ta.qa_status) = '')
        )`;
    case "vf-dep":
      return `AND EXISTS (
          SELECT 1 FROM legacy_archive.webxl_task_assign ta
          WHERE ta.pro_id = b.pro_id AND trim(coalesce(ta.qa_status, '')) = '1'
            AND (ta.fy_status IS NULL OR trim(ta.fy_status) = '')
        )`;
    default:
      return "";
  }
}

export async function fetchLegacyDelayProjectsDetailed(
  filters: LegacyDelayProjectFilters = {},
  db: Pool = pool,
): Promise<{ rows: LegacyDelayProjectRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200);
  const offset = (page - 1) * pageSize;
  const section: DelaySection = filters.section ?? "all";

  const start =
    filters.startDate && !Number.isNaN(new Date(filters.startDate).getTime())
      ? new Date(filters.startDate).toISOString().slice(0, 10)
      : null;
  const end =
    filters.endDate && !Number.isNaN(new Date(filters.endDate).getTime())
      ? new Date(filters.endDate).toISOString().slice(0, 10)
      : null;

  const params: unknown[] = [EXCLUDED_PROJECTS];
  let paramIdx = 1;

  let dateFilter = `AND NULLIF(trim(cp.create_data), '')::timestamp > NOW() - INTERVAL '3 months'`;
  if (start) {
    params.push(start);
    paramIdx++;
    dateFilter = `AND NULLIF(trim(cp.create_data), '')::date >= $${paramIdx}::date`;
  }
  if (end) {
    params.push(end);
    paramIdx++;
    dateFilter += ` AND NULLIF(trim(cp.create_data), '')::date <= $${paramIdx}::date`;
  }

  let deptFilter = "";
  if (filters.departmentId && filters.departmentId !== "all") {
    params.push(filters.departmentId);
    paramIdx++;
    deptFilter = `AND qs.dep_id = $${paramIdx}`;
  }

  let userFilter = "";
  if (filters.userId && filters.userId !== "all") {
    params.push(filters.userId);
    paramIdx++;
    userFilter = `AND cp.user_id = $${paramIdx}`;
  }

  let searchFilter = "";
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
    searchFilter = `AND (
      cp.project ILIKE $${paramIdx}
      OR cp.pro_id ILIKE $${paramIdx}
      OR co.cname ILIKE $${paramIdx}
    )`;
  }

  const sectionSql = sectionFilterSql(section);

  const baseCte = `
    WITH open_projects AS (
      SELECT
        cp.pro_id,
        cp.com_id,
        cp.project,
        cp.create_data,
        cp.user_id,
        co.cname AS company,
        qs.dep_id,
        qs.min_day,
        d.name AS dep_name,
        u.name AS person_name
      FROM legacy_archive.webxl_create_project cp
      LEFT JOIN legacy_archive.webxl_company co ON co.id = cp.com_id
      LEFT JOIN legacy_archive.webxl_quotation_services qs ON qs.name = cp.project
      LEFT JOIN legacy_archive.webxl_department d ON d.id = qs.dep_id
      LEFT JOIN legacy_archive.webxl_user u ON u.user_id = cp.user_id
      LEFT JOIN legacy_archive.webxl_task_assign ta ON ta.pro_id = cp.pro_id
      WHERE cp.pro_id IS NOT NULL AND trim(cp.pro_id) <> ''
        AND cp.project <> ALL ($1::text[])
        ${dateFilter}
        ${deptFilter}
        ${userFilter}
        ${searchFilter}
      GROUP BY cp.pro_id, cp.com_id, cp.project, cp.create_data, cp.user_id,
               co.cname, qs.dep_id, qs.min_day, d.name, u.name
      HAVING COALESCE(SUM(CASE WHEN trim(coalesce(ta.fy_status, '')) = '1' THEN 1 ELSE 0 END), 0) = 0
    ),
    filtered AS (
      SELECT b.* FROM open_projects b
      WHERE 1=1 ${sectionSql}
    )
  `;

  const countResult = await db.query(`${baseCte} SELECT count(*)::int AS total FROM filtered`, params);
  const total = countResult.rows[0]?.total ?? 0;

  params.push(pageSize, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const listSql = `
    ${baseCte}
    SELECT
      b.pro_id,
      b.com_id,
      b.project,
      b.create_data,
      b.company,
      b.person_name,
      b.dep_name,
      b.min_day,
      (SELECT h.create_date FROM legacy_archive.webxl_status_hod h
        WHERE h.com_id = b.com_id ORDER BY NULLIF(trim(h.id), '')::bigint DESC NULLS LAST LIMIT 1) AS hod_create,
      (SELECT h.update_date FROM legacy_archive.webxl_status_hod h
        WHERE h.com_id = b.com_id ORDER BY NULLIF(trim(h.id), '')::bigint DESC NULLS LAST LIMIT 1) AS hod_update,
      (SELECT ps.pro_update FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS vas_start,
      (SELECT ps.upload_doc FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS vas_finish,
      (SELECT ps.upload_doc FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS dep_app_start,
      (SELECT ps.vfy_date FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS dep_app_finish,
      (SELECT ps.vfy_date FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS dep_na_start,
      (SELECT ps.assign_date FROM legacy_archive.webxl_project_status ps
        WHERE ps.com_id = b.com_id AND ps.pro_id = b.pro_id
        ORDER BY NULLIF(trim(ps.id), '')::bigint DESC NULLS LAST LIMIT 1) AS dep_na_finish,
      (SELECT ta.assign_date FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS task_start,
      (SELECT ta.last_update FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS task_finish,
      (SELECT ta.last_update FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS qa_start,
      (SELECT ta.qa_date FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS qa_finish,
      (SELECT ta.qa_date FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS vfy_start,
      (SELECT ta.fy_date FROM legacy_archive.webxl_task_assign ta
        WHERE ta.pro_id = b.pro_id ORDER BY NULLIF(trim(ta.id), '')::bigint DESC NULLS LAST LIMIT 1) AS vfy_finish
    FROM filtered b
    ORDER BY NULLIF(trim(b.pro_id), '')::bigint DESC NULLS LAST
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(listSql, params);

  const mapped: LegacyDelayProjectRow[] = rows.map((r) => {
    const createDate = parseTs(r.create_data);
    const minDay = parseInt(String(r.min_day || "0"), 10) || 0;

    const hod = delayBadge(parseTs(r.hod_create), parseTs(r.hod_update), 1);
    const vasDocs = delayBadge(parseTs(r.vas_start), parseTs(r.vas_finish), 1);
    const depApp = delayBadge(parseTs(r.dep_app_start), parseTs(r.dep_app_finish), 1);
    const depNotAssign = delayBadge(parseTs(r.dep_na_start), parseTs(r.dep_na_finish), 2);
    const taskNotStart = delayBadge(parseTs(r.task_start), parseTs(r.task_finish), 1);
    const depNotEnd = delayBadge(parseTs(r.qa_start), parseTs(r.qa_finish), 1);
    const qaDepP = delayBadge(parseTs(r.qa_start), parseTs(r.qa_finish), 1);
    const vfyDepP = delayBadge(parseTs(r.vfy_start), parseTs(r.vfy_finish), 1);

    const projectEnd = parseTs(r.vfy_finish);
    const projectDeadLine = delayBadge(createDate, projectEnd, minDay || 1);
    const days =
      createDate && minDay
        ? delayBadge(createDate, projectEnd, minDay)
        : projectDeadLine !== "N/A"
          ? projectDeadLine
          : "0";

    let delaySection: string | null = null;
    if (section === "ab-doc") delaySection = "Ab-Doc";
    else if (section === "vas-doc") delaySection = "Vas Doc Pending";

    const deadline =
      createDate && minDay
        ? new Date(createDate.getTime() + minDay * 86_400_000).toISOString()
        : null;

    return {
      id: String(r.pro_id),
      project: String(r.project || ""),
      createDate: createDate ? createDate.toISOString() : r.create_data ?? null,
      company: String(r.company || "N/A"),
      person: String(r.person_name || "Unknown"),
      dep: String(r.dep_name || "N/A").replace(/\s+/g, " ").trim(),
      deadline,
      days,
      hod,
      vasDocs,
      depApp,
      depNotAssign,
      taskNotStart,
      depNotEnd,
      qaDepP,
      vfyDepP,
      projectDeadLine,
      delaySection,
      legacySource: true as const,
    };
  });

  return { rows: mapped, total };
}

export async function fetchLegacyDelaySectionCounts(db: Pool = pool): Promise<Record<string, number>> {
  const sections: DelaySection[] = [
    "ab-doc",
    "vas-doc",
    "hod",
    "dep-not-assign",
    "not-start",
    "qa-dep",
    "vf-dep",
  ];
  const pairs = await Promise.all(
    sections.map(async (section) => {
      const { total } = await fetchLegacyDelayProjectsDetailed({ section, page: 1, pageSize: 1 }, db);
      return [section, total] as const;
    }),
  );
  return Object.fromEntries(pairs);
}
