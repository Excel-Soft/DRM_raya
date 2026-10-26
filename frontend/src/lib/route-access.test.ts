import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRouteAccessAllowed } from "./route-access.ts";

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
