import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeClass, THEME_STORAGE_KEY } from "./theme-storage";

describe("theme-storage", () => {
  it("resolveThemeClass maps light and dark preferences", () => {
    assert.equal(resolveThemeClass("light"), "light");
    assert.equal(resolveThemeClass("dark"), "dark");
  });

  it("exports stable storage key", () => {
    assert.equal(THEME_STORAGE_KEY, "drm-next-theme");
  });
});
