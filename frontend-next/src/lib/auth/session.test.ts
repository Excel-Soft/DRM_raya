import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAuthHeaders, getStoredToken } from "./session";

describe("session (SSR / no window)", () => {
  it("getStoredToken returns null without sessionStorage", () => {
    assert.equal(getStoredToken(), null);
  });

  it("getAuthHeaders returns empty object without sessionStorage", () => {
    assert.deepEqual(getAuthHeaders(), {});
  });
});
