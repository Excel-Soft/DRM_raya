import { describe, it, expect } from "vitest";
import { validateSecrets, MIN_SECRET_LENGTH } from "./config/validate-secrets";

// A high-entropy-looking value that is long enough and not in the weak/placeholder
// blacklist. Used wherever a "good" secret is required.
const STRONG = "Zx9" + "q".repeat(MIN_SECRET_LENGTH + 4);

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

describe("validateSecrets — production (must fail closed)", () => {
  it("fails when JWT_SECRET is missing", () => {
    const r = validateSecrets(env({ NODE_ENV: "production" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
  });

  it("fails on a known weak/placeholder JWT_SECRET", () => {
    const r = validateSecrets(env({ NODE_ENV: "production", JWT_SECRET: "changeme" }));
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("fails on a too-short JWT_SECRET", () => {
    const r = validateSecrets(env({ NODE_ENV: "production", JWT_SECRET: "short-secret" }));
    expect(r.ok).toBe(false);
  });

  it("fails when MOCK_AUTH=true even with a strong JWT_SECRET", () => {
    const r = validateSecrets(
      env({ NODE_ENV: "production", JWT_SECRET: STRONG, MOCK_AUTH: "true" }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("MOCK_AUTH"))).toBe(true);
  });

  it("fails on a weak SESSION_SECRET even when JWT_SECRET is strong", () => {
    const r = validateSecrets(
      env({ NODE_ENV: "production", JWT_SECRET: STRONG, SESSION_SECRET: "password" }),
    );
    expect(r.ok).toBe(false);
  });

  it("passes with a strong JWT_SECRET and no MOCK_AUTH", () => {
    const r = validateSecrets(env({ NODE_ENV: "production", JWT_SECRET: STRONG }));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe("validateSecrets — non-production (warn, do not block boot)", () => {
  it("warns but does not fail when JWT_SECRET is missing", () => {
    const r = validateSecrets(env({ NODE_ENV: "development" }));
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("does not fail when MOCK_AUTH=true in development", () => {
    const r = validateSecrets(env({ NODE_ENV: "development", MOCK_AUTH: "true" }));
    expect(r.ok).toBe(true);
  });
});
