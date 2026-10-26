import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPublicPath } from "./constants";

describe("isPublicPath", () => {
  it("allows /auth", () => {
    assert.equal(isPublicPath("/auth"), true);
  });

  it("denies protected app paths", () => {
    assert.equal(isPublicPath("/"), false);
    assert.equal(isPublicPath("/notice-board"), false);
    assert.equal(isPublicPath("/admin/audit-logs"), false);
  });

  it("allows /api-health without auth gate (not in PUBLIC_PATHS — documented gap)", () => {
    assert.equal(isPublicPath("/api-health"), false);
  });
});
