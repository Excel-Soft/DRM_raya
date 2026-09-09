/**
 * Late Coming routes — mounted under /api/drm/late-coming.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * The list endpoint is an attendance-derived report (rows where the employee was
 * flagged late) UNIONed with manual late-coming entries created from the UI.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_hod / HR  -> view all
 *   - hod / managerial roles   -> view their department (+ self)
 *   - everyone else            -> view ONLY their own rows
 * Cross-scope mutation returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import { ActivityLogService } from "../services/activity-service";
import { safePage, safePageSize } from "../utils/sql-safety";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
const HR_ROLES = ["hr", "hr_manager"];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}
// Best-effort audit trail (never throws — ActivityLogService swallows failures).
async function audit(req: Request, action: string, resourceId: unknown, details?: Record<string, unknown>) {
  await ActivityLogService.log({
    userId: getUserId(req),
    action,
    resourceType: "drm_late_coming",
    resourceId: String(resourceId ?? ""),
    details: details && Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
  });
}
function isFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}
function isHr(role: string): boolean {
  return HR_ROLES.includes(role) || role.includes("hr");
}
function isHod(role: string): boolean {
  return role === "hod";
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

async function getDepartment(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select department from drm.users where id::text = $1::text limit 1`,
      [userId],
    );
    return rows[0]?.department ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the list of user_ids this requester may view, or null for "all".
 *   - full access / HR -> null (all)
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 */
async function getAllowedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFullAccess(role) || isHr(role)) return null;

  if (isHod(role) || isManagerialRole(role)) {
    const dept = await getDepartment(String(myId));
    if (!dept) return [String(myId)];
    try {
      const { rows } = await pool.query(
        `select id from drm.users where department = $1 or id::text = $2::text`,
        [dept, myId],
      );
      const ids = rows.map((r) => String(r.id));
      ids.push(String(myId));
      return Array.from(new Set(ids));
    } catch {
      return [String(myId)];
    }
  }
  return [String(myId)];
}

async function canMutateUser(req: Request, targetUserId: string): Promise<boolean> {
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(targetUserId));
}

// Idempotent DDL for the manual late-coming entries table.
export async function ensureLateComingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.late_coming_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
      entry_date timestamptz NOT NULL DEFAULT now(),
      late_minutes integer NOT NULL DEFAULT 0,
      purpose text,
      details text,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_late_coming_entries_user ON drm.late_coming_entries(user_id)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_late_coming_entries_date ON drm.late_coming_entries(entry_date)`,
  );
}

export async function registerLateComingRoutes(app: Express) {
  await ensureLateComingTable();

  // GET /api/drm/late-coming — attendance-derived report UNION manual entries
  app.get("/api/drm/late-coming", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 25, 100);
      const offset = (page - 1) * pageSize;

      const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
      const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
      const userId = req.query.userId ? String(req.query.userId) : undefined;
      const department = req.query.department ? String(req.query.department) : undefined;
      const search = req.query.search ? String(req.query.search).trim() : undefined;
      // grace is reserved for future minute math; parsed but not yet applied.
      // const grace = Number(req.query.grace ?? 15) || 15;

      const allowed = await getAllowedUserIds(req);

      // The unified report combines attendance-flagged late days with manual entries.
      const combinedSql = `
        SELECT
          ('att-' || a.id::text) AS id,
          a.user_id::text AS user_id,
          COALESCE(u.full_name, u.name) AS name,
          u.department AS department,
          a.date AS date,
          'attendance'::text AS source,
          NULL::integer AS late_minutes,
          NULL::text AS purpose,
          NULL::text AS details,
          a.date AS sort_date
        FROM drm.attendance a
        JOIN drm.users u ON u.id::text = a.user_id::text
        WHERE (a.is_late = true OR a.late_checkin = true)
        UNION ALL
        SELECT
          ('man-' || m.id::text) AS id,
          m.user_id::text AS user_id,
          COALESCE(u.full_name, u.name) AS name,
          u.department AS department,
          m.entry_date AS date,
          'manual'::text AS source,
          m.late_minutes AS late_minutes,
          m.purpose AS purpose,
          m.details AS details,
          m.entry_date AS sort_date
        FROM drm.late_coming_entries m
        JOIN drm.users u ON u.id::text = m.user_id::text
      `;

      const params: any[] = [];
      const clauses: string[] = [];

      if (allowed !== null) {
        params.push(allowed);
        clauses.push(`combined.user_id = ANY($${params.length}::text[])`);
      }
      if (userId) {
        params.push(userId);
        clauses.push(`combined.user_id = $${params.length}::text`);
      }
      if (department) {
        params.push(department);
        clauses.push(`combined.department = $${params.length}`);
      }
      if (dateFrom) {
        params.push(dateFrom);
        clauses.push(`combined.date >= $${params.length}::timestamptz`);
      }
      if (dateTo) {
        params.push(dateTo);
        clauses.push(`combined.date <= $${params.length}::timestamptz`);
      }
      if (search) {
        params.push(`%${search}%`);
        clauses.push(
          `(combined.name ILIKE $${params.length} OR combined.department ILIKE $${params.length} OR combined.purpose ILIKE $${params.length} OR combined.details ILIKE $${params.length})`,
        );
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const countSql = `SELECT count(*)::int AS total FROM (${combinedSql}) combined ${whereSql}`;
      const { rows: countRows } = await pool.query(countSql, params);
      const total = countRows[0]?.total ?? 0;

      const dataParams = params.slice();
      dataParams.push(pageSize);
      dataParams.push(offset);
      const dataSql = `
        SELECT combined.id, combined.user_id, combined.name, combined.department,
               combined.date, combined.source, combined.late_minutes,
               combined.purpose, combined.details
        FROM (${combinedSql}) combined
        ${whereSql}
        ORDER BY combined.sort_date DESC NULLS LAST
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;
      const { rows } = await pool.query(dataSql, dataParams);

      const data = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        department: r.department,
        date: r.date,
        source: r.source,
        lateMinutes: r.late_minutes === null || r.late_minutes === undefined ? null : Number(r.late_minutes),
        purpose: r.purpose,
        details: r.details,
      }));

      res.json({ data, total, page, pageSize });
    } catch (err) {
      console.error("[late-coming] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch late coming report" });
    }
  });

  // POST /api/drm/late-coming — create a manual late entry
  app.post("/api/drm/late-coming", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const b = req.body ?? {};
      const userId = String(b.userId ?? b.user_id ?? "").trim();
      const lateMinutes = Number(b.lateMinutes ?? b.late_minutes);

      if (!userId) return badRequest(res, "userId is required");
      if (b.lateMinutes === undefined && b.late_minutes === undefined) {
        return badRequest(res, "lateMinutes is required");
      }
      if (isNaN(lateMinutes) || lateMinutes < 0) {
        return badRequest(res, "lateMinutes must be a number >= 0");
      }

      // Target user must exist + be within caller's scope.
      const { rows: userRows } = await pool.query(
        `select id from drm.users where id::text = $1::text limit 1`,
        [userId],
      );
      if (!userRows[0]) return res.status(404).json({ error: "NotFound", message: "User not found" });
      if (!(await canMutateUser(req, userId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to add a late entry for this user" });
      }

      const purpose = b.purpose !== undefined && b.purpose !== null ? String(b.purpose) : null;
      const details = b.details !== undefined && b.details !== null ? String(b.details) : null;
      const entryDate = b.entryDate ?? b.entry_date;
      const entryDateValid = entryDate && !isNaN(new Date(String(entryDate)).getTime())
        ? String(entryDate)
        : null;

      const { rows } = await pool.query(
        `INSERT INTO drm.late_coming_entries (user_id, entry_date, late_minutes, purpose, details, created_by)
         VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6)
         RETURNING id, user_id, entry_date, late_minutes, purpose, details, created_by, created_at`,
        [userId, entryDateValid, Math.trunc(lateMinutes), purpose, details, String(getUserId(req))],
      );

      const r = rows[0];
      // Resolve the name/department for a consistent row shape with the report.
      const { rows: nameRows } = await pool.query(
        `select COALESCE(full_name, name) as name, department from drm.users where id::text = $1::text limit 1`,
        [r.user_id],
      );

      await audit(req, "drm.late_coming.create", r.id, {
        targetUserId: String(r.user_id),
        lateMinutes: Number(r.late_minutes),
      });
      res.status(201).json({
        success: true,
        entry: {
          id: `man-${r.id}`,
          userId: String(r.user_id),
          name: nameRows[0]?.name ?? null,
          department: nameRows[0]?.department ?? null,
          date: r.entry_date,
          source: "manual",
          lateMinutes: Number(r.late_minutes),
          purpose: r.purpose,
          details: r.details,
        },
      });
    } catch (err) {
      console.error("[late-coming] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create late entry" });
    }
  });
}
