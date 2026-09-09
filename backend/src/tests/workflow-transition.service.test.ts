import { describe, it, expect, vi } from "vitest";

// Phase 2 (section C): mock the database module before importing anything
// that transitively loads it. workflow-transition.service.ts -> AuditLogService
// -> activity-service.ts -> server/db.ts, whose module body constructs a real
// pg.Pool and logs the configured (shared Supabase) host/port. Every audit
// call this test's code path can reach is already best-effort and wrapped in
// try/catch by the real implementation, so a minimal stub is sufficient — no
// real Pool is ever constructed and no hostname is ever logged.
vi.mock("./db", () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    connect: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })), release: vi.fn() })),
    on: vi.fn(),
    end: vi.fn(async () => {}),
  },
  db: {},
  isDbAvailable: () => true,
  isNetworkOrDnsError: () => false,
  markDbUnavailable: () => {},
  getDbUnavailableReason: () => null,
  ensureDbAvailable: async () => true,
  checkDbHealth: async () => ({ ok: true }),
}));

import {
  validateTransition,
  validateExtensionRequestInput,
  resolveWorkflowRouting,
  WorkflowTransitionError,
  type TransitionContext,
} from "./services/workflow-transition.service";

/**
 * Captures a WorkflowTransitionError thrown by validateTransition and returns
 * its {status, code}. Fails loudly if nothing was thrown.
 */
function expectReject(ctx: TransitionContext): { status: number; code: string } {
  try {
    validateTransition(ctx);
  } catch (err) {
    expect(err).toBeInstanceOf(WorkflowTransitionError);
    const e = err as WorkflowTransitionError;
    return { status: e.status, code: e.code };
  }
  throw new Error("Expected validateTransition to throw, but it returned.");
}

describe("validateTransition — self-loop guard order (regression)", () => {
  // The historical bug: a same-phase transition early-returned BEFORE the
  // role/ownership/content checks, so a self-loop EXECUTIVE_SUBMITTED on an
  // already-RUNNING_PROJECT workflow bypassed ownership entirely. These tests
  // pin that the guards still run on self-loops.

  it("rejects a wrong-owner EXECUTIVE_SUBMITTED self-loop with 403", () => {
    const res = expectReject({
      from: "RUNNING_PROJECT",
      to: "RUNNING_PROJECT",
      action: "EXECUTIVE_SUBMITTED",
      ownershipSatisfied: false,
      evidenceCount: 5,
      enforceContent: true,
    });
    expect(res.status).toBe(403);
    expect(res.code).toBe("WORKFLOW_OWNERSHIP_FORBIDDEN");
  });

  it("rejects an EXECUTIVE_SUBMITTED self-loop with no evidence with 400", () => {
    const res = expectReject({
      from: "RUNNING_PROJECT",
      to: "RUNNING_PROJECT",
      action: "EXECUTIVE_SUBMITTED",
      ownershipSatisfied: true,
      evidenceCount: 0,
      enforceContent: true,
    });
    expect(res.status).toBe(400);
    expect(res.code).toBe("WORKFLOW_EVIDENCE_REQUIRED");
  });

  it("rejects a wrong-owner EXTENSION_REQUESTED self-loop with 403", () => {
    const res = expectReject({
      from: "RUNNING_PROJECT",
      to: "RUNNING_PROJECT",
      action: "EXTENSION_REQUESTED",
      ownershipSatisfied: false,
    });
    expect(res.status).toBe(403);
    expect(res.code).toBe("WORKFLOW_OWNERSHIP_FORBIDDEN");
  });

  it("rejects a wrong-role self-loop with 403 (role guard still runs)", () => {
    // MANAGER_COMPLETE is role-restricted to managers; a self-loop performed by
    // an executive must NOT slip through.
    const res = expectReject({
      from: "QA_REVIEW",
      to: "QA_REVIEW",
      action: "MANAGER_COMPLETE",
      actorRoles: ["product_posting_executive"],
    });
    expect(res.status).toBe(403);
    expect(res.code).toBe("WORKFLOW_ROLE_FORBIDDEN");
  });

  it("permits a valid EXECUTIVE_SUBMITTED self-loop (owner + evidence)", () => {
    expect(() =>
      validateTransition({
        from: "RUNNING_PROJECT",
        to: "RUNNING_PROJECT",
        action: "EXECUTIVE_SUBMITTED",
        ownershipSatisfied: true,
        evidenceCount: 3,
        enforceContent: true,
      }),
    ).not.toThrow();
  });
});

describe("validateTransition — action binding & content", () => {
  it("rejects an unknown action with 400", () => {
    const res = expectReject({
      from: "RUNNING_PROJECT",
      to: "RUNNING_PROJECT",
      action: "NOT_A_REAL_ACTION",
    });
    expect(res.status).toBe(400);
    expect(res.code).toBe("WORKFLOW_UNKNOWN_ACTION");
  });

  it("rejects an illegal (non-self-loop) transition with 400", () => {
    const res = expectReject({
      from: "PENDING_PROJECT",
      to: "VERIFICATION_COMPLETE",
      action: "DATA_VERIFIED",
    });
    expect(res.status).toBe(400);
    expect(res.code).toBe("WORKFLOW_ILLEGAL_TRANSITION");
  });

  it("rejects DOCUMENT_REJECTED without a reason with 400", () => {
    const res = expectReject({
      from: "DATA_VERIFY",
      to: "PENDING_PROJECT",
      action: "DOCUMENT_REJECTED",
      actorRoles: ["product_posting_manager"],
      enforceContent: true,
      reason: "   ",
    });
    expect(res.status).toBe(400);
    expect(res.code).toBe("WORKFLOW_REASON_REQUIRED");
  });

  it("rejects QA_RETURNED by a non-QA role with 403", () => {
    const res = expectReject({
      from: "QA_REVIEW",
      to: "RETURNED_FOR_CHANGE",
      action: "QA_RETURNED",
      actorRoles: ["product_posting_executive"],
      enforceContent: true,
      reason: "needs fixes",
    });
    expect(res.status).toBe(403);
    expect(res.code).toBe("WORKFLOW_ROLE_FORBIDDEN");
  });

  it("permits a valid manager DATA_VERIFIED transition", () => {
    expect(() =>
      validateTransition({
        from: "DATA_VERIFY",
        to: "PROJECT_OVERVIEW",
        action: "DATA_VERIFIED",
        actorRoles: ["product_posting_manager"],
        enforceContent: true,
      }),
    ).not.toThrow();
  });

  it("permits an admin to override an illegal transition with a reason", () => {
    expect(() =>
      validateTransition({
        from: "PENDING_PROJECT",
        to: "VERIFICATION_COMPLETE",
        action: "DATA_VERIFIED",
        actorRoles: ["admin"],
        override: true,
        reason: "manual correction",
      }),
    ).not.toThrow();
  });
});

describe("validateExtensionRequestInput", () => {
  it("accepts a positive minutes value with a non-empty reason", () => {
    expect(validateExtensionRequestInput({ requestedTimeMinutes: 30, reason: "need more time" })).toBeNull();
    expect(validateExtensionRequestInput({ requestedTimeMinutes: "45", reason: "ok" })).toBeNull();
  });

  it("rejects non-positive, NaN, or missing minutes with 400 EXTENSION_MINUTES_INVALID", () => {
    for (const minutes of [0, -5, "abc", null, undefined]) {
      const err = validateExtensionRequestInput({ requestedTimeMinutes: minutes, reason: "valid" });
      expect(err).toBeInstanceOf(WorkflowTransitionError);
      expect(err?.status).toBe(400);
      expect(err?.code).toBe("EXTENSION_MINUTES_INVALID");
    }
  });

  it("rejects an empty/whitespace/non-string reason with 400 EXTENSION_REASON_REQUIRED", () => {
    for (const reason of ["", "   ", null, undefined, 42]) {
      const err = validateExtensionRequestInput({ requestedTimeMinutes: 30, reason });
      expect(err).toBeInstanceOf(WorkflowTransitionError);
      expect(err?.status).toBe(400);
      expect(err?.code).toBe("EXTENSION_REASON_REQUIRED");
    }
  });

  it("checks minutes before reason (minutes error wins when both are bad)", () => {
    const err = validateExtensionRequestInput({ requestedTimeMinutes: 0, reason: "" });
    expect(err?.code).toBe("EXTENSION_MINUTES_INVALID");
  });
});

describe("resolveWorkflowRouting", () => {
  it("uses an explicit departmentType verbatim (structured signal wins, no text guess)", () => {
    for (const dept of ["DND", "PRODUCT_POSTING", "SOFTWARE"] as const) {
      const r = resolveWorkflowRouting({ departmentType: dept });
      expect(r.departmentType).toBe(dept);
      expect(r.derivedFromText).toBe(false);
    }
  });

  it("normalizes departmentType case/whitespace before matching", () => {
    const r = resolveWorkflowRouting({ departmentType: "  dnd  " });
    expect(r.departmentType).toBe("DND");
    expect(r.derivedFromText).toBe(false);
  });

  it("lets an explicit departmentType override conflicting name hints", () => {
    // Name screams DND, but the structured column says PRODUCT_POSTING and wins.
    const r = resolveWorkflowRouting({
      departmentType: "PRODUCT_POSTING",
      projectName: "Alibaba minisite listing",
    });
    expect(r.departmentType).toBe("PRODUCT_POSTING");
    expect(r.derivedFromText).toBe(false);
  });

  it("resolves workflowType 'software' to SOFTWARE structurally (no text derivation)", () => {
    const r = resolveWorkflowRouting({
      workflowType: "software",
      projectName: "Alibaba minisite listing", // DND hints must be ignored here
    });
    expect(r.departmentType).toBe("SOFTWARE");
    expect(r.workflowType).toBe("software");
    expect(r.derivedFromText).toBe(false);
    expect(r.managerDashboardUrl).toBe("/dashboard/l-manager");
    expect(r.executiveDashboardUrl).toBe("/dashboard/l-executive");
  });

  it("derives DND from project name hints when no structured signal exists", () => {
    for (const name of ["client minisite build", "Mini Site refresh", "product listing", "Alibaba store"]) {
      const r = resolveWorkflowRouting({ projectName: name });
      expect(r.departmentType).toBe("DND");
      expect(r.derivedFromText).toBe(true);
      expect(r.managerDashboardUrl).toBe("/dd/manager");
      expect(r.executiveDashboardUrl).toBe("/dd/executive");
    }
  });

  it("derives DND from the invoice project name as well", () => {
    const r = resolveWorkflowRouting({ invoiceProjectName: "Alibaba listing setup" });
    expect(r.departmentType).toBe("DND");
    expect(r.derivedFromText).toBe(true);
  });

  it("falls back to PRODUCT_POSTING when no signal and no DND hints", () => {
    const r = resolveWorkflowRouting({ projectName: "generic catalog work" });
    expect(r.departmentType).toBe("PRODUCT_POSTING");
    expect(r.workflowType).toBe("product-posting");
    expect(r.derivedFromText).toBe(true);
    expect(r.managerDashboardUrl).toBe("/product-posting/manager");
    expect(r.executiveDashboardUrl).toBe("/product-posting/executive");
  });

  it("falls back to PRODUCT_POSTING with derivedFromText when given no inputs at all", () => {
    const r = resolveWorkflowRouting({});
    expect(r.departmentType).toBe("PRODUCT_POSTING");
    expect(r.derivedFromText).toBe(true);
  });

  it("derivedFromText is true ONLY on the text fallback path", () => {
    expect(resolveWorkflowRouting({ departmentType: "SOFTWARE" }).derivedFromText).toBe(false);
    expect(resolveWorkflowRouting({ workflowType: "software" }).derivedFromText).toBe(false);
    expect(resolveWorkflowRouting({ projectName: "anything" }).derivedFromText).toBe(true);
  });

  it("ignores blank/whitespace departmentType and falls through to text derivation", () => {
    const r = resolveWorkflowRouting({ departmentType: "   ", projectName: "minisite" });
    expect(r.departmentType).toBe("DND");
    expect(r.derivedFromText).toBe(true);
  });

  it("ignores an unrecognized departmentType value and falls through to text derivation", () => {
    const r = resolveWorkflowRouting({ departmentType: "MARKETING", projectName: "plain project" });
    expect(r.departmentType).toBe("PRODUCT_POSTING");
    expect(r.derivedFromText).toBe(true);
  });

  it("prefers an explicit product-posting workflowType over its derived value", () => {
    const r = resolveWorkflowRouting({ workflowType: "product-posting", projectName: "minisite" });
    // DND is a product-posting subtype, so text still splits the department,
    // but the explicit workflowType is preserved.
    expect(r.departmentType).toBe("DND");
    expect(r.workflowType).toBe("product-posting");
    expect(r.derivedFromText).toBe(true);
  });

  it("computes serviceType from invoice name, then project name, then department", () => {
    expect(resolveWorkflowRouting({ departmentType: "DND", invoiceProjectName: "Inv-1", projectName: "Proj-1" }).serviceType).toBe("Inv-1");
    expect(resolveWorkflowRouting({ departmentType: "DND", projectName: "Proj-1" }).serviceType).toBe("Proj-1");
    expect(resolveWorkflowRouting({ departmentType: "DND" }).serviceType).toBe("DND");
  });
});
