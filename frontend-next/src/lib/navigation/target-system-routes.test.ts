import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TARGET_SYSTEM_LEGACY_TO_DASHBOARD, TARGET_SYSTEM_SIDEBAR_PATHS } from "./target-system-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("target-system-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of TARGET_SYSTEM_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(TARGET_SYSTEM_SIDEBAR_PATHS).size, TARGET_SYSTEM_SIDEBAR_PATHS.length);
  });
});
