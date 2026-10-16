import { Express, Request, Response } from "express";
import { pool } from "../db";

/**
 * "Follow Up Report" — legacy's followreport.php + func.php's
 * user_id_followUp_view handler, backed by the REAL, already-live
 * drm.follow_ups table (unlike the Diagnose Report, no new table was needed
 * here). Legacy's "Purpose" and "Service For" columns don't exist on
 * follow_ups itself, but drm.followup_subservice_details (written by the
 * service-appointment follow-up form) carries real purpose/service_code/
 * subservice_code/method/note values keyed by followup_id — confirmed live
 * against real data before wiring this up, not guessed.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_SQL = `
  SELECT f.id, f.created_at, c.company_name,
         d.purpose,
         d.service_code,
         d.subservice_code,
         COALESCE(d.method, f.method) AS method,
         COALESCE(f.notes, d.note) AS note
  FROM drm.follow_ups f
  LEFT JOIN drm.customers c ON c.id = f.customer_id
  LEFT JOIN drm.followup_subservice_details d ON d.followup_id = f.id`;

function mapRow(r: any) {
  return {
    id: r.id,
    date: r.created_at,
    companyName: r.company_name ?? null,
    purpose: r.purpose ?? null,
    service: r.service_code ?? null,
    subService: r.subservice_code ?? null,
    method: r.method ?? null,
    note: r.note ?? null,
  };
}

type BuiltFilters =
  | { ok: true; where: string; params: any[] }
  | { ok: false; status: number; message: string };

function buildFilters(req: Request): BuiltFilters {
  const q = req.query as Record<string, any>;
  const conditions: string[] = ["coalesce(f.is_deleted, false) = false"];
  const params: any[] = [];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  const userId = (q.userId ? String(q.userId) : "").trim();
  if (userId && userId.toLowerCase() !== "all") {
    if (!UUID_RE.test(userId)) return { ok: false, status: 400, message: "Invalid person filter." };
    conditions.push(`f.assigned_to = ${add(userId)}::uuid`);
  }

  // Case-insensitive: the frontend offers legacy's labels ("Mobile", "E-mail")
  // but real data was written with different casing conventions ("MOBILE").
  const method = (q.method ? String(q.method) : "").trim();
  if (method && method.toLowerCase() !== "all") {
    conditions.push(`COALESCE(d.method, f.method) ILIKE ${add(method)}`);
  }

  const startDate = (q.startDate ? String(q.startDate) : "").trim();
  const endDate = (q.endDate ? String(q.endDate) : "").trim();
  if (startDate) {
    if (Number.isNaN(Date.parse(startDate))) return { ok: false, status: 400, message: "Invalid start date." };
    conditions.push(`f.created_at >= ${add(startDate)}::date`);
  }
  if (endDate) {
    if (Number.isNaN(Date.parse(endDate))) return { ok: false, status: 400, message: "Invalid end date." };
    conditions.push(`f.created_at < (${add(endDate)}::date + interval '1 day')`);
  }
  if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
    return { ok: false, status: 400, message: "Start date must be on or before the end date." };
  }

  return { ok: true, where: `WHERE ${conditions.join(" AND ")}`, params };
}

export function registerFollowUpReportRoutes(app: Express) {
  // GET /api/reports/follow-up — ?userId=<uuid>|all&method=<value>|all&startDate=&endDate=
  app.get("/api/reports/follow-up", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const built = buildFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const result = await pool.query(
        `${SELECT_SQL} ${built.where} ORDER BY f.created_at DESC`,
        built.params,
      );
      res.json({ rows: result.rows.map(mapRow) });
    } catch (err) {
      console.error("[follow-up-report] list failed", err);
      res.status(500).json({ error: "Failed to load the follow-up report." });
    }
  });

  // GET /api/reports/follow-up/export — CSV honoring the same filters.
  app.get("/api/reports/follow-up/export", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const built = buildFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const result = await pool.query(
        `${SELECT_SQL} ${built.where} ORDER BY f.created_at DESC`,
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
      const headers = ["Company", "Purpose", "Service", "Sub Service", "Method", "Note", "Date"];
      const lines = [headers.join(",")];
      rows.forEach((r) => {
        lines.push(
          [r.companyName ?? "", r.purpose ?? "", r.service ?? "", r.subService ?? "", r.method ?? "", r.note ?? "", fmtDate(r.date)]
            .map(esc)
            .join(","),
        );
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="follow_up_report.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("[follow-up-report] export failed", err);
      res.status(500).json({ error: "Failed to export the follow-up report." });
    }
  });
}
