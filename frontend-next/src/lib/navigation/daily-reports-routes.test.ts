import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DAILY_REPORTS_LEGACY_TO_DASHBOARD, DAILY_REPORTS_SIDEBAR_PATHS } from "./daily-reports-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("daily-reports-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of DAILY_REPORTS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(DAILY_REPORTS_SIDEBAR_PATHS).size, DAILY_REPORTS_SIDEBAR_PATHS.length);
  });
});
