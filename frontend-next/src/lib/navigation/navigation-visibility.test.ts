import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNavLinkVisible, isNavPathActive } from "./navigation-visibility";
import {
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
} from "./dashboard-routes";
import { USERS_LIST } from "./users-routes";

describe("navigation-visibility", () => {
  it("admin sees notice board link", () => {
    const item = { id: "nb", label: "Notice Board", href: DASHBOARD_NOTICE_BOARD, permKey: "Notice Board" };
    assert.equal(isNavLinkVisible(item, "admin", [], true), true);
  });

  it("admin sees policies link", () => {
    const item = { id: "p", label: "DRM Policies", href: DASHBOARD_POLICIES, permKey: "DRM Policies" };
    assert.equal(isNavLinkVisible(item, "admin", [], true), true);
  });

  it("super_hod sees audit logs nav", () => {
    const item = { id: "a", label: "Audit Logs", href: DASHBOARD_AUDIT_LOGS, permKey: "Admin" };
    assert.equal(isNavLinkVisible(item, "super_hod", [], true), true);
  });

  it("admin sees Users sidebar list link", () => {
    const item = { id: "ul", label: "List", href: USERS_LIST, permKey: "Users" };
    assert.equal(isNavLinkVisible(item, "admin", [], true), true);
  });

  it("sales_executive does not see Users list link", () => {
    const item = { id: "ul", label: "List", href: USERS_LIST, permKey: "Users" };
    assert.equal(isNavLinkVisible(item, "sales_executive", [], true), false);
  });

  it("isNavPathActive matches nested paths", () => {
    assert.equal(isNavPathActive("/dashboard/policies/edit", DASHBOARD_POLICIES), true);
    assert.equal(isNavPathActive("/", DASHBOARD_NOTICE_BOARD), false);
    assert.equal(isNavPathActive("/dashboard", "/dashboard"), true);
    assert.equal(isNavPathActive("/dashboard/notice-board", "/dashboard"), false);
  });
});
