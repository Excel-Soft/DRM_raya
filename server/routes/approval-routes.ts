import { Router, type Request } from "express";
import {
  ApprovalVisibilityService,
  type ApprovalActor,
} from "../services/approval-visibility.service";

/**
 * Unified approvals dashboard — READ-ONLY aggregation only.
 *
 * These endpoints surface pending approvals across every module and the
 * cross-department history. They never perform a transition: the dashboard uses
 * the `actions` metadata on each item to call the module's OWN approve/reject
 * endpoints, so all authoritative logic, guards and notifications stay inside
 * each module. There is deliberately NO generic write endpoint here.
 */
export const approvalRouter = Router();

function actorFrom(req: Request): ApprovalActor {
  const user = (req.user || {}) as any;
  return {
    userId: user.userId || user.id,
    activeRoleId: user.activeRoleId ?? null,
    roleId: user.roleId ?? null,
    role: user.role ?? null,
    roles: user.roles ?? null,
    department: user.department ?? null,
  };
}

// GET /api/approvals/pending?module=invoice — items the actor may act on.
approvalRouter.get("/pending", async (req, res) => {
  try {
    const module = typeof req.query.module === "string" ? req.query.module : undefined;
    const items = await ApprovalVisibilityService.getPendingApprovals(actorFrom(req), { module });
    res.json({ success: true, items });
  } catch (error) {
    console.error("[Approvals pending]", error);
    res.status(500).json({ success: false, error: "Failed to load pending approvals" });
  }
});

// GET /api/approvals/summary — counts per module/stage scoped to the actor.
approvalRouter.get("/summary", async (req, res) => {
  try {
    const summary = await ApprovalVisibilityService.getSummary(actorFrom(req));
    res.json({ success: true, summary });
  } catch (error) {
    console.error("[Approvals summary]", error);
    res.status(500).json({ success: false, error: "Failed to load approvals summary" });
  }
});

// GET /api/approvals/:module/:entityId — module audit + cross-department ledger.
approvalRouter.get("/:module/:entityId", async (req, res) => {
  try {
    const detail = await ApprovalVisibilityService.getDetail(
      actorFrom(req),
      req.params.module,
      req.params.entityId,
    );
    res.json({ success: true, detail });
  } catch (error: any) {
    if (error?.status === 403) {
      return res.status(403).json({ success: false, error: "Not allowed to view this approval" });
    }
    console.error("[Approvals detail]", error);
    res.status(500).json({ success: false, error: "Failed to load approval detail" });
  }
});

export default approvalRouter;
