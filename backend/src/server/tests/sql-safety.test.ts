import { describe, it, expect } from "vitest";
import {
  isUuid,
  assertUuidList,
  quotedUuidList,
  safePage,
  safePageSize,
  safeOffset,
  makeOrderBy,
} from "../utils/sql-safety";
import { ApiError } from "../utils/api-error";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

// A grab-bag of malicious / malformed identifier inputs an attacker might try to
// smuggle into a raw SQL id list.
const MALICIOUS_IDS = [
  "1; DROP TABLE users;--",
  "' OR '1'='1",
  `${UUID_A}','${UUID_B}') OR 1=1--`,
  "not-a-uuid",
  "",
  "00000000-0000-0000-0000-00000000000g", // invalid hex char
  123,
  null,
  undefined,
  {},
];

describe("isUuid", () => {
  it("accepts well-formed UUIDs", () => {
    expect(isUuid(UUID_A)).toBe(true);
    expect(isUuid(UUID_B)).toBe(true);
  });

  it("rejects non-UUID strings and non-strings", () => {
    for (const bad of MALICIOUS_IDS) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("assertUuidList", () => {
  it("returns the same UUIDs when all are valid", () => {
    expect(assertUuidList([UUID_A, UUID_B])).toEqual([UUID_A, UUID_B]);
  });

  it("accepts an empty list", () => {
    expect(assertUuidList([])).toEqual([]);
  });

  it("throws a 400 ApiError on the first non-UUID (SQL injection blocked)", () => {
    for (const bad of MALICIOUS_IDS) {
      let thrown: unknown;
      try {
        assertUuidList([UUID_A, bad]);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).status).toBe(400);
    }
  });

  it("never embeds the received value in the error message", () => {
    try {
      assertUuidList(["'; DROP TABLE users;--"]);
    } catch (e) {
      expect((e as ApiError).message).not.toContain("DROP TABLE");
    }
  });
});

describe("quotedUuidList", () => {
  it("builds a comma-separated single-quoted list for valid UUIDs", () => {
    expect(quotedUuidList([UUID_A, UUID_B])).toBe(`'${UUID_A}','${UUID_B}'`);
  });

  it("produces output that contains no unescaped SQL metacharacters", () => {
    const out = quotedUuidList([UUID_A]);
    // Only the wrapping quotes + UUID chars + comma may appear.
    expect(out).toMatch(/^'[0-9a-f-]+'$/i);
  });

  it("throws rather than emitting an injected fragment", () => {
    expect(() => quotedUuidList([`${UUID_A}') OR 1=1--`])).toThrow(ApiError);
  });
});

describe("safePage", () => {
  it("returns valid 1-based pages unchanged", () => {
    expect(safePage(1)).toBe(1);
    expect(safePage("5")).toBe(5);
  });

  it("falls back for malicious / invalid input", () => {
    expect(safePage("0")).toBe(1);
    expect(safePage(-3)).toBe(1);
    expect(safePage("1; DROP TABLE")).toBe(1);
    expect(safePage(1.5)).toBe(1);
    expect(safePage(undefined)).toBe(1);
    expect(safePage(NaN)).toBe(1);
    expect(safePage("abc", 2)).toBe(2);
  });
});

describe("safePageSize", () => {
  it("returns valid sizes unchanged", () => {
    expect(safePageSize(25)).toBe(25);
    expect(safePageSize("50")).toBe(50);
  });

  it("clamps to the maximum", () => {
    expect(safePageSize(100000)).toBe(200);
    expect(safePageSize(10000, 25, 500)).toBe(500);
  });

  it("falls back for malicious / invalid input", () => {
    expect(safePageSize("0")).toBe(25);
    expect(safePageSize(-1)).toBe(25);
    expect(safePageSize("999999 UNION SELECT")).toBe(25);
    expect(safePageSize(undefined, 10)).toBe(10);
  });
});

describe("safeOffset", () => {
  it("computes a non-negative offset from page/pageSize", () => {
    expect(safeOffset(1, 25)).toBe(0);
    expect(safeOffset(3, 20)).toBe(40);
  });

  it("never returns a negative offset", () => {
    expect(safeOffset(0, 25)).toBe(0);
    expect(safeOffset(-5, 25)).toBe(0);
  });
});

describe("makeOrderBy", () => {
  const allowed = {
    createdAt: "c.created_at",
    name: "c.name",
  };

  it("maps a whitelisted sort key to its real column", () => {
    expect(makeOrderBy("name", "asc", allowed, "createdAt")).toEqual({
      column: "c.name",
      direction: "ASC",
    });
  });

  it("falls back to the default key for unknown / malicious sort keys", () => {
    expect(makeOrderBy("name; DROP TABLE", "desc", allowed, "createdAt")).toEqual({
      column: "c.created_at",
      direction: "DESC",
    });
    expect(makeOrderBy("(SELECT 1)", "desc", allowed, "createdAt").column).toBe(
      "c.created_at",
    );
    expect(makeOrderBy(undefined, undefined, allowed, "createdAt").column).toBe(
      "c.created_at",
    );
  });

  it("only ever emits ASC or DESC, never injected direction", () => {
    expect(makeOrderBy("name", "ASC; DROP TABLE", allowed, "createdAt").direction).toBe("DESC");
    expect(makeOrderBy("name", "asc", allowed, "createdAt").direction).toBe("ASC");
    expect(makeOrderBy("name", "DeSc", allowed, "createdAt").direction).toBe("DESC");
  });

  it("does not let prototype keys leak through as columns", () => {
    expect(makeOrderBy("toString", "asc", allowed, "createdAt").column).toBe(
      "c.created_at",
    );
    expect(makeOrderBy("__proto__", "asc", allowed, "createdAt").column).toBe(
      "c.created_at",
    );
  });
});
