import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DRM_LEGACY_TO_DASHBOARD, DRM_SETTING_SIDEBAR_PATHS } from "./drm-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("drm-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of DRM_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(DRM_SETTING_SIDEBAR_PATHS).size, DRM_SETTING_SIDEBAR_PATHS.length);
  });
});
