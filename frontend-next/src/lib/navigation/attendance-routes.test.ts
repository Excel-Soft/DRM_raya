import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import { ATTENDANCE_SIDEBAR_PATHS } from "./attendance-routes";

describe("attendance-routes", () => {
  it("sidebar paths are migrated in Next", () => {
    for (const path of ATTENDANCE_SIDEBAR_PATHS) {
      assert.ok(NEXT_MIGRATED_PATHS.has(path), path);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(ATTENDANCE_SIDEBAR_PATHS).size, ATTENDANCE_SIDEBAR_PATHS.length);
  });
});
