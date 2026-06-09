import { Router, type Request } from "express";
import { requireRole } from "../auth.middleware";
import { ValidationService } from "../services/validation.service";
import { sendError, ApiError } from "../utils/api-error";
import { InvoiceWorkflowService, type Actor } from "../services/invoice-workflow.service";
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

// POST /api/invoices — create a workflow invoice
invoiceRouter.post("/", requireRole("sales_executive", "sales_manager", "admin"), async (req, res) => {
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
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices submit-hod]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/hod-approve
invoiceRouter.post("/:id/hod-approve", requireRole("hod", "super_hod", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const updated = await InvoiceWorkflowService.hodDecision(actorFrom(req), req.params.id, "APPROVE", undefined, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices hod-approve]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/hod-reject
invoiceRouter.post("/:id/hod-reject", requireRole("hod", "super_hod", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const { reason } = ValidationService.parse(workflowDecisionSchema, {
      action: "REJECT",
      reason: req.body?.reason,
    });
    const updated = await InvoiceWorkflowService.hodDecision(actorFrom(req), req.params.id, "REJECT", reason, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Invoices hod-reject]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/account-approve (+ PMS linkage)
invoiceRouter.post("/:id/account-approve", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const result = await InvoiceWorkflowService.accountDecision(actorFrom(req), req.params.id, "APPROVE", undefined, req);
    res.json({ success: true, data: result.invoice, projectId: result.projectId });
  } catch (error) {
    console.error("[Invoices account-approve]", error);
    sendError(res, error);
  }
});

// POST /api/invoices/:id/account-reject
invoiceRouter.post("/:id/account-reject", requireRole("account_manager", "admin"), async (req, res) => {
  try {
    requireAuth(req);
    const { reason } = ValidationService.parse(workflowDecisionSchema, {
      action: "REJECT",
      reason: req.body?.reason,
    });
    const result = await InvoiceWorkflowService.accountDecision(actorFrom(req), req.params.id, "REJECT", reason, req);
    res.json({ success: true, data: result.invoice });
  } catch (error) {
    console.error("[Invoices account-reject]", error);
    sendError(res, error);
  }
});

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

    // Route to the correct stage handler based on the invoice's current stage.
    if (invoice.status === "PENDING_HOD") {
      const updated = await InvoiceWorkflowService.hodDecision(actor, id, action as any, reason, req);
      return res.json({ success: true, data: updated });
    }
    if (invoice.status === "PENDING_ACCOUNT") {
      const result = await InvoiceWorkflowService.accountDecision(actor, id, action as any, reason, req);
      return res.json({ success: true, data: result.invoice, projectId: result.projectId });
    }
    throw new ApiError(400, "BAD_REQUEST", `Invoice is not at an approvable stage (status: ${invoice.status})`);
  } catch (error) {
    console.error("[Invoices PUT /approve]", error);
    sendError(res, error);
  }
});
