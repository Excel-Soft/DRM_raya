import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVENTS_LEGACY_TO_DASHBOARD, EVENTS_SIDEBAR_PATHS } from "./events-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("events-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of EVENTS_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(EVENTS_SIDEBAR_PATHS).size, EVENTS_SIDEBAR_PATHS.length);
  });
});
