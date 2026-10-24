import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_MEDIA_LEGACY_TO_DASHBOARD, SOCIAL_MEDIA_SIDEBAR_PATHS } from "./social-media-routes";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("social-media-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of SOCIAL_MEDIA_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(SOCIAL_MEDIA_SIDEBAR_PATHS).size, SOCIAL_MEDIA_SIDEBAR_PATHS.length);
  });
});
