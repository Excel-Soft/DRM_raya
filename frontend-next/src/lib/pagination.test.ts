import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampPage, paginationSummary, totalPagesFromCount } from "./pagination";

describe("pagination helpers", () => {
  it("clampPage bounds page to valid range", () => {
    assert.equal(clampPage(0, 5), 1);
    assert.equal(clampPage(3, 5), 3);
    assert.equal(clampPage(9, 5), 5);
    assert.equal(clampPage(2, 0), 1);
  });

  it("totalPagesFromCount computes pages from total and pageSize", () => {
    assert.equal(totalPagesFromCount(0, 50), 1);
    assert.equal(totalPagesFromCount(50, 50), 1);
    assert.equal(totalPagesFromCount(51, 50), 2);
  });

  it("paginationSummary formats range text", () => {
    assert.equal(paginationSummary(1, 50, 0), "No results");
    assert.equal(paginationSummary(1, 50, 120), "1–50 of 120");
    assert.equal(paginationSummary(3, 50, 120), "101–120 of 120");
  });
});
