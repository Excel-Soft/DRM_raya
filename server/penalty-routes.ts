/**
 * Penalty Management routes — mounted under /api/penalties.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_admin / super_hod  -> view all, create, edit, delete, approve/reject, reports
 *   - hod                              -> view their department, approve/reject, reports, create
 *   - dd_manager / managerial roles    -> create; view their department; edit/soft-delete their own
 *                                         PENDING penalties only
 *   - hr / hr_manager                  -> view all + reports (no create/approve/delete)
 *   - employee / executive / other     -> view ONLY their own penalties; acknowledge own; no create
 * Cross-scope access returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { fetchUsers, fetchUserById, groupUsersByRole } from "./services/increment.service";
import {
  PENALTY_STATUSES,
  PENALTY_HEADS,
  listPenalties,
  getPenaltyById,
  getPenaltyRaw,
  createPenalty,
  updatePenalty,
  decidePenalty,
  acknowledgePenalty,
  softDeletePenalty,
  voidPenalty,
  monthlyReport,
} from "./services/penalty.service";
import { recordAuditLog } from "./services/activity-service";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
const HR_ROLES = ["hr", "hr_manager"];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
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

// Who can create a penalty: full-access, HOD, and managerial roles.
function canCreate(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isManagerialRole(role);
}
// Who can approve/reject: full-access and HOD only.
function canDecide(role: string): boolean {
  return isFullAccess(role) || isHod(role);
}
// Who can void: same authority as approve/reject. Voiding reverses an approval
// decision, so a managerial creator must NOT be able to void (only delete their
// own still-PENDING penalties). Full-access + HOD (dept-scoped) only.
function canVoid(role: string): boolean {
  return canDecide(role);
}
// Who can see reports: full-access, HOD, HR.
function canViewReports(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isHr(role);
}

async function getDepartment(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(`select department from drm.users where id::text = $1::text limit 1`, [userId]);
    return rows[0]?.department ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the list of employee_ids this requester may view, or null for "all".
 *   - full access / HR -> null (all)
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 */
async function getAllowedEmployeeIds(req: Request): Promise<string[] | null> {
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
  // employee / executive / default: own penalties only
  return [String(myId)];
}

async function canViewEmployee(req: Request, employeeId: string): Promise<boolean> {
  const allowed = await getAllowedEmployeeIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(employeeId));
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

export function registerPenaltyRoutes(app: Express) {
  // GET /api/penalties/users — active employees grouped by role for the dropdown
  app.get("/api/penalties/users", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!canCreate(getActiveRole(req))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to list employees" });
      }
      const allowed = await getAllowedEmployeeIds(req);
      const users = await fetchUsers({
        allowedIds: allowed,
        activeOnly: String(req.query.activeOnly ?? "true") !== "false",
        department: req.query.department ? String(req.query.department) : undefined,
        role: req.query.role ? String(req.query.role) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
      });
      res.json({ groups: groupUsersByRole(users) });
    } catch (err) {
      console.error("[penalty] /users error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch users" });
    }
  });

  // GET /api/penalties/meta — penalty heads + allowed statuses + caller capabilities
  app.get("/api/penalties/meta", async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const role = getActiveRole(req);
    res.json({
      penaltyHeads: PENALTY_HEADS,
      statuses: PENALTY_STATUSES,
      permissions: {
        canCreate: canCreate(role),
        canDecide: canDecide(role),
        canVoid: canVoid(role),
        canViewReports: canViewReports(role),
        isFullAccess: isFullAccess(role),
        role,
      },
    });
  });

  // GET /api/penalties/reports/monthly
  app.get("/api/penalties/reports/monthly", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!canViewReports(getActiveRole(req))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view reports" });
      }
      let department = req.query.department ? String(req.query.department) : undefined;
      let employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
      const role = getActiveRole(req);
      // Full-access and HR see all reports. HOD is strictly scoped to their own
      // department; if they have no department, restrict to their own records so
      // a caller-supplied `department` can never widen their view.
      if (!isFullAccess(role) && !isHr(role)) {
        const myDept = await getDepartment(String(getUserId(req)));
        if (myDept) {
          department = myDept;
        } else {
          department = undefined;
          employeeId = String(getUserId(req));
        }
      }
      const report = await monthlyReport({
        month: req.query.month ? String(req.query.month) : undefined,
        department,
        employeeId,
      });
      res.json(report);
    } catch (err) {
      console.error("[penalty] /reports/monthly error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to build report" });
    }
  });

  // GET /api/penalties — paginated, filtered list (scoped to caller)
  app.get("/api/penalties", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const allowed = await getAllowedEmployeeIds(req);
      // Disambiguate approval vs lifecycle status. `approvalStatus` is the
      // canonical approval filter; `status` is the lifecycle filter
      // (ACTIVE/VOIDED). For backward compatibility the dashboard historically
      // sent the approval filter as `?status=`, so an approval-vocab value in
      // `status` is still routed to the approval filter when approvalStatus is
      // absent.
      const APPROVAL_VOCAB = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
      let approvalStatus = req.query.approvalStatus ? String(req.query.approvalStatus).toUpperCase() : undefined;
      const statusParam = req.query.status ? String(req.query.status).toUpperCase() : undefined;
      let lifecycleStatus: string | undefined;
      if (statusParam) {
        if (!approvalStatus && APPROVAL_VOCAB.includes(statusParam)) {
          approvalStatus = statusParam;
        } else if (["ACTIVE", "VOIDED"].includes(statusParam)) {
          lifecycleStatus = statusParam;
        }
      }
      const mine = String(req.query.mine ?? "") === "true";
      const createdBy = mine
        ? String(getUserId(req))
        : (req.query.createdBy ? String(req.query.createdBy) : undefined);
      const result = await listPenalties({
        page: Number(req.query.page ?? 1) || 1,
        limit: Number(req.query.limit ?? 10) || 10,
        search: req.query.search ? String(req.query.search) : undefined,
        employeeId: req.query.employeeId ? String(req.query.employeeId) : undefined,
        department: req.query.department ? String(req.query.department) : undefined,
        penaltyHead: req.query.penaltyHead ? String(req.query.penaltyHead) : undefined,
        branch: req.query.branch ? String(req.query.branch) : undefined,
        approvalStatus,
        status: lifecycleStatus,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        createdBy,
        allowedEmployeeIds: allowed,
      });
      res.json(result);
    } catch (err) {
      console.error("[penalty] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch penalties" });
    }
  });

  // GET /api/penalties/:id
  app.get("/api/penalties/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const row = await getPenaltyById(String(req.params.id));
      if (!row) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      if (!(await canViewEmployee(req, row.employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view this penalty" });
      }
      res.json(row);
    } catch (err) {
      console.error("[penalty] get error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch penalty" });
    }
  });

  // POST /api/penalties — create
  app.post("/api/penalties", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canCreate(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to create penalties" });
      }
      const b = req.body ?? {};
      const employeeId = String(b.employeeId ?? "");
      const penaltyHead = String(b.penaltyHead ?? "").trim();
      const reason = String(b.reason ?? "").trim();
      const penaltyDate = String(b.penaltyDate ?? "").trim();
      const amount = Number(b.amount);

      if (!employeeId) return badRequest(res, "employeeId is required");
      if (!penaltyHead) return badRequest(res, "penaltyHead is required");
      if (!reason) return badRequest(res, "reason is required");
      if (b.amount === undefined || b.amount === null || b.amount === "" || isNaN(amount) || amount < 0) {
        return badRequest(res, "amount is required and must be >= 0");
      }
      if (!penaltyDate || isNaN(new Date(penaltyDate).getTime())) {
        return badRequest(res, "penaltyDate is required and must be a valid date");
      }

      // employee must exist + be within caller's scope
      const employee = await fetchUserById(employeeId);
      if (!employee) return res.status(404).json({ error: "NotFound", message: "Employee not found" });
      if (!(await canViewEmployee(req, employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to penalize this employee" });
      }

      // Approval status: only full-access / HOD may set non-PENDING on create.
      let approvalStatus = String(b.approvalStatus ?? "PENDING").toUpperCase();
      if (!PENALTY_STATUSES.includes(approvalStatus as any)) {
        return badRequest(res, `approvalStatus must be one of ${PENALTY_STATUSES.join(", ")}`);
      }
      if (approvalStatus !== "PENDING" && !canDecide(role)) {
        approvalStatus = "PENDING";
      }

      const created = await createPenalty({
        employeeId,
        department: b.department ? String(b.department) : (employee.department ?? null),
        penaltyHead,
        reason,
        amount,
        penaltyDate,
        createdBy: String(getUserId(req)),
        approvalStatus,
        attachmentUrl: b.attachmentUrl ? String(b.attachmentUrl) : null,
        attachmentName: b.attachmentName ? String(b.attachmentName) : null,
        managerRemarks: b.managerRemarks ? String(b.managerRemarks) : null,
      });
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: "penalty.create",
        module: "penalty",
        entityType: "Penalty",
        entityId: String((created as any)?.id ?? ""),
        nextStatus: approvalStatus,
        after: { employeeId, penaltyHead, amount, penaltyDate, approvalStatus },
        req,
      });
      res.status(201).json({ success: true, penalty: created });
    } catch (err) {
      console.error("[penalty] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create penalty" });
    }
  });

  // PATCH /api/penalties/:id — edit
  app.patch("/api/penalties/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      const id = String(req.params.id);
      const raw = await getPenaltyRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Voided penalties cannot be edited" });
      }

      // Full access can always edit. Otherwise only the creator may edit, and only while PENDING.
      const isOwner = String(raw.createdBy) === String(getUserId(req));
      if (!isFullAccess(role)) {
        if (!canCreate(role) || !isOwner) {
          return res.status(403).json({ error: "Forbidden", message: "You are not authorized to edit this penalty" });
        }
        if (raw.approvalStatus !== "PENDING") {
          return res.status(409).json({ error: "Conflict", message: "Only pending penalties can be edited" });
        }
      }

      const b = req.body ?? {};
      if (b.amount !== undefined && (isNaN(Number(b.amount)) || Number(b.amount) < 0)) {
        return badRequest(res, "amount must be >= 0");
      }
      if (b.penaltyDate !== undefined && isNaN(new Date(String(b.penaltyDate)).getTime())) {
        return badRequest(res, "penaltyDate must be a valid date");
      }
      if (b.penaltyHead !== undefined && !String(b.penaltyHead).trim()) {
        return badRequest(res, "penaltyHead cannot be empty");
      }
      if (b.reason !== undefined && !String(b.reason).trim()) {
        return badRequest(res, "reason cannot be empty");
      }
      if (b.employeeId !== undefined) {
        const emp = await fetchUserById(String(b.employeeId));
        if (!emp) return res.status(404).json({ error: "NotFound", message: "Employee not found" });
        if (!(await canViewEmployee(req, String(b.employeeId)))) {
          return res.status(403).json({ error: "Forbidden", message: "You are not authorized to assign this employee" });
        }
      }

      const updated = await updatePenalty(id, {
        employeeId: b.employeeId !== undefined ? String(b.employeeId) : undefined,
        department: b.department !== undefined ? (b.department ? String(b.department) : null) : undefined,
        penaltyHead: b.penaltyHead !== undefined ? String(b.penaltyHead) : undefined,
        reason: b.reason !== undefined ? String(b.reason) : undefined,
        amount: b.amount !== undefined ? Number(b.amount) : undefined,
        penaltyDate: b.penaltyDate !== undefined ? String(b.penaltyDate) : undefined,
        attachmentUrl: b.attachmentUrl !== undefined ? (b.attachmentUrl ? String(b.attachmentUrl) : null) : undefined,
        attachmentName: b.attachmentName !== undefined ? (b.attachmentName ? String(b.attachmentName) : null) : undefined,
        managerRemarks: b.managerRemarks !== undefined ? (b.managerRemarks ? String(b.managerRemarks) : null) : undefined,
      });
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: "penalty.update",
        module: "penalty",
        entityType: "Penalty",
        entityId: id,
        req,
      });
      res.json({ success: true, penalty: updated });
    } catch (err) {
      console.error("[penalty] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update penalty" });
    }
  });

  // PATCH /api/penalties/:id/approval — approve / reject (HOD + full access only)
  app.patch("/api/penalties/:id/approval", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canDecide(role)) {
        return res.status(403).json({ error: "Forbidden", message: "Only HOD/admin can approve or reject penalties" });
      }
      const id = String(req.params.id);
      const raw = await getPenaltyRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      // HOD scoped to their department.
      if (!(await canViewEmployee(req, raw.employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this penalty" });
      }
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Voided penalties cannot be approved or rejected" });
      }
      if (raw.approvalStatus !== "PENDING") {
        return res.status(409).json({ error: "Conflict", message: "Only pending penalties can be approved or rejected" });
      }
      // Accept the spec body shape {approvalStatus} as well as the legacy {decision|status}.
      const decision = String(
        req.body?.approvalStatus ?? req.body?.decision ?? req.body?.status ?? "",
      ).toUpperCase();
      if (!["APPROVED", "REJECTED"].includes(decision)) {
        return badRequest(res, "approvalStatus must be APPROVED or REJECTED");
      }
      // Rejection must be justified — the remarks become part of the audit trail.
      const hodRemarks = req.body?.hodRemarks ? String(req.body.hodRemarks).trim() : "";
      if (decision === "REJECTED" && !hodRemarks) {
        return badRequest(res, "hodRemarks is required when rejecting a penalty");
      }
      const updated = await decidePenalty(
        id,
        String(getUserId(req)),
        decision as "APPROVED" | "REJECTED",
        hodRemarks || null,
      );
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: decision === "APPROVED" ? "penalty.approve" : "penalty.reject",
        module: "penalty",
        entityType: "Penalty",
        entityId: id,
        previousStatus: "PENDING",
        nextStatus: decision,
        reason: hodRemarks || undefined,
        req,
      });
      res.json({ success: true, penalty: updated });
    } catch (err) {
      console.error("[penalty] approval error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update approval" });
    }
  });

  // PATCH /api/penalties/:id/acknowledge — employee acknowledges their own penalty
  app.patch("/api/penalties/:id/acknowledge", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getPenaltyRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Voided penalties cannot be acknowledged" });
      }
      const isSelf = String(raw.employeeId) === String(getUserId(req));
      // Acknowledgement is the employee's own action — nobody may acknowledge on their behalf.
      if (!isSelf) {
        return res.status(403).json({ error: "Forbidden", message: "You can only acknowledge your own penalty" });
      }
      const updated = await acknowledgePenalty(id);
      res.json({ success: true, penalty: updated });
    } catch (err) {
      console.error("[penalty] acknowledge error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to acknowledge penalty" });
    }
  });

  // DELETE /api/penalties/:id — soft delete
  app.delete("/api/penalties/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      const id = String(req.params.id);
      const raw = await getPenaltyRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Voided penalties cannot be deleted" });
      }

      const isOwner = String(raw.createdBy) === String(getUserId(req));
      if (!isFullAccess(role)) {
        if (!canCreate(role) || !isOwner) {
          return res.status(403).json({ error: "Forbidden", message: "You are not authorized to delete this penalty" });
        }
        if (raw.approvalStatus !== "PENDING") {
          return res.status(409).json({ error: "Conflict", message: "Only pending penalties can be deleted" });
        }
      }
      await softDeletePenalty(id);
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: "penalty.delete",
        module: "penalty",
        entityType: "Penalty",
        entityId: id,
        previousStatus: raw.approvalStatus,
        req,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[penalty] delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete penalty" });
    }
  });

  // PATCH /api/penalties/:id/void — soft, audited cancellation (distinct from
  // delete). Reverses a penalty's financial liability without destroying its
  // approval history. Authority mirrors approve/reject: full-access + HOD
  // (department-scoped). A reason is mandatory.
  app.patch("/api/penalties/:id/void", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canVoid(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to void penalties" });
      }
      const id = String(req.params.id);
      const raw = await getPenaltyRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Penalty not found" });
      // HOD is scoped to their own department.
      if (!(await canViewEmployee(req, raw.employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to void this penalty" });
      }
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Penalty is already voided" });
      }
      const reason = req.body?.reason ? String(req.body.reason).trim() : "";
      if (!reason) return badRequest(res, "reason is required to void a penalty");

      const updated = await voidPenalty(id, String(getUserId(req)), reason);
      if (!updated) {
        return res.status(409).json({ error: "Conflict", message: "Penalty is already voided" });
      }
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: "penalty.void",
        module: "penalty",
        entityType: "Penalty",
        entityId: id,
        previousStatus: raw.approvalStatus,
        nextStatus: "VOIDED",
        reason,
        req,
      });
      res.json({ success: true, penalty: updated });
    } catch (err) {
      console.error("[penalty] void error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to void penalty" });
    }
  });
}
