import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRouteAccessAllowed } from "@/lib/auth/route-access";
import { isNavLinkVisible } from "./navigation-visibility";
import {
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
} from "./dashboard-routes";

const noticeBoard = { id: "nb", label: "Notice Board", href: DASHBOARD_NOTICE_BOARD, permKey: "Notice Board" };
const policies = { id: "p", label: "DRM Policies", href: DASHBOARD_POLICIES, permKey: "DRM Policies" };
const audit = { id: "a", label: "Audit Logs", href: DASHBOARD_AUDIT_LOGS, permKey: "Admin" };
const training = { id: "t", label: "Training", href: DASHBOARD_TRAINING, permKey: "Training" };

describe("navigation role parity (dashboard paths)", () => {
  it("account_manager — page access for notice/policies; menu matches legacy DEPT (no Notice/Policies links)", () => {
    assert.equal(isRouteAccessAllowed(DASHBOARD_NOTICE_BOARD, "account_manager", []), true);
    assert.equal(isRouteAccessAllowed(DASHBOARD_POLICIES, "account_manager", []), true);
    assert.equal(isNavLinkVisible(noticeBoard, "account_manager", [], true), false);
    assert.equal(isNavLinkVisible(policies, "account_manager", [], true), false);
  });

  it("super_hod — route allows notice/policies/IP; menu hidden for legacy DEPT except audit", () => {
    assert.equal(isRouteAccessAllowed(DASHBOARD_NOTICE_BOARD, "super_hod", []), true);
    assert.equal(isRouteAccessAllowed(DASHBOARD_POLICIES, "super_hod", []), true);
    assert.equal(isRouteAccessAllowed(DASHBOARD_DRM_IP_LIST, "super_hod", []), true);
    assert.equal(isNavLinkVisible(noticeBoard, "super_hod", [], true), false);
    assert.equal(isNavLinkVisible(policies, "super_hod", [], true), false);
    assert.equal(isNavLinkVisible(audit, "super_hod", [], true), true);
  });

  it("sales_executive — training allowed; notice denied", () => {
    assert.equal(isRouteAccessAllowed(DASHBOARD_TRAINING, "sales_executive", []), true);
    assert.equal(isRouteAccessAllowed(DASHBOARD_NOTICE_BOARD, "sales_executive", []), false);
    assert.equal(isNavLinkVisible(training, "sales_executive", [], true), true);
  });
});
