import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import { NOTICE_LEGACY_TO_DASHBOARD, NOTICE_SIDEBAR_PATHS } from "./notice-routes";

describe("notice-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of NOTICE_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(NOTICE_SIDEBAR_PATHS).size, NOTICE_SIDEBAR_PATHS.length);
  });
});
