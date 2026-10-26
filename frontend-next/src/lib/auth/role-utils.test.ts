import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isManagerialRole, userCanManagePolicies } from "./role-utils";

describe("isManagerialRole", () => {
  it("returns true for admin and account_manager", () => {
    assert.equal(isManagerialRole("admin"), true);
    assert.equal(isManagerialRole("account_manager"), true);
  });

  it("returns false for sales_executive", () => {
    assert.equal(isManagerialRole("sales_executive"), false);
  });
});

describe("userCanManagePolicies", () => {
  it("uses assigned roles when active role is non-managerial", () => {
    assert.equal(userCanManagePolicies("sales_executive", ["account_manager"]), true);
  });
});
