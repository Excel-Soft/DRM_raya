import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DRM_IP_LIST_ROUTE, isRouteAccessAllowed } from "./route-access";

describe("isRouteAccessAllowed — /admin/audit-logs", () => {
  const path = "/admin/audit-logs";

  for (const role of ["admin", "super_admin", "super_hod"] as const) {
    it(`allows ${role} for audit logs`, () => {
      assert.equal(isRouteAccessAllowed(path, role, []), true);
    });
  }

  for (const role of ["administrator", "service_manager", "junior_admin"] as const) {
    it(`denies ${role} for audit logs (stricter prefix than /admin)`, () => {
      assert.equal(isRouteAccessAllowed(path, role, []), false);
    });
  }

  it("allows super_hod on /admin dashboard but not conflated with audit deny case", () => {
    assert.equal(isRouteAccessAllowed("/admin", "super_hod", []), true);
    assert.equal(isRouteAccessAllowed(path, "super_hod", []), true);
  });

  it("allows service_manager on /admin but denies audit logs direct navigation", () => {
    assert.equal(isRouteAccessAllowed("/admin", "service_manager", []), true);
    assert.equal(isRouteAccessAllowed(path, "service_manager", []), false);
  });

  it("uses normalizeRole on active role (Administrator → administrator still denied)", () => {
    assert.equal(isRouteAccessAllowed(path, "Administrator", []), false);
  });

  it("allows when any assigned role matches audit viewer list", () => {
    assert.equal(isRouteAccessAllowed(path, "service_manager", ["super_admin"]), true);
  });
});

describe("isRouteAccessAllowed — /drm (DRM Setting)", () => {
  it("allows admin for /dashboard/drm/attributes", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/drm/attributes", "admin", []), true);
  });

  it("denies sales_executive for DRM routes", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/drm/permission", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — Daily reports (/daily-reports/*)", () => {
  it("allows admin for daily added GM path", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/daily-reports/added-gm", "admin", []), true);
  });

  it("denies sales_executive for daily reports", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/daily-reports/added-gm", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — Target system (/target-system/*)", () => {
  it("allows sales_manager for create path", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/target-system/create", "sales_manager", []), true);
  });

  it("denies sales_executive for target system", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/target-system/set", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — Events (/events/*)", () => {
  it("allows marketing_manager for add event path", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/events/add", "marketing_manager", []), true);
  });

  it("denies sales_executive for events", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/events/duty-planner", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — Social media (/social-media)", () => {
  it("allows marketing_manager for dashboard social media path", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/social-media", "marketing_manager", []), true);
  });

  it("denies sales_executive for social media", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/social-media", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — Users module (/drm/users/*)", () => {
  it("allows admin for canonical user list path", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/drm/users/list", "admin", []), true);
  });

  it("denies sales_executive for user management", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/drm/users/add", "sales_executive", []), false);
  });
});

describe("isRouteAccessAllowed — overlapping prefixes", () => {
  it("allows home path without matching restricted prefixes", () => {
    assert.equal(isRouteAccessAllowed("/", "sales_executive", []), true);
  });

  it("denies sales_executive on /reports when prefix requires other roles only", () => {
    assert.equal(isRouteAccessAllowed("/reports/salary", "intern", []), false);
  });

  it("allows account_manager on /notice-board", () => {
    assert.equal(isRouteAccessAllowed("/notice-board", "account_manager", []), true);
  });

  it("denies role without notice-board prefix access", () => {
    assert.equal(isRouteAccessAllowed("/notice-board", "developer", []), false);
  });
});

describe("isRouteAccessAllowed — /dashboard/training", () => {
  it("allows sales_executive via legacy /training guard", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/training", "sales_executive", []), true);
  });

  it("denies unlisted role", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/training", "guest", []), false);
  });
});

describe("isRouteAccessAllowed — /policies", () => {
  it("allows account_manager", () => {
    assert.equal(isRouteAccessAllowed("/policies", "account_manager", []), true);
  });

  it("denies sales_executive", () => {
    assert.equal(isRouteAccessAllowed("/policies", "sales_executive", []), false);
  });
});

describe(`isRouteAccessAllowed — ${DRM_IP_LIST_ROUTE}`, () => {
  const path = DRM_IP_LIST_ROUTE;

  for (const role of ["admin", "super_admin", "administrator", "super_hod"] as const) {
    it(`allows ${role} (registry ADMIN_ONLY)`, () => {
      assert.equal(isRouteAccessAllowed(path, role, []), true);
    });
  }

  for (const role of ["account_manager", "service_manager", "developer"] as const) {
    it(`denies ${role}`, () => {
      assert.equal(isRouteAccessAllowed(path, role, []), false);
    });
  }

  it("does not grant access via unrelated /admin prefix alone", () => {
    assert.equal(isRouteAccessAllowed("/admin", "service_manager", []), true);
    assert.equal(isRouteAccessAllowed(path, "service_manager", []), false);
  });

  it("allows when a secondary assigned role matches ADMIN_ONLY", () => {
    assert.equal(isRouteAccessAllowed(path, "developer", ["super_admin"]), true);
  });
});
