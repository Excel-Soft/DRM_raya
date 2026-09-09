import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 2 (section E) — route-level security tests.
 *
 * Two kinds of test live here:
 *  1. Static source checks ("is the middleware actually attached to this
 *     route registration line") — these read the real route files on disk and
 *     assert the guard call appears in the exact registration string, which is
 *     what "explicit static RBAC coverage" (this phase's exit criterion)
 *     means. No server is started, no network call is made.
 *  2. Mocked runtime checks reusing the same `./db` mock pattern as
 *     phase2-rbac.test.ts, for the two behaviors that need actual code
 *     execution rather than a source-text check: GM-BV assign/link-customer
 *     ownership scoping, and the AB-payment deny-pending guard actually
 *     short-circuiting before its handler runs.
 */

function routeSource(relPath: string): string {
  // Normalize CRLF -> LF: needles below embed literal "\n" to match specific
  // multi-line formatting, but git's core.autocrlf can check these files out
  // with CRLF line endings depending on the platform/config, which would
  // otherwise make an exact-content assertion fail for a purely cosmetic
  // line-ending reason unrelated to whether the guard code is actually there.
  return readFileSync(join(process.cwd(), "server", relPath), "utf8").replace(/\r\n/g, "\n");
}

describe("Middleware attached to every changed target route (static source check)", () => {
  const cases: Array<{ file: string; needle: string; label: string }> = [
    // account-routes.ts
    { file: "account-routes.ts", needle: 'app.get("/api/account/gm-entries", requireFinancialPermission(FINANCIAL_ACTIONS.gmEntriesView, { roles: FINANCIAL_VIEW_ROLES })', label: "GET gm-entries" },
    { file: "account-routes.ts", needle: 'app.get("/api/account/gm-entries/:id", requireFinancialPermission(FINANCIAL_ACTIONS.gmEntriesView, { roles: FINANCIAL_VIEW_ROLES })', label: "GET gm-entries/:id (R0/MD-14 exception)" },
    { file: "account-routes.ts", needle: 'app.post("/api/account/gm-entries/:id/status", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS)', label: "POST gm-entries/:id/status (R0/MD-14 exception)" },
    { file: "account-routes.ts", needle: 'app.patch("/api/account/gm-entries/:id/approve", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS)', label: "PATCH gm-entries/:id/approve (R0/MD-14 exception)" },
    { file: "account-routes.ts", needle: 'app.patch("/api/account/gm-entries/:id/reject", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS)', label: "PATCH gm-entries/:id/reject" },
    { file: "account-routes.ts", needle: 'app.delete("/api/account/gm-entries/:id", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS)', label: "DELETE gm-entries/:id" },
    { file: "account-routes.ts", needle: 'app.get("/api/account/temp-gm", requireFinancialPermission(FINANCIAL_ACTIONS.tempGmView', label: "GET temp-gm" },
    { file: "account-routes.ts", needle: 'app.delete("/api/account/temp-gm/:id", requireFinancialPermission(FINANCIAL_ACTIONS.tempGmDelete, { roles: FINANCIAL_VOID_ROLES })', label: "DELETE temp-gm/:id (void roles)" },
    { file: "account-routes.ts", needle: 'app.get("/api/account/ab-payments", requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentView', label: "GET ab-payments" },
    { file: "account-routes.ts", needle: "denyPendingManagementDecision(\n      \"MD-8", label: "PATCH ab-payments/:id/status deny-pending" },
    { file: "account-routes.ts", needle: 'app.get("/api/account/ab-payments/export", requireFinancialPermission(FINANCIAL_ACTIONS.abPaymentExport', label: "GET ab-payments/export" },
    { file: "account-routes.ts", needle: 'app.delete("/api/account/buying/:id", requireFinancialPermission(FINANCIAL_ACTIONS.dollarBuyingDelete, { roles: FINANCIAL_VOID_ROLES })', label: "DELETE buying/:id (void roles)" },
    { file: "account-routes.ts", needle: 'app.delete("/api/account/buyers/:id", requireFinancialPermission(FINANCIAL_ACTIONS.dollarBuyerDelete, { roles: FINANCIAL_VOID_ROLES })', label: "DELETE buyers/:id (void roles)" },
    { file: "account-routes.ts", needle: 'app.get("/api/account/ledger", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerView', label: "GET account/ledger" },
    { file: "account-routes.ts", needle: 'app.delete("/api/account/ledger/:id", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerDelete, { roles: FINANCIAL_VOID_ROLES })', label: "DELETE account/ledger/:id (void roles)" },
    // gm-pool-routes.ts
    { file: "gm-pool-routes.ts", needle: 'router.get("/gm-pool/pending-account-manager", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS)', label: "GET pending-account-manager" },
    { file: "gm-pool-routes.ts", needle: 'router.get("/gm-pool/pending-sales-manager", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_SALES_MANAGER)', label: "GET pending-sales-manager" },
    { file: "gm-pool-routes.ts", needle: 'router.get("/gm-pool/loan-admin-queue", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ADMIN)', label: "GET loan-admin-queue" },
    { file: "gm-pool-routes.ts", needle: "AND created_by = $3", label: "request-update creator scope" },
    { file: "gm-pool-routes.ts", needle: "AND created_by = $4", label: "request-withdraw creator scope" },
    { file: "gm-pool-routes.ts", needle: "AND created_by = $2 RETURNING id", label: "DELETE /gm-pool/:id creator scope" },
    // gm-bv-pool-routes.ts / repository
    { file: "gm-bv-pool-routes.ts", needle: "gmBvPoolRepository.assign(req.params.id, parsed.assignedTo, req.user.userId, req.user.roleId)", label: "GM-BV assign passes caller identity" },
    { file: "gm-bv-pool-routes.ts", needle: "gmBvPoolRepository.linkCustomer(req.params.id, req.user.userId, req.user.roleId)", label: "GM-BV link-customer passes caller identity" },
    { file: "repositories/gm-bv-pool.repository.ts", needle: "and (user_id = $3 or assigned_to = $3)", label: "GM-BV assign() ownership WHERE clause" },
    { file: "repositories/gm-bv-pool.repository.ts", needle: "and (user_id = $2 or assigned_to = $2)", label: "GM-BV linkCustomer() ownership WHERE clause" },
    // office-account-routes.ts
    { file: "office-account-routes.ts", needle: 'router.get("/trial-balance", requireFinancialPermission(FINANCIAL_ACTIONS.trialBalanceView, { roles: STAGE2_FINANCIAL_ROLES })', label: "GET trial-balance" },
    { file: "office-account-routes.ts", needle: 'router.get("/ledger", requireFinancialPermission(FINANCIAL_ACTIONS.ledgerView, { roles: STAGE2_FINANCIAL_ROLES })', label: "GET office ledger" },
    // crm-routes.ts
    { file: "crm-routes.ts", needle: 'router.get("/gm-pool", requireFinancialPermission(FINANCIAL_ACTIONS.gmEntriesView, { roles: FINANCIAL_VIEW_ROLES })', label: "GET crm gm-pool dual-mount" },
    // reports-routes.ts
    { file: "reports-routes.ts", needle: "requireFinancialPermission(FINANCIAL_ACTIONS.gmBvReconciliationView, { roles: FINANCIAL_VIEW_ROLES })", label: "GET gm-bv-reconciliation" },
    // stage3-reports-routes.ts
    { file: "stage3-reports-routes.ts", needle: "if (!isManagerialRole(role)) {", label: "GET /reports/department role gate" },
    { file: "stage3-reports-routes.ts", needle: "g.sales_person_id = ANY($", label: "GET /reports/daily-added-gm scope" },
    // service-reports-routes.ts
    { file: "service-reports-routes.ts", needle: "serviceDocumentsRepository.update(\n        req.params.id,", label: "PATCH service document scoped update" },
    { file: "service-reports-routes.ts", needle: "serviceDocumentsRepository.setVerification(req.params.id, status, req.user.userId, allowedUserIds)", label: "PATCH service document verify scoped" },
    { file: "service-reports-routes.ts", needle: "serviceDocumentsRepository.remove(req.params.id, allowedUserIds)", label: "DELETE service document scoped" },
    { file: "repositories/service-documents.repository.ts", needle: "uploaded_by::text = ANY($", label: "service document ownership WHERE clause" },
    // service-core-routes.ts
    { file: "service-core-routes.ts", needle: 'app.get("/api/service/gm-report", bridgeRoleGate,', label: "GET service/gm-report role gate" },
    // admin-activity-routes.ts
    { file: "admin-activity-routes.ts", needle: 'if (!req.user) return res.status(401).json({ error: "Not authenticated" });\n        const leadsCount', label: "GET admin/activities/summary authentication" },
  ];

  for (const { file, needle, label } of cases) {
    it(`${file} :: ${label}`, () => {
      const src = routeSource(file);
      expect(src.includes(needle), `Expected ${file} to contain the guard for "${label}"`).toBe(true);
    });
  }
});

describe("Pending AB approval/void actions never reach their handlers", () => {
  it("denyPendingManagementDecision short-circuits before next() — the handler body never runs", async () => {
    const { denyPendingManagementDecision } = await import("./middleware/action-permission.middleware");
    const handlerRan = vi.fn();
    const guard = denyPendingManagementDecision("MD-8", "AB payment approve/reject/void role list is not yet decided");

    const req = { user: { userId: "u1", roleId: "admin" } } as any;
    const res: any = { statusCode: 200, status: vi.fn(function (this: any, c: number) { this.statusCode = c; return this; }), json: vi.fn(function (this: any, b: any) { this.body = b; return this; }) };
    const next = vi.fn(() => handlerRan()); // simulates Express calling the next middleware (the real handler)

    await guard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(handlerRan).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("GM-BV assign and link-customer enforce actual ownership scope (mocked pool)", () => {
  it("assign() scopes to owner-or-assignee for a non-manager caller", async () => {
    vi.resetModules();
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    vi.doMock("./db", () => ({
      pool: {
        query: vi.fn(async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          return { rows: [{ id: "gm-1" }], rowCount: 1 };
        }),
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rows: [] })),
          release: vi.fn(),
        })),
      },
    }));
    const { gmBvPoolRepository } = await import("../repositories/gm-bv-pool.repository");
    await gmBvPoolRepository.assign("gm-1", "assignee-1", "caller-1", "sales_executive");

    const assignQuery = queries.find((q) => q.sql.includes("update bv_reports set assigned_to"));
    expect(assignQuery, "expected the assign() UPDATE to have run").toBeTruthy();
    expect(assignQuery!.sql).toContain("and (user_id = $3 or assigned_to = $3)");
    expect(assignQuery!.params).toEqual(["assignee-1", "gm-1", "caller-1"]);
    vi.doUnmock("./db");
  });

  it("assign() is NOT scoped (org-wide) for a manager caller", async () => {
    vi.resetModules();
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    vi.doMock("./db", () => ({
      pool: {
        query: vi.fn(async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          return { rows: [{ id: "gm-2" }], rowCount: 1 };
        }),
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rows: [] })),
          release: vi.fn(),
        })),
      },
    }));
    const { gmBvPoolRepository } = await import("../repositories/gm-bv-pool.repository");
    await gmBvPoolRepository.assign("gm-2", "assignee-2", "caller-2", "admin");

    const assignQuery = queries.find((q) => q.sql.includes("update bv_reports set assigned_to"));
    expect(assignQuery!.sql).not.toContain("and (user_id");
    expect(assignQuery!.params).toEqual(["assignee-2", "gm-2"]);
    vi.doUnmock("./db");
  });

  it("linkCustomer() scopes the initial lookup to owner-or-assignee for a non-manager caller", async () => {
    vi.resetModules();
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    vi.doMock("./db", () => ({
      pool: {
        query: vi.fn(async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          // First call is the scoped SELECT; return no row to simulate an
          // out-of-scope (or nonexistent) record, matching the route's
          // non-disclosing 404 for both cases.
          return { rows: [] };
        }),
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rows: [] })),
          release: vi.fn(),
        })),
      },
    }));
    const { gmBvPoolRepository } = await import("../repositories/gm-bv-pool.repository");
    const result = await gmBvPoolRepository.linkCustomer("gm-3", "caller-3", "sales_executive");

    expect(result).toBeNull();
    const selectQuery = queries.find((q) => q.sql.includes("select id, customer_id, company_name"));
    expect(selectQuery!.sql).toContain("and (user_id = $2 or assigned_to = $2)");
    expect(selectQuery!.params).toEqual(["gm-3", "caller-3"]);
    vi.doUnmock("./db");
  });
});

describe("Exports enforce the same scope/roles as their report views", () => {
  it("AB payment view and export share the identical role set", () => {
    const src = routeSource("account-routes.ts");
    // Both call sites must resolve to the same FINANCIAL_VIEW_ROLES constant —
    // a textual guarantee that export was not left with a different (weaker
    // or stronger) policy than its view counterpart.
    expect(src).toMatch(/abPaymentView, \{ roles: FINANCIAL_VIEW_ROLES \}/);
    expect(src).toMatch(/abPaymentExport, \{ roles: FINANCIAL_VIEW_ROLES \}/);
  });

  // Note: "same scope as the view" means the same ROW-LEVEL scope-resolving
  // function (who sees which records), not necessarily the same allowed-ROLE
  // list — bv_report/day_target intentionally allow a broader role set to
  // VIEW than to EXPORT (existing, pre-Phase-2 design: export is a bulk-data
  // action reasonably restricted to managers+, matching
  // REPORT_PERMISSION_MATRIX). Confirmed both view and export call the exact
  // same scope function, so an export can never see rows its own view
  // wouldn't have shown that caller.
  it("bv_report view and export both resolve row-scope via the same resolveBvScope() function", () => {
    const src = routeSource("reports-routes.ts");
    const occurrences = src.split("await resolveBvScope(req)").length - 1;
    expect(occurrences, "resolveBvScope should be called by both /reports/bv and /reports/bv/export").toBeGreaterThanOrEqual(2);
  });

  it("day_target view and export both resolve row-scope via the same resolveDayTargetScope() function", () => {
    const src = routeSource("reports-routes.ts");
    const occurrences = src.split("await resolveDayTargetScope(req)").length - 1;
    expect(occurrences, "resolveDayTargetScope should be called by both /reports/day-target and /reports/day-target/export").toBeGreaterThanOrEqual(2);
  });
});

describe("Action-role matrix: differentiated roles, not one reused set", () => {
  it("FINANCIAL_VIEW_ROLES, FINANCIAL_WRITE_ROLES, and FINANCIAL_VOID_ROLES are three distinct sets", async () => {
    const { FINANCIAL_VIEW_ROLES, FINANCIAL_WRITE_ROLES, FINANCIAL_VOID_ROLES } = await import("./middleware/financial-permission");
    expect(FINANCIAL_VIEW_ROLES).not.toEqual(FINANCIAL_WRITE_ROLES);
    expect(FINANCIAL_WRITE_ROLES).not.toEqual(FINANCIAL_VOID_ROLES);
    expect(FINANCIAL_VIEW_ROLES).not.toEqual(FINANCIAL_VOID_ROLES);
    // View is the superset (adds super_hod on top of write's admin+account_manager).
    expect(FINANCIAL_VIEW_ROLES).toEqual(expect.arrayContaining(FINANCIAL_WRITE_ROLES));
    // Void deliberately excludes account_manager (RBAC_ACTION_MATRIX.md: account_manager DENIED for Void).
    expect(FINANCIAL_VOID_ROLES).not.toEqual(expect.arrayContaining(["account_manager"]));
  });
});
