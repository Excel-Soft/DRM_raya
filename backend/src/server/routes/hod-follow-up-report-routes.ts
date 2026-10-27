/**
 * HOD "Follow Up Report" — rebuild of a legacy PHP report (two sections, the
 * user supplied the old PHP source as a spec; it ran against a different
 * MySQL system entirely with numeric service ids 316/317/318/319/332). Real
 * implementation against the current drm.* schema:
 *
 *  - Section 1 "Sale Teams Activity/Follow Up Report" — backed by the real,
 *    already-live drm.followup_subservice_details + drm.follow_ups +
 *    drm.customers + drm.users (same join GET /api/reports/follow-up and
 *    GET /api/dashboard/activities already use). Service/sub-service names
 *    resolved from the FOLLOWUP_MAIN_SERVICES / FOLLOWUP_SUBSERVICE_NAMES
 *    catalog (no joins needed — service_code/subservice_code are already
 *    denormalized text on followup_subservice_details).
 *
 *  - Section 2 "Service Team Follow Up Report" — the legacy PHP's columns
 *    (Start Rating/Up Selling/RFQ/Products/Follow Rate/Sample/Order/Revenue/
 *    Happy Alibaba/Happy Webxl) match drm.diagnose_followups exactly (same
 *    table GET /api/reports/diagnose already uses). That table has no
 *    service/grade columns at all, so — unlike Section 1 — there is no real
 *    data to back a service/grade drill-down here; this section is a
 *    date-range + search list only. Ported honestly, not guessed.
 *
 *  - "HOD Comment" didn't exist as a column anywhere (only manager_comment/
 *    sm_comment existed, and only on follow_ups) — added hod_comment to both
 *    follow_ups and diagnose_followups below, following the same
 *    `alter table ... add column if not exists` convention already used for
 *    manager_comment/sm_comment in followups.repository.ts.
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { FOLLOWUP_MAIN_SERVICES, FOLLOWUP_SUBSERVICE_NAMES } from "../../shared/followup-services-catalog";

// The real data written by the follow-up form uses a bare slug of the
// sub-service display name (e.g. "GGS Digital" -> "GGS_DIGITAL") with no
// per-main-service prefix — confirmed against real stored
// followup_subservice_details.subservice_code values, which do NOT match
// stableFollowupSubserviceCode()'s "FUP_<mainCode>_<slug>" format. A few
// older rows ("BASIC_PACKAGE", "HOSTING") don't match the current catalog's
// names 1:1 (catalog drift) — those fall back to showing the raw code.
function bareSlug(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

let ensured = false;
async function ensureHodCommentColumns() {
  if (ensured) return;
  try {
    await pool.query(`alter table drm.follow_ups add column if not exists hod_comment text`);
    await pool.query(`alter table drm.diagnose_followups add column if not exists hod_comment text`);
  } catch (err) {
    console.error("Failed ensuring hod_comment columns (continuing):", err);
  } finally {
    ensured = true;
  }
}

// code -> display name, e.g. "FUP_ALIBABA_MEMBER_GGS_DIGITAL" -> "GGS Digital"
const SUBSERVICE_NAME_BY_CODE = new Map<string, string>();
for (const main of FOLLOWUP_MAIN_SERVICES) {
  for (const subName of FOLLOWUP_SUBSERVICE_NAMES[main.code] ?? []) {
    SUBSERVICE_NAME_BY_CODE.set(bareSlug(subName), subName);
  }
}
const MAIN_SERVICE_NAME_BY_CODE = new Map(FOLLOWUP_MAIN_SERVICES.map((s) => [s.code, s.name]));

function parseDateRange(req: Request, res: Response): { from: string; to: string } | null {
  const startDate = String(req.query.startDate ?? "");
  const endDate = String(req.query.endDate ?? "");
  if (!startDate || !endDate) {
    res.status(400).json({ error: "BadRequest", message: "startDate and endDate are required (YYYY-MM-DD)" });
    return null;
  }
  if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
    res.status(400).json({ error: "BadRequest", message: "Invalid startDate or endDate" });
    return null;
  }
  return { from: startDate, to: endDate };
}

export function registerHodFollowUpReportRoutes(app: Express) {
  // ─── Section 1: Sale Teams Activity/Follow Up Report ──────────────────

  app.get("/api/reports/hod-follow-up/sale/service-counts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const result = await pool.query(
        `select d.service_code, count(*)::int as total
           from drm.followup_subservice_details d
           join drm.follow_ups f on f.id = d.followup_id
          where coalesce(f.is_deleted, false) = false
            and coalesce(d.created_at, f.created_at) >= $1 and coalesce(d.created_at, f.created_at) < ($2::date + interval '1 day')
          group by d.service_code`,
        [range.from, range.to],
      );
      const byCode = new Map(result.rows.map((r) => [r.service_code, Number(r.total)]));
      const counts = FOLLOWUP_MAIN_SERVICES.map((s) => ({ code: s.code, name: s.name, total: byCode.get(s.code) ?? 0 }));
      res.json({ counts });
    } catch (error) {
      console.error("Error building sale service counts", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load service counts" });
    }
  });

  app.get("/api/reports/hod-follow-up/sale/service-type-summary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const serviceCode = String(req.query.serviceCode ?? "");
      if (!serviceCode) return res.status(400).json({ error: "BadRequest", message: "serviceCode is required" });

      const result = await pool.query(
        `select d.subservice_code, count(*)::int as total
           from drm.followup_subservice_details d
           join drm.follow_ups f on f.id = d.followup_id
          where coalesce(f.is_deleted, false) = false
            and d.service_code = $1
            and coalesce(d.created_at, f.created_at) >= $2 and coalesce(d.created_at, f.created_at) < ($3::date + interval '1 day')
          group by d.subservice_code
          order by total desc`,
        [serviceCode, range.from, range.to],
      );
      const items = result.rows.map((r) => ({
        code: r.subservice_code,
        name: SUBSERVICE_NAME_BY_CODE.get(r.subservice_code) ?? r.subservice_code,
        total: Number(r.total),
      }));
      res.json({ items });
    } catch (error) {
      console.error("Error building service type summary", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load service type summary" });
    }
  });

  app.get("/api/reports/hod-follow-up/sale/grade-summary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const serviceCode = String(req.query.serviceCode ?? "");
      const subserviceCode = String(req.query.subserviceCode ?? "");
      if (!serviceCode || !subserviceCode) {
        return res.status(400).json({ error: "BadRequest", message: "serviceCode and subserviceCode are required" });
      }

      const result = await pool.query(
        `select coalesce(nullif(d.grade, ''), 'N/A') as grade, count(*)::int as total
           from drm.followup_subservice_details d
           join drm.follow_ups f on f.id = d.followup_id
          where coalesce(f.is_deleted, false) = false
            and d.service_code = $1 and d.subservice_code = $2
            and coalesce(d.created_at, f.created_at) >= $3 and coalesce(d.created_at, f.created_at) < ($4::date + interval '1 day')
          group by 1
          order by total desc`,
        [serviceCode, subserviceCode, range.from, range.to],
      );
      res.json({ items: result.rows.map((r) => ({ grade: r.grade, total: Number(r.total) })) });
    } catch (error) {
      console.error("Error building grade summary", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load grade summary" });
    }
  });

  app.get("/api/reports/hod-follow-up/sale/data", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureHodCommentColumns();
      const range = parseDateRange(req, res);
      if (!range) return;
      const serviceCode = req.query.serviceCode ? String(req.query.serviceCode) : "";
      const subserviceCode = req.query.subserviceCode ? String(req.query.subserviceCode) : "";
      const grade = req.query.grade ? String(req.query.grade) : "";
      const search = req.query.search ? String(req.query.search).trim() : "";
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

      const conditions = [
        "coalesce(f.is_deleted, false) = false",
        `coalesce(d.created_at, f.created_at) >= $1`,
        `coalesce(d.created_at, f.created_at) < ($2::date + interval '1 day')`,
      ];
      const params: any[] = [range.from, range.to];
      if (serviceCode) { params.push(serviceCode); conditions.push(`d.service_code = $${params.length}`); }
      if (subserviceCode) { params.push(subserviceCode); conditions.push(`d.subservice_code = $${params.length}`); }
      if (grade) { params.push(grade === "N/A" ? "" : grade); conditions.push(grade === "N/A" ? `coalesce(d.grade, '') = $${params.length}` : `d.grade = $${params.length}`); }
      if (search) { params.push(`%${search}%`); conditions.push(`(c.company_name ILIKE $${params.length} OR coalesce(u.full_name, u.name, u.username) ILIKE $${params.length})`); }
      const where = conditions.join(" and ");

      const countRes = await pool.query(
        `select count(*)::int as total
           from drm.followup_subservice_details d
           join drm.follow_ups f on f.id = d.followup_id
           left join drm.customers c on c.id = f.customer_id
           left join drm.users u on u.id = f.assigned_to
          where ${where}`,
        params,
      );
      const total = Number(countRes.rows[0]?.total ?? 0);

      params.push(limit, (page - 1) * limit);
      const dataRes = await pool.query(
        `select d.id, f.id as followup_id, coalesce(u.full_name, u.name, u.username) as sale_person,
                c.company_name, d.service_code, d.subservice_code, d.grade, d.purpose,
                coalesce(d.method, f.method) as method, f.due_at as next_date, d.comment,
                coalesce(d.created_at, f.created_at) as created_at,
                coalesce(f.notes, d.note) as followup_note,
                f.manager_comment, f.sm_comment, f.hod_comment
           from drm.followup_subservice_details d
           join drm.follow_ups f on f.id = d.followup_id
           left join drm.customers c on c.id = f.customer_id
           left join drm.users u on u.id = f.assigned_to
          where ${where}
          order by coalesce(d.created_at, f.created_at) desc
          limit $${params.length - 1} offset $${params.length}`,
        params,
      );

      const rows = dataRes.rows.map((r, idx) => ({
        no: (page - 1) * limit + idx + 1,
        id: r.id,
        followupId: r.followup_id,
        salePerson: r.sale_person ?? "-",
        companyName: r.company_name ?? "-",
        mainService: MAIN_SERVICE_NAME_BY_CODE.get(r.service_code) ?? r.service_code ?? "-",
        subType: SUBSERVICE_NAME_BY_CODE.get(r.subservice_code) ?? r.subservice_code ?? "-",
        grade: r.grade || "-",
        purpose: r.purpose ?? "-",
        method: r.method ?? "-",
        nextDate: r.next_date,
        comment: r.comment ?? "-",
        createdDate: r.created_at,
        followupNote: r.followup_note ?? "-",
        managerComment: r.manager_comment,
        smComment: r.sm_comment,
        hodComment: r.hod_comment,
      }));
      res.json({ rows, total, page, limit });
    } catch (error) {
      console.error("Error building sale follow-up data", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load the follow-up report" });
    }
  });

  app.post("/api/reports/hod-follow-up/sale/:followupId/hod-comment", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureHodCommentColumns();
      const comment = String(req.body?.comment ?? "").trim();
      if (!comment) return res.status(400).json({ error: "BadRequest", message: "comment is required" });
      const result = await pool.query(
        `update drm.follow_ups set hod_comment = $2, updated_at = now() where id = $1 returning id, hod_comment`,
        [req.params.followupId, comment],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "NotFound", message: "Follow-up not found" });
      res.json({ success: true, hodComment: result.rows[0].hod_comment });
    } catch (error) {
      console.error("Error saving HOD comment (sale)", error);
      res.status(500).json({ error: "InternalError", message: "Failed to save comment" });
    }
  });

  // ─── Section 2: Service Team Follow Up Report ──────────────────────────
  // drm.diagnose_followups has no service/grade columns, so (unlike Section
  // 1) there is no real drill-down to offer here — date range + search only.

  app.get("/api/reports/hod-follow-up/service/data", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureHodCommentColumns();
      const range = parseDateRange(req, res);
      if (!range) return;
      const search = req.query.search ? String(req.query.search).trim() : "";
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

      const conditions = ["d.create_date >= $1", "d.create_date < ($2::date + interval '1 day')"];
      const params: any[] = [range.from, range.to];
      if (search) { params.push(`%${search}%`); conditions.push(`(c.company_name ILIKE $${params.length} OR coalesce(u.full_name, u.name, u.username) ILIKE $${params.length})`); }
      const where = conditions.join(" and ");

      const countRes = await pool.query(
        `select count(*)::int as total
           from drm.diagnose_followups d
           left join drm.customers c on c.id = d.company_id
           left join drm.users u on u.id = d.user_id
          where ${where}`,
        params,
      );
      const total = Number(countRes.rows[0]?.total ?? 0);

      params.push(limit, (page - 1) * limit);
      const dataRes = await pool.query(
        `select d.id, c.company_name, coalesce(u.full_name, u.name, u.username) as sale_person,
                d.start_rating, d.up_salling, d.rfq, d.products, d.follow_rate, d.sample,
                d.order_info, d.revenue, d.happy_alibaba, d.happy_webxl, d.report,
                d.create_date, d.hod_comment
           from drm.diagnose_followups d
           left join drm.customers c on c.id = d.company_id
           left join drm.users u on u.id = d.user_id
          where ${where}
          order by d.create_date desc
          limit $${params.length - 1} offset $${params.length}`,
        params,
      );

      const rows = dataRes.rows.map((r, idx) => ({
        no: (page - 1) * limit + idx + 1,
        id: r.id,
        companyName: r.company_name ?? "-",
        salePerson: r.sale_person ?? "-",
        report: r.report ?? "-",
        startRating: r.start_rating ?? "-",
        upSelling: r.up_salling ?? "-",
        rfq: r.rfq ?? "-",
        products: r.products ?? "-",
        followRate: r.follow_rate ?? "-",
        sample: r.sample ?? "-",
        order: r.order_info ?? "-",
        revenue: r.revenue ?? "-",
        happyAlibaba: r.happy_alibaba ?? "-",
        happyWebxl: r.happy_webxl ?? "-",
        createdDate: r.create_date,
        hodComment: r.hod_comment,
      }));
      res.json({ rows, total, page, limit });
    } catch (error) {
      console.error("Error building service follow-up data", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load the service follow-up report" });
    }
  });

  app.post("/api/reports/hod-follow-up/service/:id/hod-comment", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureHodCommentColumns();
      const comment = String(req.body?.comment ?? "").trim();
      if (!comment) return res.status(400).json({ error: "BadRequest", message: "comment is required" });
      const result = await pool.query(
        `update drm.diagnose_followups set hod_comment = $2 where id = $1 returning id, hod_comment`,
        [req.params.id, comment],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "NotFound", message: "Record not found" });
      res.json({ success: true, hodComment: result.rows[0].hod_comment });
    } catch (error) {
      console.error("Error saving HOD comment (service)", error);
      res.status(500).json({ error: "InternalError", message: "Failed to save comment" });
    }
  });
}
