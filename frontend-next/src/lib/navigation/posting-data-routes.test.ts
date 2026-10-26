import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POSTING_DATA_LEGACY_TO_DASHBOARD, POSTING_DATA_SIDEBAR_PATHS } from "./posting-data-routes";

describe("posting-data-routes", () => {
  it("defines seven sidebar paths under /dashboard/posting-data", () => {
    assert.equal(POSTING_DATA_SIDEBAR_PATHS.length, 7);
    for (const p of POSTING_DATA_SIDEBAR_PATHS) {
      assert.ok(p.startsWith("/dashboard/posting-data/"));
    }
  });

  it("maps legacy posting-data URLs to dashboard", () => {
    const map = new Map(POSTING_DATA_LEGACY_TO_DASHBOARD.map((r) => [r.source, r.destination]));
    assert.equal(map.get("/posting-data/view-keywords"), "/dashboard/posting-data/view-keywords");
    assert.equal(map.get("/team-report/link-report"), "/dashboard/posting-data/link-report");
  });
});
