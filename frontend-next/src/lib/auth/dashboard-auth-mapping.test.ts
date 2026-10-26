import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toLegacyGuardPath } from "./guard-path";
import { isRouteAccessAllowed, DRM_IP_LIST_ROUTE } from "./route-access";
import {
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_HOME,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
} from "@/lib/navigation/dashboard-routes";

const CANONICAL_TO_LEGACY: [string, string][] = [
  [DASHBOARD_HOME, "/"],
  [DASHBOARD_NOTICE_BOARD, "/notice-board"],
  [DASHBOARD_POLICIES, "/policies"],
  [DASHBOARD_TRAINING, "/training"],
  [DASHBOARD_AUDIT_LOGS, "/admin/audit-logs"],
  [DASHBOARD_DRM_IP_LIST, "/allowed-ip/drm-ip-list"],
];

describe("dashboard AuthGate path → legacy ROUTE_PERMISSIONS key", () => {
  for (const [canonical, legacy] of CANONICAL_TO_LEGACY) {
    it(`maps ${canonical} → ${legacy}`, () => {
      assert.equal(toLegacyGuardPath(canonical), legacy);
      assert.equal(toLegacyGuardPath(`${canonical}?tab=1`), legacy);
    });
  }

  it("DRM IP list uses /allowed-ip/drm-ip-list auth key (not dashboard prefix)", () => {
    assert.equal(toLegacyGuardPath(DRM_IP_LIST_ROUTE), "/allowed-ip/drm-ip-list");
    assert.equal(isRouteAccessAllowed(DRM_IP_LIST_ROUTE, "admin", []), true);
    assert.equal(isRouteAccessAllowed(DRM_IP_LIST_ROUTE, "account_manager", []), false);
  });

  it("dashboard home does not inherit restricted prefixes", () => {
    assert.equal(isRouteAccessAllowed(DASHBOARD_HOME, "sales_executive", []), true);
  });
});
