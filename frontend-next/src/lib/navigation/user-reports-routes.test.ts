import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import { USER_REPORTS_LEGACY_TO_DASHBOARD, USER_REPORTS_SIDEBAR_PATHS } from "./user-reports-routes";

describe("user-reports-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of USER_REPORTS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(USER_REPORTS_SIDEBAR_PATHS).size, USER_REPORTS_SIDEBAR_PATHS.length);
  });
});
