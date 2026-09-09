/**
 * Increment Management routes — mounted under /api/drm/increment.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_admin / super_hod  -> all users
 *   - hod / manager roles              -> their department (plus self)
 *   - executive / other roles          -> self only (view only, cannot decide)
 * Cross-user access returns 403. Approve/Hold/Reject requires a managerial role.
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import {
  fetchUsers,
  fetchUserById,
  groupUsersByRole,
  buildReport,
  buildDetail,
  getHistory,
  saveEvaluation,
  applyDecision,
  getEvaluationOwner,
  type DecisionStatus,
} from "../services/increment.service";

const FULL_ACCESS_ROLES = ["admin", "super_hod"];
const MAX_RANGE_MONTHS = 24;

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}

async function getAllowedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const activeRole = getActiveRole(req);
  if (FULL_ACCESS_ROLES.includes(activeRole)) return null;

  // HOD + manager roles scoped to their OWN department (plus self).
  if (activeRole === "hod" || isManagerialRole(activeRole)) {
    try {
      const me = await pool.query(`select department from drm.users where id::text = $1::text limit 1`, [myId]);
      const dept = me.rows[0]?.department ?? null;
      if (!dept) return [String(myId)];
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
  // executive / default: self only
  return [String(myId)];
}

async function canView(req: Request, targetUserId: string): Promise<boolean> {
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(targetUserId));
}

function canDecide(req: Request): boolean {
  const role = getActiveRole(req);
  return FULL_ACCESS_ROLES.includes(role) || role === "hod" || isManagerialRole(role);
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
  // 24-month cap unless admin/super_admin/super_hod
  const exempt = FULL_ACCESS_ROLES.includes(getActiveRole(req));
  if (!exempt) {
    const months = (to.getTime() - from.getTime()) / (30 * 86_400_000);
    if (months > MAX_RANGE_MONTHS) {
      res.status(400).json({ error: "BadRequest", message: `Date range cannot exceed ${MAX_RANGE_MONTHS} months` });
      return null;
    }
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function parseBodyDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export function registerIncrementRoutes(app: Express) {
  // GET /api/drm/increment/users — grouped by role for the dropdown
  app.get("/api/drm/increment/users", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const allowed = await getAllowedUserIds(req);
      const users = await fetchUsers({
        allowedIds: allowed,
        activeOnly: String(req.query.activeOnly ?? "true") !== "false",
        department: req.query.department ? String(req.query.department) : undefined,
        role: req.query.role ? String(req.query.role) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
      });
      res.json({ groups: groupUsersByRole(users) });
    } catch (err) {
      console.error("[increment] /users error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch users" });
    }
  });

  // GET /api/drm/increment/report — evaluation report for one user or all visible users
  app.get("/api/drm/increment/report", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;

      const allowed = await getAllowedUserIds(req);
      const userIdParam = req.query.userId ? String(req.query.userId) : "";

      let users;
      if (userIdParam && userIdParam !== "all") {
        if (!(await canView(req, userIdParam))) {
          return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view this employee" });
        }
        const u = await fetchUserById(userIdParam);
        if (!u) return res.status(404).json({ error: "NotFound", message: "User not found" });
        users = [u];
      } else {
        users = await fetchUsers({ allowedIds: allowed, activeOnly: true });
      }

      const result = await buildReport(users, range.from, range.to, {
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 30) || 30,
        search: req.query.search ? String(req.query.search) : undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("[increment] /report error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to build increment report" });
    }
  });

  // GET /api/drm/increment/report/:employeeId/detail
  app.get("/api/drm/increment/report/:employeeId/detail", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const range = parseDateRange(req, res);
      if (!range) return;
      const employeeId = String(req.params.employeeId);
      const user = await fetchUserById(employeeId);
      if (!user) return res.status(404).json({ error: "NotFound", message: "User not found" });
      if (!(await canView(req, employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view this employee" });
      }
      const detail = await buildDetail(user, range.from, range.to);
      res.json(detail);
    } catch (err) {
      console.error("[increment] /detail error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to build increment detail" });
    }
  });

  // POST /api/drm/increment/evaluations — save a calculated snapshot
  app.post("/api/drm/increment/evaluations", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!canDecide(req)) {
        return res.status(403).json({ error: "Forbidden", message: "Only managers can save increment evaluations" });
      }
      const body = req.body ?? {};
      const employeeId = String(body.employeeId ?? "");
      const from = parseBodyDate(body.startDate);
      const to = parseBodyDate(body.endDate);
      if (!employeeId || !from || !to) {
        return res.status(400).json({ error: "BadRequest", message: "employeeId, startDate and endDate are required" });
      }
      if (from.getTime() > to.getTime()) {
        return res.status(400).json({ error: "BadRequest", message: "startDate must be on or before endDate" });
      }
      const user = await fetchUserById(employeeId);
      if (!user) return res.status(404).json({ error: "NotFound", message: "User not found" });
      if (!(await canView(req, employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to evaluate this employee" });
      }
      to.setHours(23, 59, 59, 999);
      const evaluation = await saveEvaluation(user, {
        employeeId,
        calculatedBy: String(getUserId(req)),
        from,
        to,
        recommendedStatus: body.recommendedStatus,
        proposedIncrementType: body.proposedIncrementType,
        proposedIncrementValue: body.proposedIncrementValue ?? null,
        managerRemarks: body.managerRemarks,
      });
      res.json({ success: true, evaluation });
    } catch (err) {
      console.error("[increment] POST /evaluations error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to save increment evaluation" });
    }
  });

  // PATCH /api/drm/increment/evaluations/:id/decision — Approve / Hold / Reject
  app.patch("/api/drm/increment/evaluations/:id/decision", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!canDecide(req)) {
        return res.status(403).json({ error: "Forbidden", message: "Only managers can decide increments" });
      }
      const id = String(req.params.id);
      const body = req.body ?? {};
      const status = String(body.status ?? "").toUpperCase() as DecisionStatus;
      if (!["APPROVED", "HOLD", "REJECTED"].includes(status)) {
        return res.status(400).json({ error: "BadRequest", message: "status must be APPROVED, HOLD or REJECTED" });
      }
      const ownerId = await getEvaluationOwner(id);
      if (!ownerId) return res.status(404).json({ error: "NotFound", message: "Evaluation not found" });
      if (!(await canView(req, ownerId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this evaluation" });
      }
      const updated = await applyDecision(id, String(getUserId(req)), {
        status,
        proposedIncrementType: body.proposedIncrementType,
        proposedIncrementValue: body.proposedIncrementValue,
        effectiveDate: body.effectiveDate ?? null,
        remarks: body.remarks,
      });
      if (!updated) return res.status(404).json({ error: "NotFound", message: "Evaluation not found" });
      res.json({ success: true, evaluation: updated });
    } catch (err) {
      console.error("[increment] PATCH /decision error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update increment decision" });
    }
  });

  // GET /api/drm/increment/evaluations/history/:employeeId
  app.get("/api/drm/increment/evaluations/history/:employeeId", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const employeeId = String(req.params.employeeId);
      const user = await fetchUserById(employeeId);
      if (!user) return res.status(404).json({ error: "NotFound", message: "User not found" });
      if (!(await canView(req, employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view this employee" });
      }
      const history = await getHistory(employeeId);
      res.json({ history });
    } catch (err) {
      console.error("[increment] /history error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch increment history" });
    }
  });
}
