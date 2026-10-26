import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PMS_LEGACY_TO_DASHBOARD, PMS_SIDEBAR_PATHS } from "./pms-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("pms-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of PMS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(PMS_SIDEBAR_PATHS).size, PMS_SIDEBAR_PATHS.length);
  });
});
