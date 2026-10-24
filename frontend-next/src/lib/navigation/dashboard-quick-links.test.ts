import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DASHBOARD_QUICK_LINKS, quickLinkMigrationPath } from "./dashboard-quick-links";
import { isNextMigratedPath } from "./migrated-routes";

describe("dashboard quick links", () => {
  it("migrated link hrefs are registered in NEXT_MIGRATED_PATHS", () => {
    for (const entry of DASHBOARD_QUICK_LINKS) {
      if (entry.kind !== "link") continue;
      const path = quickLinkMigrationPath(entry.href);
      assert.ok(isNextMigratedPath(path), `expected migrated: ${path}`);
    }
  });
});
