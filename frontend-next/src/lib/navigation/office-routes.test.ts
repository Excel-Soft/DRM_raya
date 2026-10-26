import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFICE_LEGACY_TO_DASHBOARD, OFFICE_SIDEBAR_PATHS } from "./office-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("office-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of OFFICE_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(OFFICE_SIDEBAR_PATHS).size, OFFICE_SIDEBAR_PATHS.length);
  });
});
