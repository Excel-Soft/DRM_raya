import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MD-15 resolution tests ("Own department only" — see
 * docs/completion/MANAGEMENT_DECISIONS_REQUIRED.md, DECISION_LOG.md D-012,
 * D-013).
 *
 * Corrected 2026-07-20 (D-012): the first version of this test file mocked
 * `getDepartmentFilterUserIds` (dashboard-routes.ts) and asserted that a
 * `null` return from it meant "organization-wide" for every role that
 * mechanism classifies as global-admin. That was wrong against the actual
 * MD-15 policy — only admin/super_admin are organization-wide; HOD, Super
 * HOD, and Account Manager must be scoped to their own department/reporting
 * line, same as Sales Manager. `gm-pool-routes.ts`'s `gmApprovalScopeClause`
 * no longer calls `getDepartmentFilterUserIds` at all — it uses a dedicated
 * `resolveGmApprovalScopeUserIds` resolver instead, so this file mocks
 * `pool.query` directly (the resolver's own reporting-line lookup) rather
 * than a helper it no longer depends on.
 *
 * Corrected again 2026-07-21 (D-013), after a live production incident: every
 * hod/super_hod/account_manager/sales_manager account had `under_works`
 * completely unpopulated, so the recursive walk always resolved to "self
 * only" and no HOD could approve anything a sales executive created. The
 * resolver now falls back to organization-wide when the walk finds no one
 * besides the caller — a data-quality fallback, not a policy reversal. Tests
 * below that used to assert "never returns null" for a self-only result have
 * been corrected to expect the fallback instead; a new sibling test per role
 * proves the ORIGINAL behavior still holds when a real team is found.
 *
 * `gm-pool-routes.ts` transitively reaches `server/db.ts` (via
 * gm-sales-config.service / NotificationService / CrossDepartmentStatusService
 * / gm-sales-audit), so it is mocked first, per the established project
 * convention. `pool.query` is a controllable `vi.fn()` so each scenario can
 * drive the reporting-line lookup deterministically without a real database.
 */
const mockPoolQuery = vi.fn();
vi.mock("./db", () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
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

const { gmApprovalScopeClause, resolveGmApprovalScopeUserIds } = await import("../routes/gm-pool-routes");

beforeEach(() => {
  mockPoolQuery.mockReset();
});

function mockReq(userId: string, roleId: string): any {
  return { user: { userId, roleId, activeRoleId: roleId } };
}

function routeSource(): string {
  return readFileSync(join(process.cwd(), "server", "gm-pool-routes.ts"), "utf8");
}

/**
 * Adversarial-review fix (2026-07-20, DECISION_LOG.md D-012): the original
 * version of the tests below only asserted on the JS-side array returned by
 * a fully-mocked `pool.query` — since that mock's return value was configured
 * by the test itself, a `.not.toContain(...)` check on an id the mock was
 * never given back is true regardless of whether the real SQL/CTE is
 * correct. This helper additionally asserts on the ACTUAL query text and
 * bound parameter `resolveGmApprovalScopeUserIds` sends to `pool.query`: a
 * recursive CTE joining on `under_works`, seeded ONLY by the caller's own id.
 * That shape structurally bounds the possible result set to "caller +
 * transitive reports" — it cannot regress to an org-wide `SELECT id FROM
 * drm.users` (no join/seed at all) without this assertion failing, which is
 * the exact regression class the exclusion-only checks below could not
 * previously catch.
 */
function expectReportingLineQuery(callerId: string) {
  expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  const [sql, params] = mockPoolQuery.mock.calls[0];
  expect(sql).toContain("WITH RECURSIVE");
  expect(sql).toContain("under_works");
  expect(params).toEqual([callerId]);
}

describe("MD-15 — Admin and Super Admin are organization-wide", () => {
  it.each(["admin", "super_admin"])("resolveGmApprovalScopeUserIds returns null (no restriction) for role=%s", async (role) => {
    const result = await resolveGmApprovalScopeUserIds(mockReq("admin-1", role));
    expect(result).toBeNull();
    // Organization-wide status is decided from the role alone — no reporting-line lookup should run.
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it.each(["admin", "super_admin"])("gmApprovalScopeClause applies no restriction and pushes no param for role=%s", async (role) => {
    const params: any[] = ["gm-id-1"];
    const originalLength = params.length;
    const clause = await gmApprovalScopeClause(mockReq("admin-1", role), params);
    expect(clause).toBe("");
    expect(params.length).toBe(originalLength);
  });
});

describe("MD-15 — HOD: same-department allowed, different-department denied", () => {
  it("includes a same-reporting-line GM entry's creator id in the allowed set", async () => {
    // Simulates the recursive CTE resolving hod-1's own id plus every user
    // transitively under them (a manager, and an executive under that
    // manager) — proving multi-level reporting-line resolution, not just
    // hod-1's direct reports.
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "hod-1" }, { id: "mgr-under-hod" }, { id: "exec-under-mgr" }] });
    const params: any[] = ["gm-id-1"];
    const clause = await gmApprovalScopeClause(mockReq("hod-1", "hod"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).toContain("exec-under-mgr");
    expectReportingLineQuery("hod-1");
  });

  it("excludes a different-department (outside the reporting line) user's id from the allowed set", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "hod-1" }, { id: "mgr-under-hod" }] });
    const params: any[] = ["gm-id-2"];
    const clause = await gmApprovalScopeClause(mockReq("hod-1", "hod"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).not.toContain("exec-in-other-department");
    // Proves the exclusion is a consequence of the real, bounded reporting-line
    // query (seeded only by "hod-1"), not just of what this test's mock
    // happened to be configured to return.
    expectReportingLineQuery("hod-1");
  });

  it("HOD stays scoped (not organization-wide) when the hierarchy finds a real team", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "hod-1" }, { id: "mgr-under-hod" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("hod-1", "hod"));
    expect(result).not.toBeNull();
  });

  it("D-013: HOD falls back to organization-wide when the hierarchy finds no team besides themselves", async () => {
    // Live incident (2026-07-21): every hod/super_hod/account_manager/
    // sales_manager account had under_works completely unpopulated, so the
    // recursive walk always resolved to "self only" — no HOD could approve
    // anything a sales executive created. Falling back to org-wide here is
    // what restores the workflow; see DECISION_LOG.md D-013.
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "hod-1" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("hod-1", "hod"));
    expect(result).toBeNull();
  });
});

describe("MD-15 — Super HOD cannot access records outside the authorized reporting line", () => {
  it("resolves to Super HOD's own reporting line only, not every record in the system", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "super-hod-1" }, { id: "hod-under-super" }, { id: "exec-under-hod" }] });
    const params: any[] = ["gm-id-3"];
    const clause = await gmApprovalScopeClause(mockReq("super-hod-1", "super_hod"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).toContain("exec-under-hod");
    expect(allowedIds).not.toContain("exec-in-unrelated-department");
    expectReportingLineQuery("super-hod-1");
  });

  it("Super HOD stays scoped (not organization-wide) when the hierarchy finds a real team", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "super-hod-1" }, { id: "hod-under-super" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("super-hod-1", "super_hod"));
    expect(result).not.toBeNull();
  });

  it("D-013: Super HOD falls back to organization-wide when the hierarchy finds no team besides themselves", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "super-hod-1" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("super-hod-1", "super_hod"));
    expect(result).toBeNull();
  });
});

describe("MD-15 — Account Manager can access same-department records only", () => {
  it("resolves to Account Manager's own reporting line, excluding other departments", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "am-1" }, { id: "exec-under-am" }] });
    const params: any[] = ["gm-id-4"];
    const clause = await gmApprovalScopeClause(mockReq("am-1", "account_manager"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).toContain("exec-under-am");
    expect(allowedIds).not.toContain("exec-in-other-department");
    expectReportingLineQuery("am-1");
  });

  it("Account Manager stays scoped (not organization-wide) when the hierarchy finds a real team", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "am-1" }, { id: "exec-under-am" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("am-1", "account_manager"));
    expect(result).not.toBeNull();
  });

  it("D-013: Account Manager falls back to organization-wide when the hierarchy finds no team besides themselves", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "am-1" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("am-1", "account_manager"));
    expect(result).toBeNull();
  });
});

describe("MD-15 — Sales Manager can access same-department records only", () => {
  it("includes a same-team GM entry's creator id in the allowed set", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "sm-1" }, { id: "teammate-a" }, { id: "teammate-b" }] });
    const params: any[] = ["gm-id-5"];
    const clause = await gmApprovalScopeClause(mockReq("sm-1", "sales_manager"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).toContain("teammate-a");
    expectReportingLineQuery("sm-1");
  });

  it("excludes a different-team user's id from the allowed set", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "sm-1" }, { id: "teammate-a" }] });
    const params: any[] = ["gm-id-6"];
    const clause = await gmApprovalScopeClause(mockReq("sm-1", "sales_manager"), params);

    expect(clause).toContain("AND created_by::uuid = ANY(");
    const allowedIds = params[params.length - 1];
    expect(allowedIds).not.toContain("stranger-in-other-department");
    expectReportingLineQuery("sm-1");
  });

  it("Sales Manager stays scoped (not organization-wide) when the hierarchy finds a real team", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "sm-1" }, { id: "teammate-a" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("sm-1", "sales_manager"));
    expect(result).not.toBeNull();
  });

  it("D-013: Sales Manager falls back to organization-wide when the hierarchy finds no team besides themselves", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: "sm-1" }] });
    const result = await resolveGmApprovalScopeUserIds(mockReq("sm-1", "sales_manager"));
    expect(result).toBeNull();
  });
});

describe("MD-15/D-013 — a lookup ERROR still fails closed to self-only; a lookup that finds no team falls back to organization-wide", () => {
  it.each(["hod", "super_hod", "account_manager", "sales_manager"])(
    "role=%s: an empty reporting-line lookup (no team found) falls back to organization-wide, restoring the approval workflow",
    async (role) => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const result = await resolveGmApprovalScopeUserIds(mockReq("caller-empty", role));
      expect(result).toBeNull();
      expectReportingLineQuery("caller-empty");
    },
  );

  it.each(["hod", "super_hod", "account_manager", "sales_manager"])(
    "role=%s: gmApprovalScopeClause applies no restriction after an empty (no-team) lookup",
    async (role) => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const params: any[] = ["gm-id-empty"];
      const originalLength = params.length;
      const clause = await gmApprovalScopeClause(mockReq("caller-empty-2", role), params);
      expect(clause).toBe("");
      expect(params.length).toBe(originalLength);
    },
  );

  it.each(["hod", "super_hod", "account_manager", "sales_manager"])(
    "role=%s: a failed reporting-line lookup fails closed to self-only, never null and never unrestricted",
    async (role) => {
      mockPoolQuery.mockRejectedValueOnce(new Error("connection lost"));
      const result = await resolveGmApprovalScopeUserIds(mockReq("caller-fail", role));
      expect(result).not.toBeNull();
      expect(result).toEqual(["caller-fail"]);
    },
  );

  it.each(["hod", "super_hod", "account_manager", "sales_manager"])(
    "role=%s: gmApprovalScopeClause still emits a restrictive (non-empty) clause after a failed lookup",
    async (role) => {
      mockPoolQuery.mockRejectedValueOnce(new Error("connection lost"));
      const params: any[] = ["gm-id-7"];
      const clause = await gmApprovalScopeClause(mockReq("caller-fail-2", role), params);
      expect(clause).toContain("AND created_by::uuid = ANY(");
      expect(clause).not.toBe("");
      expect(params[params.length - 1]).toEqual(["caller-fail-2"]);
    },
  );
});

describe("MD-15 — pending-list routes use the same scope mechanism as approve/reject", () => {
  const routesUsingScope = [
    "hodApproveParams",
    "hodRejectParams",
    "amApproveParams",
    "amRejectParams",
    "smApproveParams",
    "smRejectParams",
    // super-hod-approve/reject were MISSING from this list until the
    // 2026-07-20 adversarial review (D-012) — that omission is exactly why
    // the shipped code was allowed to skip scoping these two routes (they
    // were wrongly assumed to be dead code; see gm-pool-routes.ts's
    // pending_super_hod comment and gm-uat.test.ts's corrected docstring).
    "superHodApproveParams",
    "superHodRejectParams",
    "withdrawApproveParams",
    "withdrawRejectParams",
    "pendingWithdrawalsParams",
  ];

  it("every approve/reject/withdraw action calls gmApprovalScopeClause", () => {
    const src = routeSource();
    for (const paramVar of routesUsingScope) {
      const callSite = `gmApprovalScopeClause(req, ${paramVar})`;
      expect(src.includes(callSite), `expected ${paramVar}'s call site to exist`).toBe(true);
    }
  });

  it("pending-account-manager, pending-sales-manager and pending-super-hod each call it for BOTH the list and count query", () => {
    const src = routeSource();
    expect(src.includes("gmApprovalScopeClause(req, listParams)")).toBe(true);
    expect(src.includes("gmApprovalScopeClause(req, countParams)")).toBe(true);
    const listCalls = src.split("gmApprovalScopeClause(req, listParams)").length - 1;
    const countCalls = src.split("gmApprovalScopeClause(req, countParams)").length - 1;
    expect(listCalls).toBe(3);
    expect(countCalls).toBe(3);
  });

  it("pending-withdrawals calls it via its own dedicated params (single query, no separate count)", () => {
    const src = routeSource();
    expect(src.includes("gmApprovalScopeClause(req, pendingWithdrawalsParams)")).toBe(true);
  });

  it("total call-site count matches exactly what this phase added (no route silently skipped)", () => {
    const src = routeSource();
    const totalOccurrences = src.split("await gmApprovalScopeClause(req,").length - 1;
    // 10 approve/reject/withdraw actions (hod, account-manager, sales-manager,
    // super-hod x2 each, plus withdraw x2) + 3 stage-based pending routes x 2
    // (list+count) + 1 pending-withdrawals = 10 + 6 + 1 = 17. (Was 15 before
    // the 2026-07-20 D-012 fix added the 2 super-hod-approve/reject sites.)
    expect(totalOccurrences).toBe(17);
  });

  it("every one of the 17 call sites resolves through the SAME resolver — no route uses a different or duplicated scope mechanism", () => {
    const src = routeSource();
    // resolveGmApprovalScopeUserIds must be defined exactly once (the single
    // authoritative resolver) and gmApprovalScopeClause must be its only
    // caller's basis (no route calls a second, competing scope function).
    const resolverStart = src.indexOf("export async function resolveGmApprovalScopeUserIds");
    expect(resolverStart).toBeGreaterThan(-1);
    const resolverDefinitions = src.split("export async function resolveGmApprovalScopeUserIds").length - 1;
    expect(resolverDefinitions).toBe(1);
    const clauseStart = src.indexOf("export async function gmApprovalScopeClause");
    expect(clauseStart).toBeGreaterThan(resolverStart);
    // The MD-15 resolver itself (from its own definition up to the start of
    // gmApprovalScopeClause, which immediately follows it) must not delegate
    // to getDepartmentFilterUserIds — that helper is still used elsewhere in
    // this file (the unrelated, pre-existing GET /gm-pool list view), so this
    // check is scoped to the resolver's own body, not the whole file.
    const resolverBody = src.slice(resolverStart, clauseStart);
    expect(resolverBody.includes("getDepartmentFilterUserIds")).toBe(false);
  });
});
