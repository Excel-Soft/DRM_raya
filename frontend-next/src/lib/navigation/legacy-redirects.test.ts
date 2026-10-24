import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_TO_DASHBOARD_REDIRECTS } from "./legacy-redirects";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";

describe("legacy → dashboard redirects", () => {
  it("every destination is a migrated dashboard path (no redirect loops)", () => {
    const migrated = NEXT_MIGRATED_PATHS;
    for (const { source, destination } of LEGACY_TO_DASHBOARD_REDIRECTS) {
      assert.notEqual(source, destination, `loop: ${source}`);
      const destBase = destination.replace(/\/:[^/]+$/, "");
      assert.ok(
        migrated.has(destination) || migrated.has(destBase),
        `${destination} not in migrated set`,
      );
      assert.ok(!migrated.has(source), `legacy ${source} should not be canonical migrated href`);
    }
  });

  it("covers Phase 13 legacy bookmarks", () => {
    const sources = new Set(LEGACY_TO_DASHBOARD_REDIRECTS.map((r) => r.source));
    for (const path of [
      "/notice-board",
      "/policies",
      "/training",
      "/admin/audit-logs",
      "/allowed-ip/drm-ip-list",
    ]) {
      assert.ok(sources.has(path), `missing redirect for ${path}`);
    }
  });
});
