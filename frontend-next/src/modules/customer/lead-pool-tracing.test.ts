import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GRADE_TRACE_TABS, poolApiParam, poolTitle } from "./lead-pool-tracing";

describe("lead-pool-tracing", () => {
  it("maps private/public API params and titles", () => {
    assert.equal(poolApiParam("private"), "private");
    assert.equal(poolApiParam("public"), "public");
    assert.match(poolTitle("private"), /Private/i);
    assert.match(poolTitle("public"), /Public/i);
    assert.ok(GRADE_TRACE_TABS.includes("A"));
  });
});
