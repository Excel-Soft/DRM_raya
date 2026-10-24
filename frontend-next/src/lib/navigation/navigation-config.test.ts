import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { APP_NAV_GROUPS, collectNavIds, findNavTitle } from "./navigation-config";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import {
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
} from "./dashboard-routes";
import { CUSTOMER_SIDEBAR_PATHS } from "./customer-routes";

describe("navigation-config", () => {
  it("has unique nav ids", () => {
    const ids = collectNavIds();
    assert.equal(ids.length, new Set(ids).size);
  });

  it("includes migrated pilot routes in inventory", () => {
    const hrefs = new Set<string>();
    for (const g of APP_NAV_GROUPS) {
      if (g.href) hrefs.add(g.href);
      g.children?.forEach((c) => hrefs.add(c.href));
    }
    for (const path of [
      DASHBOARD_NOTICE_BOARD,
      DASHBOARD_POLICIES,
      DASHBOARD_AUDIT_LOGS,
      DASHBOARD_DRM_IP_LIST,
      DASHBOARD_TRAINING,
      ...CUSTOMER_SIDEBAR_PATHS,
    ]) {
      assert.ok(hrefs.has(path), `missing ${path}`);
    }
  });

  it("marks known Next routes in migrated set", () => {
    assert.ok(NEXT_MIGRATED_PATHS.has(DASHBOARD_POLICIES));
    assert.ok(NEXT_MIGRATED_PATHS.has(DASHBOARD_NOTICE_BOARD));
    assert.ok(NEXT_MIGRATED_PATHS.has(DASHBOARD_TRAINING));
  });

  it("findNavTitle resolves policies and home", () => {
    assert.equal(findNavTitle(DASHBOARD_POLICIES), "DRM Policies");
    assert.equal(findNavTitle("/dashboard"), "Dashboard");
    assert.equal(findNavTitle("/dashboard/training"), "Training");
    assert.equal(findNavTitle("/dashboard/portfolio/view"), "View Portfolio");
  });
});
