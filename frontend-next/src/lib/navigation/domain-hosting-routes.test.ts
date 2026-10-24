import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_HOSTING_LEGACY_TO_DASHBOARD, DOMAIN_HOSTING_SIDEBAR_PATHS } from "./domain-hosting-routes";

describe("domain-hosting-routes", () => {
  it("defines three sidebar paths under /dashboard/it", () => {
    assert.equal(DOMAIN_HOSTING_SIDEBAR_PATHS.length, 3);
    for (const p of DOMAIN_HOSTING_SIDEBAR_PATHS) {
      assert.ok(p.startsWith("/dashboard/it/"));
    }
  });

  it("maps legacy /it URLs to dashboard", () => {
    const map = new Map(DOMAIN_HOSTING_LEGACY_TO_DASHBOARD.map((r) => [r.source, r.destination]));
    assert.equal(map.get("/it/servers"), "/dashboard/it/servers");
    assert.equal(map.get("/it/backup"), "/dashboard/it/backup");
  });
});
