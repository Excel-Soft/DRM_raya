import { describe, it, expect, vi } from "vitest";

// Phase 2 (section C): mock the database module before importing anything
// that transitively loads it. service-bridge.service.ts imports `pool`
// directly from server/db.ts, whose module body constructs a real pg.Pool and
// logs the configured (shared Supabase) host/port. No test below exercises a
// real query, so a minimal stub is sufficient — no real Pool is ever
// constructed and no hostname is ever logged.
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
  serviceFollowupCompleteSchema,
  serviceComplaintResolveSchema,
  serviceComplaintCloseSchema,
  serviceComplaintUpdateSchema,
  serviceDropoutRecoverSchema,
} from "./validators/service.validators";
import {
  validateServiceTransition,
  isLegalServiceTransition,
  SERVICE_LOGICAL_TO_STATUS,
  ServiceLifecycleError,
} from "./services/service-lifecycle.service";
import {
  ServiceBridgeError,
  mapServiceBridgeError,
} from "./services/service-bridge.service";
import {
  SERVICE_BRIDGE_CONFIG_DEFAULTS,
  SERVICE_BRIDGE_TARGET_TO_FLAG,
  SERVICE_BRIDGE_DISABLED_MESSAGE,
} from "../shared/service-bridge-constants";

const firstMsg = (r: { success: boolean; error?: any }) =>
  r.success ? null : r.error.issues[0]?.message;

// ---------------------------------------------------------------------------
// T005 — lifecycle action validators preserve EXACT required-field messages
// ---------------------------------------------------------------------------
describe("Stage 5 validators — follow-up complete", () => {
  it("rejects completion with no outcome (exact message)", () => {
    const r = serviceFollowupCompleteSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(firstMsg(r)).toBe("An outcome is required to complete a follow-up.");
  });
  it("rejects completion with a blank outcome (exact message)", () => {
    const r = serviceFollowupCompleteSchema.safeParse({ outcome: "   " });
    expect(r.success).toBe(false);
    expect(firstMsg(r)).toBe("An outcome is required to complete a follow-up.");
  });
  it("accepts a valid outcome and strips/keeps note", () => {
    const r = serviceFollowupCompleteSchema.safeParse({ outcome: "INTERESTED", note: "ok", junk: 1 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.outcome).toBe("INTERESTED");
      expect(r.data.note).toBe("ok");
      expect((r.data as any).junk).toBeUndefined();
    }
  });
});

describe("Stage 5 validators — complaint resolve/close/update", () => {
  it("rejects resolve with no remarks (exact message)", () => {
    const r = serviceComplaintResolveSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(firstMsg(r)).toBe("A resolution remark is required to resolve a complaint.");
  });
  it("accepts resolve with remarks", () => {
    const r = serviceComplaintResolveSchema.safeParse({ remarks: "fixed" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.remarks).toBe("fixed");
  });
  it("close schema is permissive (contextual rule lives in the route)", () => {
    expect(serviceComplaintCloseSchema.safeParse({}).success).toBe(true);
    expect(serviceComplaintCloseSchema.safeParse({ remarks: "x" }).success).toBe(true);
  });
  it("update schema strips unknown keys and coerces dueDate", () => {
    const r = serviceComplaintUpdateSchema.safeParse({ title: "T", dueDate: "2026-01-02", junk: "x" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("T");
      expect(r.data.dueDate).toBeInstanceOf(Date);
      expect((r.data as any).junk).toBeUndefined();
    }
  });
});

describe("Stage 5 validators — dropout recover", () => {
  it("rejects recover with no note (exact message)", () => {
    const r = serviceDropoutRecoverSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(firstMsg(r)).toBe("A recovery note is required to recover a dropout.");
  });
  it("accepts recover with a note", () => {
    const r = serviceDropoutRecoverSchema.safeParse({ recoveryNote: "won back" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.recoveryNote).toBe("won back");
  });
});

// ---------------------------------------------------------------------------
// T006 — lifecycle state machine: permissive by default, strict opt-in
// ---------------------------------------------------------------------------
describe("Stage 5 lifecycle — legal transition map", () => {
  it("knows canonical transitions", () => {
    expect(isLegalServiceTransition("active", "closed")).toBe(true);
    expect(isLegalServiceTransition("dropout", "active")).toBe(true);
    expect(isLegalServiceTransition("active", "active")).toBe(true);
    expect(isLegalServiceTransition("closed", "dropout")).toBe(false);
  });
  it("maps every logical state onto the stored enum", () => {
    expect(SERVICE_LOGICAL_TO_STATUS.RENEWED).toBe("renewed");
    expect(SERVICE_LOGICAL_TO_STATUS.DROPOUT_CONFIRMED).toBe("dropout");
    expect(SERVICE_LOGICAL_TO_STATUS.RECOVERED).toBe("active");
    expect(SERVICE_LOGICAL_TO_STATUS.CLOSED).toBe("closed");
  });
});

describe("Stage 5 lifecycle — validateServiceTransition", () => {
  it("permits a legacy non-canonical move with a warning (permissive default)", () => {
    const { warnings } = validateServiceTransition({ from: "closed", to: "dropout", strict: false });
    expect(warnings.length).toBeGreaterThan(0);
  });
  it("permits a canonical move with no warnings", () => {
    const { warnings } = validateServiceTransition({ from: "active", to: "renewed", strict: false });
    expect(warnings).toEqual([]);
  });
  it("strict mode rejects an illegal transition", () => {
    try {
      validateServiceTransition({ from: "closed", to: "dropout", strict: true });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceLifecycleError);
      expect((e as ServiceLifecycleError).code).toBe("SERVICE_ILLEGAL_TRANSITION");
    }
  });
  it("strict mode requires a reason to close", () => {
    try {
      validateServiceTransition({ from: "active", to: "closed", strict: true });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceLifecycleError);
      expect((e as ServiceLifecycleError).code).toBe("SERVICE_REASON_REQUIRED");
    }
  });
  it("rejects an invalid status value", () => {
    try {
      validateServiceTransition({ from: "active", to: "frozen" });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceLifecycleError);
      expect((e as ServiceLifecycleError).code).toBe("SERVICE_INVALID_STATUS");
    }
  });
});

// ---------------------------------------------------------------------------
// T001/T003 — config gating defaults + bridge error mapping
// ---------------------------------------------------------------------------
describe("Stage 5 bridges — defaults & error mapping", () => {
  it("all bridge flags default to disabled (false)", () => {
    expect(SERVICE_BRIDGE_CONFIG_DEFAULTS.serviceBridgeGmEnabled).toBe(false);
    expect(SERVICE_BRIDGE_CONFIG_DEFAULTS.serviceBridgeVasEnabled).toBe(false);
    expect(SERVICE_BRIDGE_CONFIG_DEFAULTS.serviceBridgeBvEnabled).toBe(false);
  });
  it("maps each target to its gating flag", () => {
    expect(SERVICE_BRIDGE_TARGET_TO_FLAG.gm).toBe("serviceBridgeGmEnabled");
    expect(SERVICE_BRIDGE_TARGET_TO_FLAG.vas).toBe("serviceBridgeVasEnabled");
    expect(SERVICE_BRIDGE_TARGET_TO_FLAG.bv).toBe("serviceBridgeBvEnabled");
    expect(SERVICE_BRIDGE_DISABLED_MESSAGE).toBe("Service bridge is not enabled");
  });
  it("mapServiceBridgeError handles ServiceBridgeError and ignores others", () => {
    const out: any = {};
    const res = {
      status(c: number) { out.code = c; return this; },
      json(b: unknown) { out.body = b; return this; },
    };
    expect(mapServiceBridgeError(res, new ServiceBridgeError(409, "BRIDGE_EXISTS", "dup"))).toBe(true);
    expect(out.code).toBe(409);
    expect(out.body).toMatchObject({ success: false, code: "BRIDGE_EXISTS", error: "dup" });
    expect(mapServiceBridgeError(res, new Error("plain"))).toBe(false);
  });
});
