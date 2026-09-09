import { describe, it, expect, vi } from "vitest";

/**
 * P02-002 resolution (2026-07-20): `report-permission.ts`'s `project_report`/
 * `link_report` matrix entries previously listed a narrower, hand-picked role
 * set than the ACTUAL enforcement in `project-report-routes.ts`'s
 * `canViewProjectReport` and `team-report-link-report-routes.ts`'s
 * `canVerify` (both effectively `isManagerialRole()`). The matrix now derives
 * from `MANAGERIAL_ROLES` (role-utils.ts) — the same shared source those two
 * functions already use — so this file proves they agree, not just that they
 * currently happen to.
 *
 * `report-permission.ts` reaches `server/db.ts` transitively (via
 * `requireActionPermission` -> `AuditLogService` -> `activity-service.ts`),
 * so the database module is mocked before any import, per the established
 * project convention (see `phase2-rbac.test.ts`).
 */
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

const { resolveReportRoles } = await import("./middleware/report-permission");
const { MANAGERIAL_ROLES, isManagerialRole, normalizeRole } = await import("./utils/role-utils");
const { canViewProjectReport } = await import("./project-report-routes");
const { canVerify } = await import("./team-report-link-report-routes");

const COMPREHENSIVE_ROLE_SAMPLE = [
  "admin",
  "super_admin",
  "super_hod",
  "hod",
  "account_manager",
  "sales_manager",
  "sales_assistant_manager",
  "sales_executive",
  "service_manager",
  "service_assistant_manager",
  "service_executive",
  "qa_manager",
  "verification_manager",
  "product_posting_manager",
  "product_posting_executive",
  "dd_manager",
  "dd_executive",
  "it_manager",
  "reception_manager",
  "seo_smm_manager",
  "software_manager",
  "software_executive",
  "lead_manager",
  "lead_executive",
  "marketing_manager",
  "developer",
  "posting_executive",
];

describe("P02-002 — project_report / link_report matrix reconciliation", () => {
  it("resolveReportRoles('project_report','view') exactly equals MANAGERIAL_ROLES (normalized)", () => {
    const resolved = new Set(resolveReportRoles("project_report", "view"));
    const expected = new Set(MANAGERIAL_ROLES.map((r) => normalizeRole(r)));
    expect(resolved).toEqual(expected);
  });

  it("resolveReportRoles('link_report','view') exactly equals MANAGERIAL_ROLES (normalized)", () => {
    const resolved = new Set(resolveReportRoles("link_report", "view"));
    const expected = new Set(MANAGERIAL_ROLES.map((r) => normalizeRole(r)));
    expect(resolved).toEqual(expected);
  });

  it("view and export resolve identically for both report types (one authoritative policy, not two)", () => {
    expect(resolveReportRoles("project_report", "view")).toEqual(resolveReportRoles("project_report", "export"));
    expect(resolveReportRoles("link_report", "view")).toEqual(resolveReportRoles("link_report", "export"));
  });

  it.each(COMPREHENSIVE_ROLE_SAMPLE)(
    "resolveReportRoles('project_report') agrees with the ACTUAL route gate canViewProjectReport() for role=%s",
    (role) => {
      const matrixAllows = resolveReportRoles("project_report", "view").includes(normalizeRole(role));
      const routeAllows = canViewProjectReport(role);
      expect(matrixAllows).toBe(routeAllows);
    },
  );

  it.each(COMPREHENSIVE_ROLE_SAMPLE)(
    "resolveReportRoles('link_report') agrees with the ACTUAL route gate canVerify() for role=%s",
    (role) => {
      const matrixAllows = resolveReportRoles("link_report", "view").includes(normalizeRole(role));
      const routeAllows = canVerify(role);
      expect(matrixAllows).toBe(routeAllows);
    },
  );
});

describe("P02-002 — account_manager regression (found while writing these tests)", () => {
  it("account_manager is explicitly in MANAGERIAL_ROLES, not just passing isManagerialRole via the substring fallback", () => {
    expect(MANAGERIAL_ROLES).toContain("account_manager");
  });

  it("account_manager is allowed by both project_report and link_report", () => {
    expect(resolveReportRoles("project_report", "view").includes("account_manager")).toBe(true);
    expect(canViewProjectReport("account_manager")).toBe(true);
    expect(resolveReportRoles("link_report", "view").includes("account_manager")).toBe(true);
    expect(canVerify("account_manager")).toBe(true);
  });
});

describe("P02-002 — allowed-role tests", () => {
  it.each(["admin", "super_hod", "hod", "sales_manager", "qa_manager", "product_posting_manager", "software_manager", "it_manager"])(
    "project_report allows managerial role=%s",
    (role) => {
      expect(resolveReportRoles("project_report", "view").includes(normalizeRole(role))).toBe(true);
      expect(canViewProjectReport(role)).toBe(true);
    },
  );

  it.each(["admin", "super_hod", "hod", "sales_manager", "qa_manager", "dd_manager", "reception_manager"])(
    "link_report allows managerial role=%s",
    (role) => {
      expect(resolveReportRoles("link_report", "view").includes(normalizeRole(role))).toBe(true);
      expect(canVerify(role)).toBe(true);
    },
  );
});

describe("P02-002 — denied-role tests", () => {
  it.each(["sales_executive", "service_executive", "dd_executive", "software_executive", "lead_executive", "product_posting_executive"])(
    "project_report denies individual-contributor role=%s",
    (role) => {
      expect(resolveReportRoles("project_report", "view").includes(normalizeRole(role))).toBe(false);
      expect(canViewProjectReport(role)).toBe(false);
    },
  );

  it.each(["sales_executive", "service_executive", "dd_executive", "software_executive"])(
    "link_report denies individual-contributor role=%s",
    (role) => {
      expect(resolveReportRoles("link_report", "view").includes(normalizeRole(role))).toBe(false);
      expect(canVerify(role)).toBe(false);
    },
  );
});
