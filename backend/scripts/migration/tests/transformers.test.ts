import { describe, it, expect } from "vitest";
import { transformLegacyDateTime, transformLegacyDate } from "../transformers/dates.js";
import { transformTinyIntBoolean } from "../transformers/booleans.js";
import { transformDecimalString } from "../transformers/decimals.js";

describe("transformLegacyDateTime", () => {
  it("maps zero datetime to null with raw preserved", () => {
    const r = transformLegacyDateTime("0000-00-00 00:00:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it("parses UTC-leaning datetime strings", () => {
    const r = transformLegacyDateTime("2024-01-15 10:30:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeInstanceOf(Date);
  });
});

describe("transformLegacyDate", () => {
  it("handles zero date", () => {
    const r = transformLegacyDate("0000-00-00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });
});

describe("transformTinyIntBoolean", () => {
  it("converts 0/1", () => {
    expect(transformTinyIntBoolean("1")).toBe(true);
    expect(transformTinyIntBoolean("0")).toBe(false);
    expect(transformTinyIntBoolean(null)).toBeNull();
  });
});

describe("transformDecimalString", () => {
  it("preserves precision as string", () => {
    const r = transformDecimalString("12345.6789");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("12345.6789");
  });

  it("rejects non-numeric without throwing", () => {
    const r = transformDecimalString("12abc");
    expect(r.ok).toBe(false);
  });
});
