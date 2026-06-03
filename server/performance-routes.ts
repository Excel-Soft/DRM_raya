/**
 * Performance System routes — read-only, mounted under /api/drm/performance.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_admin / super_hod  -> all users
 *   - hod                              -> users in their department
 *   - manager roles                    -> their team (users under_works them)
 *   - executive / other roles          -> self only
 * Unauthorized cross-user access returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { buildSummary, buildRecords, buildTrends } from "./services/performance.service";

const FULL_ACCESS_ROLES = ["admin", "super_hod"];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}

/**
 * Returns the set of user ids the requester may view, or null meaning "all users".
 */
async function getAllowedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const activeRole = normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);

  if (FULL_ACCESS_ROLES.includes(activeRole)) return null;

  if (activeRole === "hod") {
    try {
      const me = await pool.query(`select department from drm.users where id::text = $1::text limit 1`, [myId]);
      const dept = me.rows[0]?.department;
      if (!dept) return [String(myId)];
      const { rows } = await pool.query(`select id from drm.users where department = $1`, [dept]);
      const ids = rows.map((r) => String(r.id));
      ids.push(String(myId));
      return Array.from(new Set(ids));
    } catch {
      return [String(myId)];
    }
  }

  if (isManagerialRole(activeRole)) {
    try {
      const { rows } = await pool.query(
        `select id from drm.users where under_works = $1::text or id::text = $1::text`,
        [myId],
      );
      const ids = rows.map((r) => String(r.id));
      ids.push(String(myId));
      return Array.from(new Set(ids));
    } catch {
      return [String(myId)];
    }
  }

  // executive / default: self only
  return [String(myId)];
}

async function canView(req: Request, targetUserId: string): Promise<boolean> {
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(targetUserId));
}

function parseDateRange(req: Request, res: Response): { from: Date; to: Date } | null {
  const startDate = String(req.query.startDate ?? "");
  const endDate = String(req.query.endDate ?? "");
  if (!startDate || !endDate) {
    res.status(400).json({ error: "BadRequest", message: "startDate and endDate are required (YYYY-MM-DD)" });
    return null;
  }
  const from = new Date(startDate);
  const to = new Date(endDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    res.status(400).json({ error: "BadRequest", message: "Invalid startDate or endDate" });
    return null;
  }
  if (from.getTime() > to.getTime()) {
    res.status(400).json({ error: "BadRequest", message: "startDate must be on or before endDate" });
    return null;
  }
  // make the end date inclusive (end of day)
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function resolveTargetUser(req: Request, res: Response): Promise<string | null> {
  const myId = getUserId(req);
  let userId = req.query.userId ? String(req.query.userId) : "";
  if (!userId) userId = String(myId);
  // verify the user exists
  const exists = await pool.query(`select 1 from drm.users where id::text = $1::text limit 1`, [userId]);
  if (exists.rowCount === 0) {
    res.status(404).json({ error: "NotFound", message: "User not found" });
    return null;
  }
  if (!(await canView(req, userId))) {
    res.status(403).json({ error: "Forbidden", message: "You are not authorized to view this employee's performance" });
    return null;
  }
  return userId;
}

export function registerPerformanceRoutes(app: Express) {
  // GET /api/drm/performance/users
  app.get("/api/drm/performance/users", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const allowed = await getAllowedUserIds(req);
      const activeOnly = String(req.query.activeOnly ?? "true") !== "false";
      const department = req.query.department ? String(req.query.department) : "";
      const role = req.query.role ? String(req.query.role) : "";
      const search = req.query.search ? String(req.query.search) : "";

      const where: string[] = ["1=1"];
      const params: any[] = [];
      if (activeOnly) where.push("is_active = true");
      if (allowed !== null) {
        params.push(allowed);
        where.push(`id::text = ANY($${params.length}::text[])`);
      }
      if (department) {
        params.push(department);
        where.push(`department = $${params.length}`);
      }
      if (role) {
        params.push(role);
        where.push(`(role = $${params.length} or role_id = $${params.length})`);
      }
      if (search) {
        params.push(`%${search}%`);
        where.push(`(coalesce(full_name,'') ilike $${params.length} or coalesce(name,'') ilike $${params.length} or coalesce(email,'') ilike $${params.length})`);
      }

      const { rows } = await pool.query(
        `select id, name, full_name as "fullName", email, role, role_id as "roleId",
                department, branch, is_active as "isActive"
           from drm.users
          where ${where.join(" and ")}
          order by coalesce(full_name, name, email) asc
          limit 500`,
        params,
      );
      res.json(rows);
    } catch (err: any) {
      console.error("[performance] /users error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch users" });
    }
  });

  // GET /api/drm/performance/summary
  app.get("/api/drm/performance/summary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const userId = await resolveTargetUser(req, res);
      if (!userId) return;
      const includeRecords = String(req.query.includeRecords ?? "true") !== "false";
      const summary = await buildSummary(userId, range.from, range.to, includeRecords);
      res.json(summary);
    } catch (err: any) {
      console.error("[performance] /summary error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to compute performance summary" });
    }
  });

  // GET /api/drm/performance/records
  app.get("/api/drm/performance/records", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const userId = await resolveTargetUser(req, res);
      if (!userId) return;
      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
      const result = await buildRecords(userId, range.from, range.to, {
        sourceModule: req.query.sourceModule ? String(req.query.sourceModule) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        page,
        limit,
      });
      res.json(result);
    } catch (err: any) {
      console.error("[performance] /records error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch performance records" });
    }
  });

  // GET /api/drm/performance/trends
  app.get("/api/drm/performance/trends", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const userId = await resolveTargetUser(req, res);
      if (!userId) return;
      const intervalRaw = String(req.query.interval ?? "daily").toLowerCase();
      const interval = (["daily", "weekly", "monthly"].includes(intervalRaw) ? intervalRaw : "daily") as
        | "daily" | "weekly" | "monthly";
      const result = await buildTrends(userId, range.from, range.to, interval);
      res.json(result);
    } catch (err: any) {
      console.error("[performance] /trends error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch performance trends" });
    }
  });
}
