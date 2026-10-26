import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PENALTY_LEGACY_TO_DASHBOARD, PENALTY_SIDEBAR_PATHS } from "./penalty-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("penalty-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of PENALTY_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(PENALTY_SIDEBAR_PATHS).size, PENALTY_SIDEBAR_PATHS.length);
  });
});
