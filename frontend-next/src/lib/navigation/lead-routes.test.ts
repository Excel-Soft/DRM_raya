import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import { LEAD_LEGACY_TO_DASHBOARD, LEAD_SIDEBAR_PATHS } from "./lead-routes";

describe("lead-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of LEAD_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(LEAD_SIDEBAR_PATHS).size, LEAD_SIDEBAR_PATHS.length);
  });
});
