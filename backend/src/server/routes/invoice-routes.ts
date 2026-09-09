import { Router, type Request } from "express";
import { requireRole } from "../middleware/auth.middleware";
import { requireManualInvoiceCreator } from "../utils/gm-sales-permissions";
import { ValidationService } from "../services/validation.service";
import { sendError, ApiError } from "../utils/api-error";
import { InvoiceWorkflowService, INVOICE_AUDIT_ENTITY, type Actor } from "../services/invoice-workflow.service";
import { CrossDepartmentStatusService } from "../services/cross-department-status.service";
import { createOrLinkProjectForApprovedInvoice } from "../services/invoice-to-project.service";
import { transitionWorkflowStatus } from "../services/workflow-status.service";
import { NotificationService } from "../services/notification-service";
import {
  WORKFLOW_ENTITY_TYPES,
  INVOICE_WORKFLOW_STATUSES,
} from "../../shared/gm-sales-constants";
import {
  workflowCreateInvoiceSchema,
  workflowDecisionSchema,
  workflowMarkPaidSchema,
  workflowCancelSchema,
  workflowPatchSchema,
} from "../validators/invoice.validators";

export const invoiceRouter = Router();

function actorFrom(req: Request): Actor {
  const user = req.user!;
  return {
    userId: user.userId,
    roleId: user.roleId,
    roles: user.roles,
    activeRoleId: (user as any).activeRoleId,
  };
}

function requireAuth(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
  }
}

function shortInvoiceId(id: string): string {
  return `INV-${String(id).substring(0, 6)}`;
}

// ---------------------------------------------------------------------------
// List + create
// ---------------------------------------------------------------------------

// GET /api/invoices — list (sales execs see their own; others see all)
invoiceRouter.get("/", async (req, res) => {
  try {
    requireAuth(req);
    const list = await InvoiceWorkflowService.list(actorFrom(req));
    res.json({ success: true, data: list });
  } catch (error) {
    console.error("[Invoices GET]", error);
    sendError(res, error);
  }
});

// POST /api/invoices — create a workflow invoice (P7: closed invoice-type enum +
// role policy; service_executive admitted only when config enables it).
invoiceRouter.post("/", requireManualInvoiceCreator(), async (req, res) => {
  try {
    requireAuth(req);
    const body = ValidationService.parse(workflowCreateInvoiceSchema, req.body);
    const created = await InvoiceWorkflowService.create(actorFrom(req), body, req);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[Invoices POST]", error);
    sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Queues (strictly by stage)
// ---------------------------------------------------------------------------

// GET /api/invoices/queue/hod — items awaiting HOD
invoiceRouter.get("/queue/hod", requireRole("hod", "super_hod", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const list = await InvoiceWorkflowService.queue("PENDING_HOD");
    res.json({ success: true, data: list });
  } catch (error) {
    console.error("[Invoices queue/hod]", error);
    sendError(res, error);
  }
});

// GET /api/invoices/queue/account — items awaiting Account
invoiceRouter.get("/queue/account", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const list = await InvoiceWorkflowService.queue("PENDING_ACCOUNT");
    res.json({ success: true, data: list });
  } catch (error) {
    console.error("[Invoices queue/account]", error);
    sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Collection export (actor-scoped — same scope as GET /). Registered before the
// parameterized /:id/* routes so this literal path is unambiguous.
// ---------------------------------------------------------------------------

// GET /api/invoices/export — actor-scoped collection export
invoiceRouter.get("/export", async (req, res) => {
  try {
    requireAuth(req);
    const data = await InvoiceWorkflowService.exportList(actorFrom(req));
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Invoices export-list]", error);
    sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// History + export
// ---------------------------------------------------------------------------

// GET /api/invoices/:id/history — full audit trail
invoiceRouter.get("/:id/history", async (req, res) => {
  try {
    requireAuth(req);
    const history = await InvoiceWorkflowService.history(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("[Invoices history]", error);
    sendError(res, error);
  }
});

// GET /api/invoices/:id/export — invoice snapshot + history + project link
invoiceRouter.get("/:id/export", async (req, res) => {
  try {
    requireAuth(req);
    const data = await InvoiceWorkflowService.exportInvoice(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Invoices export]", error);
    sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

// POST /api/invoices/:id/submit-hod — DRAFT -> PENDING_HOD
invoiceRouter.post("/:id/submit-hod", async (req, res) => {
  try {
    requireAuth(req);
    const updated = await InvoiceWorkflowService.submitToHod(actorFrom(req), req.params.id, req);
    await CrossDepartmentStatusService.onInvoiceSubmittedToHod({
      invoiceId: req.params.id,
      toStatus: (updated as any)?.status ?? "PENDING_HOD",
      actorUserId: actorFrom(req).userId,
      req,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices submit-hod]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/hod-approve
// Patch 5 Stage 6 (P14): routed through the central WorkflowStatusService — it
// validates the PENDING_HOD -> PENDING_ACCOUNT transition + role, performs the
// invoice state write and writes the status-history row in ONE transaction, then
// audits + notifies after commit. Cross-department linkage stays a post-commit
// best-effort step (unchanged behavior).
invoiceRouter.post("/:id/hod-approve", requireRole("hod", "super_hod", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const actor = actorFrom(req);
    const id = req.params.id;
    const invoice = await InvoiceWorkflowService.getInvoice(id);
    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    const result = await transitionWorkflowStatus({
      entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
      auditEntityType: INVOICE_AUDIT_ENTITY,
      entityId: id,
      action: "INVOICE_HOD_APPROVED",
      fromStatus: invoice.status,
      toStatus: INVOICE_WORKFLOW_STATUSES.PENDING_ACCOUNT,
      actor,
      requiredRoles: ["hod", "super_hod", "admin"],
      module: "invoice-workflow",
      req,
      notify: {
        message: `Invoice ${shortInvoiceId(id)} approved by HOD. Awaiting account approval.`,
        recipientRoles: ["account_manager"],
        targetUrl: "/account/invoices",
      },
      execute: (client) => InvoiceWorkflowService.approveByHodTx(client, actor, id),
    });
    await CrossDepartmentStatusService.onInvoiceHodApproved({
      invoiceId: id,
      toStatus: result.nextStatus,
      actorUserId: actor.userId,
      req,
    });
    const data = await InvoiceWorkflowService.getInvoice(id);
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Invoices hod-approve]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/hod-reject
invoiceRouter.post("/:id/hod-reject", requireRole("hod", "super_hod", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const actor = actorFrom(req);
    const id = req.params.id;
    const { reason } = ValidationService.parse(workflowDecisionSchema, {
      action: "REJECT",
      reason: req.body?.reason,
    });
    const invoice = await InvoiceWorkflowService.getInvoice(id);
    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    const result = await transitionWorkflowStatus({
      entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
      auditEntityType: INVOICE_AUDIT_ENTITY,
      entityId: id,
      action: "INVOICE_REJECTED",
      fromStatus: invoice.status,
      toStatus: INVOICE_WORKFLOW_STATUSES.REJECTED,
      actor,
      requiredRoles: ["hod", "super_hod", "admin"],
      requireReason: true,
      reason,
      module: "invoice-workflow",
      req,
      execute: (client) =>
        InvoiceWorkflowService.rejectByStageTx(client, actor, id, reason, "HOD"),
    });
    if (invoice.salesExecId) {
      await NotificationService.notify({
        userId: invoice.salesExecId,
        message: `Your invoice ${shortInvoiceId(id)} was rejected at the HOD stage. Reason: ${reason}`,
        type: "ERROR",
      });
    }
    await CrossDepartmentStatusService.onInvoiceRejected({
      invoiceId: id,
      stage: "HOD",
      salesExecId: result.updatedEntity?.salesExecId ?? invoice.salesExecId ?? null,
      actorUserId: actor.userId,
      req,
    });
    const data = await InvoiceWorkflowService.getInvoice(id);
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Invoices hod-reject]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/account-approve (+ PMS linkage)
// The invoice state change + history are atomic via the central service. Project
// generation remains the existing best-effort, config-gated (AUTOMATIC mode only)
// post-commit step per the Stage 5 contract — approval must never fail because
// generation hiccups — and the PMS-manager notification is preserved.
invoiceRouter.post("/:id/account-approve", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const actor = actorFrom(req);
    const id = req.params.id;
    const invoice = await InvoiceWorkflowService.getInvoice(id);
    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    const result = await transitionWorkflowStatus({
      entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
      auditEntityType: INVOICE_AUDIT_ENTITY,
      entityId: id,
      action: "INVOICE_ACCOUNT_APPROVED",
      fromStatus: invoice.status,
      toStatus: INVOICE_WORKFLOW_STATUSES.APPROVED,
      actor,
      requiredRoles: ["account_manager", "admin"],
      module: "invoice-workflow",
      req,
      notify: invoice.salesExecId
        ? {
            message: `Invoice ${shortInvoiceId(id)} fully approved and queued for project creation.`,
            type: "SUCCESS",
            recipientUserIds: [invoice.salesExecId],
            targetUrl: "/pms/approvals?tab=invoices",
          }
        : undefined,
      execute: (client) => InvoiceWorkflowService.approveByAccountTx(client, actor, id),
    });

    // PMS linkage (post-commit, unchanged): the invoice now appears in the
    // pending-project queue. Notify PMS managers and surface any project link.
    let projectId = await InvoiceWorkflowService.findProjectLink(id);
    await NotificationService.notifyWorkflowTransition({
      message: `New approved invoice ${shortInvoiceId(id)} is ready for project creation.`,
      type: "INFO",
      recipientRoles: ["product_posting_manager", "software_manager", "dd_manager"],
      module: "invoice-workflow",
      entityType: "Invoice",
      entityId: id,
      targetUrl: "/pms/approvals?tab=invoices",
    });
    try {
      const { getConfigValue } = await import("../services/gm-sales-config.service");
      const { PROJECT_GENERATION_MODE } = await import("../../shared/gm-sales-constants");
      const mode = await getConfigValue("projectGenerationMode");
      if (mode === PROJECT_GENERATION_MODE.AUTOMATIC) {
        const gen = await createOrLinkProjectForApprovedInvoice({
          invoiceId: id,
          actorUserId: actor.userId,
          req,
        });
        if (gen.ok && gen.projectId) projectId = gen.projectId;
      }
    } catch (genErr) {
      console.error("[Invoices account-approve] project generation failed (best-effort):", genErr);
    }

    await CrossDepartmentStatusService.onInvoiceAccountApproved({
      invoiceId: id,
      projectId,
      toStatus: result.nextStatus,
      actorUserId: actor.userId,
      req,
    });
    const data = await InvoiceWorkflowService.getInvoice(id);
    res.json({ success: true, data, projectId });
  } catch (error) {
    console.error("[Invoices account-approve]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/account-reject
invoiceRouter.post("/:id/account-reject", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const actor = actorFrom(req);
    const id = req.params.id;
    const { reason } = ValidationService.parse(workflowDecisionSchema, {
      action: "REJECT",
      reason: req.body?.reason,
    });
    const invoice = await InvoiceWorkflowService.getInvoice(id);
    if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    const result = await transitionWorkflowStatus({
      entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
      auditEntityType: INVOICE_AUDIT_ENTITY,
      entityId: id,
      action: "INVOICE_REJECTED",
      fromStatus: invoice.status,
      toStatus: INVOICE_WORKFLOW_STATUSES.REJECTED,
      actor,
      requiredRoles: ["account_manager", "admin"],
      requireReason: true,
      reason,
      module: "invoice-workflow",
      req,
      execute: (client) =>
        InvoiceWorkflowService.rejectByStageTx(client, actor, id, reason, "Account"),
    });
    if (invoice.salesExecId) {
      await NotificationService.notify({
        userId: invoice.salesExecId,
        message: `Your invoice ${shortInvoiceId(id)} was rejected at the Account stage. Reason: ${reason}`,
        type: "ERROR",
      });
    }
    await CrossDepartmentStatusService.onInvoiceRejected({
      invoiceId: id,
      stage: "Account",
      salesExecId: result.updatedEntity?.salesExecId ?? invoice.salesExecId ?? null,
      actorUserId: actor.userId,
      req,
    });
    const data = await InvoiceWorkflowService.getInvoice(id);
    res.json({ success: true, data });
  } catch (error) {
    console.error("[Invoices account-reject]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:invoiceId/generate-project — Patch 5 Stage 5 (P9). Explicit,
// idempotent invoice -> project generation. Works in either projectGenerationMode
// (this is the manual trigger); creates-or-links a single INVOICE_ROOT project for
// an APPROVED invoice. Available to Account / Admin / Product-Posting managers.
invoiceRouter.post(
  "/:invoiceId/generate-project",
  requireRole("account_manager", "admin", "product_posting_manager"),
  async (req, res) => {
    try {
      requireAuth(req);
      const result = await createOrLinkProjectForApprovedInvoice({
        invoiceId: req.params.invoiceId,
        actorUserId: actorFrom(req).userId,
        req,
      });
      if (!result.ok) {
        throw new ApiError(400, "GENERATION_FAILED", result.reason || "Could not generate project");
      }
      res.json({ success: true, data: result, projectId: result.projectId });
    } catch (error) {
      console.error("[Invoices generate-project]", error);
      sendError(res, error);
    }
  },
);

// POST /api/invoices/:id/mark-paid — APPROVED -> PAID
invoiceRouter.post("/:id/mark-paid", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const body = ValidationService.parse(workflowMarkPaidSchema, req.body);
    const updated = await InvoiceWorkflowService.markPaid(actorFrom(req), req.params.id, body, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices mark-paid]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/cancel
invoiceRouter.post("/:id/cancel", async (req, res) => {
  try {
    requireAuth(req);
    const { reason } = ValidationService.parse(workflowCancelSchema, req.body);
    const updated = await InvoiceWorkflowService.cancel(actorFrom(req), req.params.id, reason, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices cancel]", error);
    sendError(res, error);
  }
});

// PATCH /api/invoices/:id — whitelisted field edits per status/role
invoiceRouter.patch("/:id", async (req, res) => {
  try {
    requireAuth(req);
    const body = ValidationService.parse(workflowPatchSchema, req.body);
    const updated = await InvoiceWorkflowService.patch(actorFrom(req), req.params.id, body, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices PATCH]", error);
    sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Legacy alias — keep the existing PUT /:id/approve working by delegating to
// the same state machine (used by the product-posting approvals widget).
// ---------------------------------------------------------------------------
invoiceRouter.put("/:id/approve", requireRole("hod", "super_hod", "account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const actor = actorFrom(req);
    const id = req.params.id;
    const rawAction = String(req.body?.action || "").toUpperCase();
    const action = rawAction === "REJECT" ? "REJECT" : "APPROVE";
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;

    const invoice = await InvoiceWorkflowService.getInvoice(id);
    if (!invoice) {
      throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    }

    // Route to the correct stage handler based on the invoice's current stage,
    // through the central WorkflowStatusService (so this alias writes history and
    // validates identically to the dedicated endpoints). Fire the same
    // cross-department hooks; record() is idempotent on event_key, so taking this
    // alias never double-records.
    if (invoice.status === "PENDING_HOD") {
      if (action === "REJECT") {
        await transitionWorkflowStatus({
          entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
          auditEntityType: INVOICE_AUDIT_ENTITY,
          entityId: id,
          action: "INVOICE_REJECTED",
          fromStatus: invoice.status,
          toStatus: INVOICE_WORKFLOW_STATUSES.REJECTED,
          actor,
          requiredRoles: ["hod", "super_hod", "admin"],
          requireReason: true,
          reason,
          module: "invoice-workflow",
          req,
          execute: (client) =>
            InvoiceWorkflowService.rejectByStageTx(client, actor, id, reason, "HOD"),
        });
        if (invoice.salesExecId) {
          await NotificationService.notify({
            userId: invoice.salesExecId,
            message: `Your invoice ${shortInvoiceId(id)} was rejected at the HOD stage. Reason: ${reason}`,
            type: "ERROR",
          });
        }
        await CrossDepartmentStatusService.onInvoiceRejected({
          invoiceId: id,
          stage: "HOD",
          salesExecId: invoice.salesExecId ?? null,
          actorUserId: actor.userId,
          req,
        });
      } else {
        await transitionWorkflowStatus({
          entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
          auditEntityType: INVOICE_AUDIT_ENTITY,
          entityId: id,
          action: "INVOICE_HOD_APPROVED",
          fromStatus: invoice.status,
          toStatus: INVOICE_WORKFLOW_STATUSES.PENDING_ACCOUNT,
          actor,
          requiredRoles: ["hod", "super_hod", "admin"],
          module: "invoice-workflow",
          req,
          notify: {
            message: `Invoice ${shortInvoiceId(id)} approved by HOD. Awaiting account approval.`,
            recipientRoles: ["account_manager"],
            targetUrl: "/account/invoices",
          },
          execute: (client) => InvoiceWorkflowService.approveByHodTx(client, actor, id),
        });
        await CrossDepartmentStatusService.onInvoiceHodApproved({
          invoiceId: id,
          toStatus: INVOICE_WORKFLOW_STATUSES.PENDING_ACCOUNT,
          actorUserId: actor.userId,
          req,
        });
      }
      const data = await InvoiceWorkflowService.getInvoice(id);
      return res.json({ success: true, data });
    }
    if (invoice.status === "PENDING_ACCOUNT") {
      let projectId: string | null = null;
      if (action === "REJECT") {
        await transitionWorkflowStatus({
          entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
          auditEntityType: INVOICE_AUDIT_ENTITY,
          entityId: id,
          action: "INVOICE_REJECTED",
          fromStatus: invoice.status,
          toStatus: INVOICE_WORKFLOW_STATUSES.REJECTED,
          actor,
          requiredRoles: ["account_manager", "admin"],
          requireReason: true,
          reason,
          module: "invoice-workflow",
          req,
          execute: (client) =>
            InvoiceWorkflowService.rejectByStageTx(client, actor, id, reason, "Account"),
        });
        if (invoice.salesExecId) {
          await NotificationService.notify({
            userId: invoice.salesExecId,
            message: `Your invoice ${shortInvoiceId(id)} was rejected at the Account stage. Reason: ${reason}`,
            type: "ERROR",
          });
        }
        await CrossDepartmentStatusService.onInvoiceRejected({
          invoiceId: id,
          stage: "Account",
          salesExecId: invoice.salesExecId ?? null,
          actorUserId: actor.userId,
          req,
        });
      } else {
        await transitionWorkflowStatus({
          entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
          auditEntityType: INVOICE_AUDIT_ENTITY,
          entityId: id,
          action: "INVOICE_ACCOUNT_APPROVED",
          fromStatus: invoice.status,
          toStatus: INVOICE_WORKFLOW_STATUSES.APPROVED,
          actor,
          requiredRoles: ["account_manager", "admin"],
          module: "invoice-workflow",
          req,
          notify: invoice.salesExecId
            ? {
                message: `Invoice ${shortInvoiceId(id)} fully approved and queued for project creation.`,
                type: "SUCCESS",
                recipientUserIds: [invoice.salesExecId],
                targetUrl: "/pms/approvals?tab=invoices",
              }
            : undefined,
          execute: (client) => InvoiceWorkflowService.approveByAccountTx(client, actor, id),
        });
        projectId = await InvoiceWorkflowService.findProjectLink(id);
        await NotificationService.notifyWorkflowTransition({
          message: `New approved invoice ${shortInvoiceId(id)} is ready for project creation.`,
          type: "INFO",
          recipientRoles: ["product_posting_manager", "software_manager", "dd_manager"],
          module: "invoice-workflow",
          entityType: "Invoice",
          entityId: id,
          targetUrl: "/pms/approvals?tab=invoices",
        });
        try {
          const { getConfigValue } = await import("../services/gm-sales-config.service");
          const { PROJECT_GENERATION_MODE } = await import("../../shared/gm-sales-constants");
          const mode = await getConfigValue("projectGenerationMode");
          if (mode === PROJECT_GENERATION_MODE.AUTOMATIC) {
            const gen = await createOrLinkProjectForApprovedInvoice({
              invoiceId: id,
              actorUserId: actor.userId,
              req,
            });
            if (gen.ok && gen.projectId) projectId = gen.projectId;
          }
        } catch (genErr) {
          console.error("[Invoices PUT /approve] project generation failed (best-effort):", genErr);
        }
        await CrossDepartmentStatusService.onInvoiceAccountApproved({
          invoiceId: id,
          projectId,
          toStatus: INVOICE_WORKFLOW_STATUSES.APPROVED,
          actorUserId: actor.userId,
          req,
        });
      }
      const data = await InvoiceWorkflowService.getInvoice(id);
      return res.json({ success: true, data, projectId });
    }
    throw new ApiError(400, "BAD_REQUEST", `Invoice is not at an approvable stage (status: ${invoice.status})`);
  } catch (error) {
    console.error("[Invoices PUT /approve]", error);
    sendError(res, error);
  }
});
