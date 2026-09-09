import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * Phase 2 (PCH-001/DS-002/SEC-DA-001/PCH-012) — mocked authorization tests.
 *
 * `requireGmSalesActionPermission` calls `getConfig()`, which is DB-backed
 * (`server/services/gm-sales-config.service.ts` queries
 * `drm.gm_sales_workflow_config`). This phase must not touch a database, so
 * that dependency is mocked here to resolve the safe defaults synchronously —
 * every test below is a pure, in-process check of the guard logic itself, not
 * an integration test against a real server or database.
 */
vi.mock("./services/gm-sales-config.service", async () => {
  const { GM_SALES_CONFIG_DEFAULTS } = await import("../shared/gm-sales-constants");
  return {
    getConfig: vi.fn(async () => ({ config: GM_SALES_CONFIG_DEFAULTS, meta: [] })),
    ensureConfigTable: vi.fn(async () => {}),
    getConfigValue: vi.fn(async (key: string) => (GM_SALES_CONFIG_DEFAULTS as any)[key]),
    patchConfig: vi.fn(async () => ({ updatedKeys: [], config: GM_SALES_CONFIG_DEFAULTS })),
  };
});

// Section C: mock the database module itself, before importing any
// middleware/route module that transitively loads it. The guards under test
// (requireGmSalesActionPermission, requireFinancialPermission,
// requireActionPermission) reach server/db.ts via their audit-logging path
// (AuditLogService -> activity-service.ts -> server/db.ts), whose module body
// constructs a real pg.Pool and logs the configured (shared Supabase)
// host/port on first load. No test below exercises a real query — audit
// calls are best-effort and already wrapped in try/catch by the real code —
// so a minimal stub is sufficient: no real Pool is ever constructed and no
// hostname is ever logged.
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

const { requireGmSalesActionPermission, GM_SALES_ACTION_KEYS } = await import("./utils/gm-sales-permissions");
const { requireFinancialPermission, FINANCIAL_ACTIONS } = await import("./middleware/financial-permission");
const { requireActionPermission, denyPendingManagementDecision } = await import(
  "./middleware/action-permission.middleware"
);

function mockReq(user?: Partial<Express.Request["user"]> | null, extra: Record<string, unknown> = {}): Request {
  return { user: user ?? undefined, params: {}, query: {}, body: {}, ...extra } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("Standardized 401/403 envelope", () => {
  it("returns 401 UNAUTHORIZED for an unauthenticated request", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS);
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 FORBIDDEN (standard envelope) for a denied role", async () => {
    const guard = requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentView);
    const req = mockReq({ userId: "u1", roleId: "sales_executive" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as any).success).toBe(false);
    expect((res.body as any).error.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Allowed role", () => {
  it("account_manager passes the AB payment view gate (requireFinancialPermission)", async () => {
    const guard = requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentView);
    const req = mockReq({ userId: "u1", roleId: "account_manager" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("account_manager passes the GM account-approve gate (requireGmSalesActionPermission)", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS);
    const req = mockReq({ userId: "u1", roleId: "account_manager" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("Denied role", () => {
  it("sales_executive is denied the GM account-approve gate", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS);
    const req = mockReq({ userId: "u2", roleId: "sales_executive" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("hod is denied the Dollar Buying create gate (admin + account_manager only)", async () => {
    const guard = requireFinancialPermission(FINANCIAL_ACTIONS.dollarBuyingCreate);
    const req = mockReq({ userId: "u3", roleId: "hod" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Out-of-scope record (ownership predicate)", () => {
  it("denies an action on a record the caller does not own via checkOwnership", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_EDIT, {
      checkOwnership: async () => false, // simulates "this GM entry belongs to someone else"
    });
    const req = mockReq({ userId: "u4", roleId: "sales_executive" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as any).error ?? (res.body as any).code).toBeTruthy();
    expect(next).not.toHaveBeenCalled();
  });

  it("allows the same action once checkOwnership confirms the record is in-scope", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_EDIT, {
      checkOwnership: async () => true, // simulates "this GM entry belongs to the caller"
    });
    const req = mockReq({ userId: "u4", roleId: "sales_executive" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("Admin-only action (Override)", () => {
  it("denies a non-admin role on the admin-only fix-status break-glass action", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_FIX_STATUS);
    const req = mockReq({ userId: "u5", roleId: "super_hod" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows admin (bypass) on the same admin-only action", async () => {
    const guard = requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_FIX_STATUS);
    const req = mockReq({ userId: "u6", roleId: "admin" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("Export permission", () => {
  it("account_manager may export AB payments", async () => {
    const guard = requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentExport);
    const req = mockReq({ userId: "u7", roleId: "account_manager" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("sales_manager is denied exporting AB payments", async () => {
    const guard = requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentExport);
    const req = mockReq({ userId: "u8", roleId: "sales_manager" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Deny-by-default for a pending management decision (MD-8: AB payment approve/void)", () => {
  it("denies every authenticated role, not just some, while the decision is pending", async () => {
    const guard = denyPendingManagementDecision("MD-8", "AB payment approve/reject/void role list is not yet decided");
    for (const roleId of ["admin", "super_hod", "account_manager", "sales_executive"]) {
      const req = mockReq({ userId: "u9", roleId } as any);
      const res = mockRes();
      const next = vi.fn();
      await guard(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("still returns 401 for an unauthenticated request rather than leaking a 403", async () => {
    const guard = denyPendingManagementDecision("MD-8", "pending");
    const req = mockReq(null);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});

describe("Deny by default when no permission rule exists (requireActionPermission)", () => {
  it("an empty allow-list denies every role (no accidental fail-open)", async () => {
    const guard = requireActionPermission("phase2:test.no_role_configured", { roles: [] });
    const req = mockReq({ userId: "u10", roleId: "admin" } as any);
    const res = mockRes();
    const next = vi.fn();
    await guard(req, res, next);
    // An empty roles array with no adminOverride denies even admin — this is
    // intentionally the strictest possible deny-by-default configuration.
    expect(res.statusCode).toBe(403);
  });
});
