import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toLegacyGuardPath } from "@/lib/auth/guard-path";
import { isRouteAccessAllowed } from "@/lib/auth/route-access";
import {
  CUSTOMER_DUPLICATE_CHECKER,
  CUSTOMER_INVOICE_POOL,
  CUSTOMER_LEGACY_TO_DASHBOARD,
  CUSTOMER_PUBLIC_POOL,
  CUSTOMER_SIDEBAR_PATHS,
} from "./customer-routes";

describe("customer dashboard routes", () => {
  it("maps dashboard customer paths to legacy guard prefixes", () => {
    assert.equal(toLegacyGuardPath(CUSTOMER_DUPLICATE_CHECKER), "/sales/duplicate-checker");
    assert.equal(toLegacyGuardPath(CUSTOMER_PUBLIC_POOL), "/customers/public-pool");
    assert.equal(toLegacyGuardPath(CUSTOMER_INVOICE_POOL), "/sales/invoice-pool");
  });

  it("allows sales_executive on duplicate checker via /sales prefix", () => {
    assert.equal(isRouteAccessAllowed(CUSTOMER_DUPLICATE_CHECKER, "sales_executive", []), true);
  });

  it("legacy redirect inventory covers all sidebar items", () => {
    const dests = new Set(CUSTOMER_LEGACY_TO_DASHBOARD.map((r) => r.destination));
    for (const path of CUSTOMER_SIDEBAR_PATHS) {
      assert.ok(dests.has(path), `missing legacy redirect destination for ${path}`);
    }
  });
});
