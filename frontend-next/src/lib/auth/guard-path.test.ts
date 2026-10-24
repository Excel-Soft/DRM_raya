import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toLegacyGuardPath } from "./guard-path";
import { isRouteAccessAllowed } from "./route-access";

describe("toLegacyGuardPath", () => {
  it("maps dashboard notice-board to legacy prefix", () => {
    assert.equal(toLegacyGuardPath("/dashboard/notice-board"), "/notice-board");
  });

  it("maps dashboard audit-logs to admin audit path", () => {
    assert.equal(toLegacyGuardPath("/dashboard/audit-logs"), "/admin/audit-logs");
  });

  it("maps dashboard training and allowed-ip to legacy prefixes", () => {
    assert.equal(toLegacyGuardPath("/dashboard/training"), "/training");
    assert.equal(toLegacyGuardPath("/dashboard/allowed-ip/drm-ip-list"), "/allowed-ip/drm-ip-list");
    assert.equal(toLegacyGuardPath("/dashboard/portfolio/add"), "/portfolio/add");
    assert.equal(toLegacyGuardPath("/dashboard/portfolio/view"), "/portfolio/view");
  });

  it("allows account_manager on dashboard notice-board", () => {
    assert.equal(isRouteAccessAllowed("/dashboard/notice-board", "account_manager", []), true);
  });
});
