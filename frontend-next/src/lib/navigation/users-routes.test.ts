import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { USERS_LEGACY_TO_DASHBOARD, USERS_SIDEBAR_PATHS } from "./users-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("users-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of USERS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(USERS_SIDEBAR_PATHS).size, USERS_SIDEBAR_PATHS.length);
  });
});
