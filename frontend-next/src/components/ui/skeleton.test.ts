import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("skeleton exports", () => {
  it("module can import skeleton components", async () => {
    const mod = await import("./skeleton");
    assert.equal(typeof mod.Skeleton, "function");
    assert.equal(typeof mod.TableSkeleton, "function");
    assert.equal(typeof mod.ModulePageSkeleton, "function");
  });
});
