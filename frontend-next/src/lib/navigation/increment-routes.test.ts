import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INCREMENT_LEGACY_TO_DASHBOARD, INCREMENT_SIDEBAR_PATHS } from "./increment-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("increment-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of INCREMENT_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(INCREMENT_SIDEBAR_PATHS).size, INCREMENT_SIDEBAR_PATHS.length);
  });
});
