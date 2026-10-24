import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEXT_MIGRATED_PATHS } from "./migrated-routes";
import { PORTFOLIO_LEGACY_TO_DASHBOARD, PORTFOLIO_SIDEBAR_PATHS } from "./portfolio-routes";

describe("portfolio-routes", () => {
  it("legacy redirect destinations are migrated paths", () => {
    for (const { destination } of PORTFOLIO_LEGACY_TO_DASHBOARD) {
      assert.ok(NEXT_MIGRATED_PATHS.has(destination), destination);
    }
  });

  it("sidebar paths are unique", () => {
    assert.equal(new Set(PORTFOLIO_SIDEBAR_PATHS).size, PORTFOLIO_SIDEBAR_PATHS.length);
  });
});
