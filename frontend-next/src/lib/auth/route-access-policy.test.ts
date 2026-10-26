import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AUDIT_LOG_VIEWER_ROLES, isAuditLogViewerRole } from "./route-access-policy";

describe("route-access-policy (Next Phase 2 spec)", () => {
  it("exports backend-aligned audit viewer roles", () => {
    assert.deepEqual([...AUDIT_LOG_VIEWER_ROLES], ["admin", "super_admin", "super_hod"]);
  });

  for (const role of ["admin", "super_admin", "super_hod"]) {
    it(`isAuditLogViewerRole(${role})`, () => {
      assert.equal(isAuditLogViewerRole(role), true);
    });
  }

  for (const role of ["administrator", "service_manager", "junior_admin"]) {
    it(`isAuditLogViewerRole(${role}) is false`, () => {
      assert.equal(isAuditLogViewerRole(role), false);
    });
  }
});
