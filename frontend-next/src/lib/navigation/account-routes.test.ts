import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_LEGACY_TO_DASHBOARD,
  ACCOUNT_SIDEBAR_PATHS,
  accountHistoryPath,
} from "./account-routes";

describe("account-routes", () => {
  it("defines eight sidebar paths under /dashboard/account", () => {
    assert.equal(ACCOUNT_SIDEBAR_PATHS.length, 8);
    for (const p of ACCOUNT_SIDEBAR_PATHS) {
      assert.ok(p.startsWith("/dashboard/account/"));
    }
  });

  it("maps legacy account URLs to dashboard", () => {
    const map = new Map(ACCOUNT_LEGACY_TO_DASHBOARD.map((r) => [r.source, r.destination]));
    assert.equal(map.get("/account/gm-entries"), "/dashboard/account/gm-entries");
    assert.equal(map.get("/account/dollar-buying"), "/dashboard/account/dollar-buying");
  });

  it("builds encoded history paths", () => {
    assert.equal(accountHistoryPath("Acme Co"), "/dashboard/account/history/Acme%20Co");
  });
});
