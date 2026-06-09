import { describe, it, expect } from "vitest";
import {
  validateTransition,
  validateExtensionRequestInput,
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
