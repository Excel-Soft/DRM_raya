import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REPORTS_LEGACY_TO_DASHBOARD, REPORTS_SIDEBAR_PATHS } from "./reports-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("reports-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of REPORTS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(REPORTS_SIDEBAR_PATHS).size, REPORTS_SIDEBAR_PATHS.length);
  });
});
