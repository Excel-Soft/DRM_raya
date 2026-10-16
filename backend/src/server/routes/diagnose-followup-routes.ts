import { Express, Request, Response } from "express";
import { pool } from "../db";

/**
 * "Diagnose Report" — legacy's webxl_followup_service customer follow-up /
 * account-health survey (diagnosereport.php + func.php's daignose_user_id
 * handler). Replaces the unrelated ticket-based diagnosis_reports system that
 * previously lived at this same page.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_SQL = `
  SELECT d.id, d.create_date, c.company_name, u.full_name AS person_name,
         d.start_rating, d.up_salling, d.rfq, d.products, d.follow_rate,
         d.sample, d.order_info, d.revenue, d.happy_alibaba, d.happy_webxl, d.report
  FROM drm.diagnose_followups d
  LEFT JOIN drm.customers c ON c.id = d.company_id
  LEFT JOIN drm.users u ON u.id = d.user_id`;

function mapRow(r: any) {
  return {
    id: r.id,
    createDate: r.create_date,
    companyName: r.company_name ?? null,
    personName: r.person_name ?? null,
    startRating: r.start_rating ?? null,
    upSalling: r.up_salling ?? null,
    rfq: r.rfq ?? null,
    products: r.products ?? null,
    followRate: r.follow_rate ?? null,
    sample: r.sample ?? null,
    orderInfo: r.order_info ?? null,
    revenue: r.revenue ?? null,
    happyAlibaba: r.happy_alibaba ?? null,
    happyWebxl: r.happy_webxl ?? null,
    report: r.report ?? null,
  };
}

type BuiltFilters =
  | { ok: true; where: string; params: any[] }
  | { ok: false; status: number; message: string };

function buildFilters(req: Request): BuiltFilters {
  const q = req.query as Record<string, any>;
  const conditions: string[] = [];
  const params: any[] = [];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  const userId = (q.userId ? String(q.userId) : "").trim();
  if (userId && userId.toLowerCase() !== "all") {
    if (!UUID_RE.test(userId)) return { ok: false, status: 400, message: "Invalid person filter." };
    conditions.push(`d.user_id = ${add(userId)}::uuid`);
  }

  const startDate = (q.startDate ? String(q.startDate) : "").trim();
  const endDate = (q.endDate ? String(q.endDate) : "").trim();
  if (startDate) {
    if (Number.isNaN(Date.parse(startDate))) return { ok: false, status: 400, message: "Invalid start date." };
    conditions.push(`d.create_date >= ${add(startDate)}::date`);
  }
  if (endDate) {
    if (Number.isNaN(Date.parse(endDate))) return { ok: false, status: 400, message: "Invalid end date." };
    conditions.push(`d.create_date < (${add(endDate)}::date + interval '1 day')`);
  }
  if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
    return { ok: false, status: 400, message: "Start date must be on or before the end date." };
  }

  return { ok: true, where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export function registerDiagnoseFollowupRoutes(app: Express) {
  // GET /api/reports/diagnose — the report's data source. ?userId=<uuid>|all
  // &startDate=&endDate= mirrors the legacy form's Person/Start/End filters.
  app.get("/api/reports/diagnose", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const built = buildFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const result = await pool.query(
        `${SELECT_SQL} ${built.where} ORDER BY d.create_date DESC`,
        built.params,
      );
      res.json({ rows: result.rows.map(mapRow) });
    } catch (err) {
      console.error("[diagnose-followup] list failed", err);
      res.status(500).json({ error: "Failed to load the diagnose report." });
    }
  });

  // GET /api/reports/diagnose/export — CSV honoring the same filters.
  app.get("/api/reports/diagnose/export", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const built = buildFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const result = await pool.query(
        `${SELECT_SQL} ${built.where} ORDER BY d.create_date DESC`,
        built.params,
      );
      const rows = result.rows.map(mapRow);

      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const fmtDate = (v: any): string => {
        if (!v) return "";
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().replace("T", " ").slice(0, 19);
      };
      const headers = [
        "#", "Create", "Company", "Person", "Start Rating", "Up Salling", "Rfq", "Products",
        "Follow Rate", "Sample", "Order", "Revenue", "Happy Alibaba", "Happy Webxl", "Report Send",
      ];
      const lines = [headers.join(",")];
      rows.forEach((r, i) => {
        lines.push(
          [
            i + 1, fmtDate(r.createDate), r.companyName ?? "", r.personName ?? "", r.startRating ?? "",
            r.upSalling ?? "", r.rfq ?? "", r.products ?? "", r.followRate ?? "", r.sample ?? "",
            r.orderInfo ?? "", r.revenue ?? "", r.happyAlibaba ?? "", r.happyWebxl ?? "", r.report ?? "",
          ].map(esc).join(","),
        );
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="diagnose_report.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("[diagnose-followup] export failed", err);
      res.status(500).json({ error: "Failed to export the diagnose report." });
    }
  });
}
