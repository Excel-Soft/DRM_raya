import { Express, Request, Response } from "express";

import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";

/**
 * Patch 2 Stage 6 — Diagnosis Report.
 *
 * Dedicated, honest source for the Diagnosis Report. This deliberately does NOT
 * reuse `/api/reports/bv` (Business Volume) data — diagnosis is its own business
 * concept backed by `drm.diagnosis_reports` (created by ensureDiagnosisSchema).
 *
 * Registered BEFORE registerReportsRoutes so `/api/reports/diagnose` wins over
 * the `/reports/:type` catch-all in reports-routes.ts.
 *
 * Authorization is derived ONLY from the signed JWT (req.user.roleId / roles),
 * never from the client-supplied `x-acting-role` header. Row scope:
 *   - admin / super_admin (→admin) / super_hod / account_manager : ALL rows
 *   - hod + managerial roles                                      : team/department
 *   - everyone else (assigned user)                               : own records
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;

type Access = "all" | "team" | "own";

function rolesOf(req: Request): string[] {
  const u = req.user as any;
  const set = new Set<string>();
  if (u?.roleId) set.add(normalizeRole(u.roleId));
  if (Array.isArray(u?.roles)) {
    for (const r of u.roles) if (r) set.add(normalizeRole(r));
  }
  return Array.from(set);
}

function accessLevel(req: Request): Access {
  const roles = rolesOf(req);
  if (roles.some((r) => ["admin", "super_hod", "account_manager"].includes(r))) return "all";
  if (roles.some((r) => r === "hod" || isManagerialRole(r))) return "team";
  return "own";
}

function canExport(req: Request): boolean {
  // Matrix export set for diagnosis_report: admin/super_hod (always) + account_manager + hod.
  const roles = rolesOf(req);
  return roles.some((r) => ["admin", "super_hod", "account_manager", "hod"].includes(r));
}

async function teamUserIds(userId: string): Promise<{ ids: string[]; dept: string | null }> {
  const me = await pool.query(`SELECT department FROM drm.users WHERE id = $1::uuid`, [userId]);
  const dept = me.rows[0]?.department ?? null;
  const ids = new Set<string>([userId]);
  if (dept) {
    const t = await pool.query(`SELECT id FROM drm.users WHERE department = $1`, [dept]);
    for (const r of t.rows) ids.add(String(r.id));
  }
  return { ids: Array.from(ids), dept };
}

const SELECT_SQL = `
  SELECT d.id, d.diagnosis_date, d.company_name, d.person_name, d.diagnosis_type,
         d.diagnosis_status, d.branch, d.department, d.notes,
         au.full_name AS assigned_to_name,
         cb.full_name AS created_by_name,
         COALESCE(c.person_name, c.account_name) AS customer_name,
         c.company_name AS customer_company
  FROM drm.diagnosis_reports d
  LEFT JOIN drm.users au ON au.id = d.assigned_to
  LEFT JOIN drm.users cb ON cb.id = d.created_by
  LEFT JOIN drm.customers c ON c.id = d.customer_id`;

function mapRow(r: any) {
  return {
    id: r.id,
    diagnosisDate: r.diagnosis_date,
    companyName: r.company_name ?? r.customer_company ?? null,
    customerName: r.customer_name ?? null,
    personName: r.person_name ?? null,
    diagnosisType: r.diagnosis_type ?? null,
    status: r.diagnosis_status ?? null,
    assignedToName: r.assigned_to_name ?? null,
    branch: r.branch ?? null,
    department: r.department ?? null,
    notes: r.notes ?? null,
    createdByName: r.created_by_name ?? null,
  };
}

type BuiltScope =
  | { ok: true; where: string; params: any[] }
  | { ok: false; status: number; message: string };

/**
 * Compose the row-scope clause (from the JWT-derived access level) AND the
 * request's filters into a single parameterized WHERE. All identifiers are
 * uuid-validated before they touch a uuid column so a bad filter returns an
 * honest 400 instead of a 22P02 500.
 */
async function buildScopeAndFilters(req: Request): Promise<BuiltScope> {
  const u = req.user as any;
  const userId = String(u.userId);
  const access = accessLevel(req);
  const conditions: string[] = ["d.deleted_at IS NULL"];
  const params: any[] = [];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  // Row-level scope.
  if (access === "team") {
    const { ids, dept } = await teamUserIds(userId);
    const idsP = add(ids);
    if (dept) {
      const deptP = add(dept);
      conditions.push(
        `(d.assigned_to = ANY(${idsP}::uuid[]) OR d.created_by = ANY(${idsP}::uuid[]) OR d.department = ${deptP})`,
      );
    } else {
      conditions.push(`(d.assigned_to = ANY(${idsP}::uuid[]) OR d.created_by = ANY(${idsP}::uuid[]))`);
    }
  } else if (access === "own") {
    const meP = add(userId);
    conditions.push(`(d.assigned_to = ${meP}::uuid OR d.created_by = ${meP}::uuid)`);
  }

  const q = req.query as Record<string, any>;

  const person = (q.person ? String(q.person) : "").trim();
  if (person) conditions.push(`d.person_name ILIKE ${add(`%${person}%`)}`);

  const userIdFilter = (q.userId ? String(q.userId) : "").trim();
  if (userIdFilter && userIdFilter !== "all") {
    if (!UUID_RE.test(userIdFilter)) return { ok: false, status: 400, message: "Invalid person filter." };
    conditions.push(`d.assigned_to = ${add(userIdFilter)}::uuid`);
  }

  const customerId = (q.customerId ? String(q.customerId) : "").trim();
  if (customerId) {
    if (!UUID_RE.test(customerId)) return { ok: false, status: 400, message: "Invalid customer filter." };
    conditions.push(`d.customer_id = ${add(customerId)}::uuid`);
  }

  const companyName = (q.companyName ? String(q.companyName) : "").trim();
  if (companyName) conditions.push(`d.company_name ILIKE ${add(`%${companyName}%`)}`);

  const diagnosisType = (q.diagnosisType ? String(q.diagnosisType) : "").trim();
  if (diagnosisType) conditions.push(`d.diagnosis_type ILIKE ${add(`%${diagnosisType}%`)}`);

  const status = (q.status ? String(q.status) : "").trim().toUpperCase();
  if (status) {
    if (!STATUSES.includes(status as any)) return { ok: false, status: 400, message: "Invalid status filter." };
    conditions.push(`d.diagnosis_status = ${add(status)}`);
  }

  const branch = (q.branch ? String(q.branch) : "").trim();
  if (branch) conditions.push(`d.branch ILIKE ${add(`%${branch}%`)}`);

  const department = (q.department ? String(q.department) : "").trim();
  if (department) conditions.push(`d.department ILIKE ${add(`%${department}%`)}`);

  const startDate = (q.startDate ? String(q.startDate) : "").trim();
  const endDate = (q.endDate ? String(q.endDate) : "").trim();
  if (startDate) {
    if (Number.isNaN(Date.parse(startDate))) return { ok: false, status: 400, message: "Invalid start date." };
    conditions.push(`d.diagnosis_date >= ${add(startDate)}::date`);
  }
  if (endDate) {
    if (Number.isNaN(Date.parse(endDate))) return { ok: false, status: 400, message: "Invalid end date." };
    conditions.push(`d.diagnosis_date <= ${add(endDate)}::date`);
  }
  if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
    return { ok: false, status: 400, message: "Start date must be on or before the end date." };
  }

  return { ok: true, where: conditions.join(" AND "), params };
}

export function registerDiagnosisReportRoutes(app: Express) {
  // GET /api/reports/diagnose — filtered, scoped, paginated report + summary.
  app.get("/api/reports/diagnose", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const built = await buildScopeAndFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
      const offset = (page - 1) * limit;

      const { where, params } = built;

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM drm.diagnosis_reports d WHERE ${where}`,
        params,
      );
      const total = countRes.rows[0]?.total ?? 0;

      const summaryRes = await pool.query(
        `SELECT d.diagnosis_status AS status, COUNT(*)::int AS count
           FROM drm.diagnosis_reports d WHERE ${where} GROUP BY d.diagnosis_status`,
        params,
      );
      const byStatus: Record<string, number> = {};
      for (const s of STATUSES) byStatus[s] = 0;
      for (const row of summaryRes.rows) if (row.status) byStatus[row.status] = row.count;

      const listRes = await pool.query(
        `${SELECT_SQL} WHERE ${where}
           ORDER BY d.diagnosis_date DESC, d.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      res.json({
        filters: { scope: accessLevel(req) },
        rows: listRes.rows.map(mapRow),
        summary: { total, byStatus },
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (err) {
      console.error("[diagnose] list failed", err);
      res.status(500).json({ error: "Failed to load the diagnosis report." });
    }
  });

  // GET /api/reports/diagnose/export — CSV honoring the same filters + scope.
  app.get("/api/reports/diagnose/export", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canExport(req)) {
        return res.status(403).json({ error: "You do not have permission to export this report." });
      }
      const built = await buildScopeAndFilters(req);
      if (!built.ok) return res.status(built.status).json({ error: built.message });

      const listRes = await pool.query(
        `${SELECT_SQL} WHERE ${built.where} ORDER BY d.diagnosis_date DESC, d.created_at DESC`,
        built.params,
      );
      const rows = listRes.rows.map(mapRow);

      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const fmtDate = (v: any): string => {
        if (!v) return "";
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
      };
      const headers = [
        "#", "Date", "Company/Customer", "Person", "Diagnosis Type", "Status",
        "Assigned To", "Branch", "Department", "Notes", "Created By",
      ];
      const lines = [headers.join(",")];
      rows.forEach((r, i) => {
        const company = [r.companyName, r.customerName].filter(Boolean).join(" / ");
        lines.push(
          [
            i + 1, fmtDate(r.diagnosisDate), company, r.personName ?? "", r.diagnosisType ?? "",
            r.status ?? "", r.assignedToName ?? "", r.branch ?? "", r.department ?? "",
            r.notes ?? "", r.createdByName ?? "",
          ].map(esc).join(","),
        );
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="diagnosis_report.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("[diagnose] export failed", err);
      res.status(500).json({ error: "Failed to export the diagnosis report." });
    }
  });

  // POST /api/reports/diagnose — create a diagnosis record (no separate creation
  // UI exists yet; this backs QA + future entry). created_by = caller; own-only
  // callers can only assign to themselves.
  app.post("/api/reports/diagnose", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const access = accessLevel(req);
      const b = (req.body ?? {}) as Record<string, any>;

      const diagnosisDate = String(b.diagnosisDate ?? "").trim();
      if (!diagnosisDate || Number.isNaN(Date.parse(diagnosisDate))) {
        return res.status(400).json({ error: "A valid diagnosis date is required." });
      }
      const diagnosisType = String(b.diagnosisType ?? "").trim();
      if (!diagnosisType) return res.status(400).json({ error: "Diagnosis type is required." });

      const status = String(b.diagnosisStatus ?? "OPEN").trim().toUpperCase();
      if (!STATUSES.includes(status as any)) return res.status(400).json({ error: "Invalid status." });

      const customerId = b.customerId ? String(b.customerId).trim() : null;
      if (customerId && !UUID_RE.test(customerId)) return res.status(400).json({ error: "Invalid customerId." });

      let assignedTo: string | null = b.assignedTo ? String(b.assignedTo).trim() : null;
      if (assignedTo && !UUID_RE.test(assignedTo)) return res.status(400).json({ error: "Invalid assignedTo." });
      if (access === "own") assignedTo = String(req.user.userId);

      const result = await pool.query(
        `INSERT INTO drm.diagnosis_reports
           (customer_id, company_name, person_name, diagnosis_type, diagnosis_status,
            diagnosis_date, assigned_to, branch, department, notes, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::uuid, $8, $9, $10, $11::uuid)
         RETURNING id`,
        [
          customerId, b.companyName ?? null, b.personName ?? null, diagnosisType, status,
          diagnosisDate, assignedTo, b.branch ?? null, b.department ?? null, b.notes ?? null,
          String(req.user.userId),
        ],
      );
      res.status(201).json({ success: true, id: result.rows[0]?.id });
    } catch (err) {
      // FK violation (e.g. a uuid-valid but nonexistent customerId/assignedTo on a
      // DB that enforces the references) is an honest client error, not a 500.
      if ((err as any)?.code === "23503") {
        return res.status(400).json({ error: "Unknown customer or assignee reference." });
      }
      console.error("[diagnose] create failed", err);
      res.status(500).json({ error: "Failed to create diagnosis record." });
    }
  });

  // PATCH /api/reports/diagnose/:id — edit a diagnosis record within the caller's scope.
  app.patch("/api/reports/diagnose/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const id = String(req.params.id);
      if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id." });

      const existing = (
        await pool.query(`SELECT * FROM drm.diagnosis_reports WHERE id = $1::uuid AND deleted_at IS NULL`, [id])
      ).rows[0];
      if (!existing) return res.status(404).json({ error: "Diagnosis record not found." });

      const access = accessLevel(req);
      if (access !== "all") {
        const uid = String(req.user.userId);
        let allowed = false;
        if (access === "own") {
          allowed = String(existing.assigned_to) === uid || String(existing.created_by) === uid;
        } else {
          const { ids, dept } = await teamUserIds(uid);
          allowed =
            ids.includes(String(existing.assigned_to)) ||
            ids.includes(String(existing.created_by)) ||
            (!!dept && existing.department === dept);
        }
        if (!allowed) return res.status(404).json({ error: "Diagnosis record not found." });
      }

      const b = (req.body ?? {}) as Record<string, any>;
      const sets: string[] = [];
      const params: any[] = [];
      const add = (v: any) => {
        params.push(v);
        return `$${params.length}`;
      };

      if (b.companyName !== undefined) sets.push(`company_name = ${add(b.companyName ?? null)}`);
      if (b.personName !== undefined) sets.push(`person_name = ${add(b.personName ?? null)}`);
      if (b.diagnosisType !== undefined) sets.push(`diagnosis_type = ${add(b.diagnosisType ?? null)}`);
      if (b.diagnosisStatus !== undefined) {
        const st = String(b.diagnosisStatus).trim().toUpperCase();
        if (!STATUSES.includes(st as any)) return res.status(400).json({ error: "Invalid status." });
        sets.push(`diagnosis_status = ${add(st)}`);
      }
      if (b.diagnosisDate !== undefined) {
        if (Number.isNaN(Date.parse(String(b.diagnosisDate)))) {
          return res.status(400).json({ error: "Invalid diagnosis date." });
        }
        sets.push(`diagnosis_date = ${add(b.diagnosisDate)}::date`);
      }
      if (b.assignedTo !== undefined) {
        if (b.assignedTo && !UUID_RE.test(String(b.assignedTo))) {
          return res.status(400).json({ error: "Invalid assignedTo." });
        }
        let target: string | null = b.assignedTo ? String(b.assignedTo).trim() : null;
        // Mirror POST scoping so reassignment cannot push a record out of the
        // caller's reach: own-scope callers may only assign to themselves;
        // team-scope callers may only assign within their own department.
        if (access === "own") {
          target = String(req.user.userId);
        } else if (access === "team" && target) {
          const { ids } = await teamUserIds(String(req.user.userId));
          if (!ids.includes(target)) {
            return res.status(403).json({ error: "You can only assign records within your team." });
          }
        }
        sets.push(`assigned_to = ${add(target)}::uuid`);
      }
      if (b.customerId !== undefined) {
        if (b.customerId && !UUID_RE.test(String(b.customerId))) {
          return res.status(400).json({ error: "Invalid customerId." });
        }
        sets.push(`customer_id = ${add(b.customerId || null)}::uuid`);
      }
      if (b.branch !== undefined) sets.push(`branch = ${add(b.branch ?? null)}`);
      if (b.department !== undefined) sets.push(`department = ${add(b.department ?? null)}`);
      if (b.notes !== undefined) sets.push(`notes = ${add(b.notes ?? null)}`);

      if (sets.length === 0) return res.status(400).json({ error: "No valid fields to update." });
      sets.push(`updated_at = now()`);

      const idP = add(id);
      await pool.query(`UPDATE drm.diagnosis_reports SET ${sets.join(", ")} WHERE id = ${idP}::uuid`, params);
      res.json({ success: true });
    } catch (err) {
      if ((err as any)?.code === "23503") {
        return res.status(400).json({ error: "Unknown customer or assignee reference." });
      }
      console.error("[diagnose] update failed", err);
      res.status(500).json({ error: "Failed to update diagnosis record." });
    }
  });
}
