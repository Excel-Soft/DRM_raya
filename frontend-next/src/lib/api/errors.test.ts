import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  extractApiErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from "./errors";

describe("extractApiErrorMessage", () => {
  it("reads Stage 10 error envelope", () => {
    assert.equal(
      extractApiErrorMessage({ error: { message: "Invalid credentials" } }, 401),
      "Invalid credentials",
    );
  });

  it("reads legacy string error", () => {
    assert.equal(extractApiErrorMessage({ error: "Not authenticated" }, 401), "Not authenticated");
  });

  it("falls back for empty body", () => {
    assert.equal(extractApiErrorMessage(null, 502), "Request failed (502)");
  });
});

describe("ApiError helpers", () => {
  it("isUnauthorizedError", () => {
    assert.equal(isUnauthorizedError(new ApiError("x", 401)), true);
    assert.equal(isUnauthorizedError(new ApiError("x", 403)), false);
  });

  it("isForbiddenError", () => {
    assert.equal(isForbiddenError(new ApiError("x", 403)), true);
  });
});
