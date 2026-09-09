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
import { fetchUsers, fetchUserById, groupUsersByRole } from "../services/increment.service";
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
} from "../services/penalty.service";
import { recordAuditLog } from "../services/activity-service";
// PEN-001: penalty permission decisions live in ONE row-aware source.
import {
  getUserId,
  getActiveRole,
  isFullAccess,
  isHr,
  canCreate,
  canDecide,
  canVoid,
  canViewReports,
  getDepartment,
  getAllowedEmployeeIds,
  canViewEmployee,
} from "../middleware/penalty-permission";
// PEN-001: request-shape (400) validation, mirrored from the previous inline rules.
import {
  penaltyCreateSchema,
  penaltyUpdateSchema,
  penaltyDecisionSchema,
  penaltyVoidSchema,
} from "./validators/penalty.validators";

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
      const parsed = penaltyCreateSchema.safeParse(b);
      if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
      const { employeeId, penaltyHead, reason, penaltyDate, amount } = parsed.data;

      // employee must exist + be within caller's scope
      const employee = await fetchUserById(employeeId);
      if (!employee) return res.status(404).json({ error: "NotFound", message: "Employee not found" });
      if (!(await canViewEmployee(req, employeeId))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to penalize this employee" });
      }

      // Phase 13 — segregation of duties: a penalty can never be created
      // pre-approved/pre-rejected, regardless of the creator's role. Every
      // decision must go through PATCH /:id/approval, which now also blocks
      // the creator from deciding their own penalty.
      const approvalStatus = "PENDING";

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
      const parsed = penaltyUpdateSchema.safeParse(b);
      if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
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
      // Phase 13 — segregation of duties: the creator cannot decide their own
      // penalty, regardless of role (including full-access).
      if (String(raw.createdBy) === String(getUserId(req))) {
        return res.status(403).json({ error: "Forbidden", message: "You cannot approve or reject a penalty you created." });
      }
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Voided penalties cannot be approved or rejected" });
      }
      if (raw.approvalStatus !== "PENDING") {
        return res.status(409).json({ error: "Conflict", message: "Only pending penalties can be approved or rejected" });
      }
      // Accept the spec body shape {approvalStatus} as well as the legacy {decision|status}.
      // Rejection must be justified — the remarks become part of the audit trail.
      const parsed = penaltyDecisionSchema.safeParse(req.body ?? {});
      if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
      const { decision, hodRemarks } = parsed.data;
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
      await recordAuditLog({
        actorUserId: String(getUserId(req)),
        action: "penalty.acknowledge",
        module: "penalty",
        entityType: "Penalty",
        entityId: id,
        req,
      });
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
      // Phase 13 — segregation of duties: the creator cannot void their own
      // penalty either (voiding reverses an approval decision — same trust
      // boundary as approve/reject).
      if (String(raw.createdBy) === String(getUserId(req))) {
        return res.status(403).json({ error: "Forbidden", message: "You cannot void a penalty you created." });
      }
      if (raw.status === "VOIDED") {
        return res.status(409).json({ error: "Conflict", message: "Penalty is already voided" });
      }
      const parsed = penaltyVoidSchema.safeParse(req.body ?? {});
      if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
      const { reason } = parsed.data;

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
