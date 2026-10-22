/**
 * Copilot V1 — pure-unit tests for config/availability/allowlist logic. No DB,
 * no network, deterministic. Covers the brief's required coverage for:
 * mock-auth rejection, provider missing key, deny-all allowlist.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadCopilotConfig, getCopilotAvailability, isUserAllowed } from "../services/copilot/config";

const ENV_KEYS = [
  "COPILOT_ENABLED",
  "COPILOT_MODEL",
  "DRM_COPILOT_ANTHROPIC_API_KEY",
  "COPILOT_ALLOWED_USER_IDS",
  "COPILOT_ALLOW_FOLLOWUP_CREATE",
  "MOCK_AUTH",
  "JWT_SECRET",
  "NODE_ENV",
];
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("getCopilotAvailability", () => {
  it("reports not-configured when disabled (default)", () => {
    process.env.COPILOT_ENABLED = "false";
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    expect(availability.configured).toBe(false);
    expect(availability.reasons.join(" ")).toMatch(/disabled/i);
  });

  it("reports not-configured when enabled but model/key are missing", () => {
    process.env.COPILOT_ENABLED = "true";
    process.env.COPILOT_MODEL = "";
    process.env.DRM_COPILOT_ANTHROPIC_API_KEY = "";
    process.env.JWT_SECRET = "a".repeat(40);
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    expect(availability.configured).toBe(false);
    expect(availability.reasons.some((r) => /COPILOT_MODEL/.test(r))).toBe(true);
    expect(availability.reasons.some((r) => /DRM_COPILOT_ANTHROPIC_API_KEY/.test(r))).toBe(true);
  });

  it("refuses to be considered configured when MOCK_AUTH=true outside test env", () => {
    process.env.COPILOT_ENABLED = "true";
    process.env.COPILOT_MODEL = "claude-x";
    process.env.DRM_COPILOT_ANTHROPIC_API_KEY = "sk-test";
    process.env.JWT_SECRET = "a".repeat(40);
    process.env.MOCK_AUTH = "true";
    process.env.NODE_ENV = "development";
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    expect(availability.configured).toBe(false);
    expect(availability.reasons.some((r) => /MOCK_AUTH/.test(r))).toBe(true);
  });

  it("refuses a known-weak/default JWT secret", () => {
    process.env.COPILOT_ENABLED = "true";
    process.env.COPILOT_MODEL = "claude-x";
    process.env.DRM_COPILOT_ANTHROPIC_API_KEY = "sk-test";
    delete process.env.MOCK_AUTH;
    process.env.JWT_SECRET = "dev-secret-key-change-in-production";
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    expect(availability.configured).toBe(false);
    expect(availability.reasons.some((r) => /JWT_SECRET/.test(r))).toBe(true);
  });

  it("is configured once enabled, model+key set, and JWT_SECRET is strong", () => {
    process.env.COPILOT_ENABLED = "true";
    process.env.COPILOT_MODEL = "claude-x";
    process.env.DRM_COPILOT_ANTHROPIC_API_KEY = "sk-test";
    delete process.env.MOCK_AUTH;
    process.env.JWT_SECRET = "a".repeat(40);
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    expect(availability.configured).toBe(true);
    expect(availability.reasons).toEqual([]);
  });
});

describe("isUserAllowed", () => {
  it("denies everyone when the allowlist is empty (deny-all default)", () => {
    process.env.COPILOT_ALLOWED_USER_IDS = "";
    const cfg = loadCopilotConfig();
    expect(isUserAllowed(cfg, "11111111-1111-1111-1111-111111111111")).toBe(false);
  });

  it("allows only ids explicitly present in the allowlist", () => {
    process.env.COPILOT_ALLOWED_USER_IDS = "11111111-1111-1111-1111-111111111111, 22222222-2222-2222-2222-222222222222";
    const cfg = loadCopilotConfig();
    expect(isUserAllowed(cfg, "11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(isUserAllowed(cfg, "33333333-3333-3333-3333-333333333333")).toBe(false);
  });

  it("never grants access merely from a role label — allowlist is by user id only", () => {
    process.env.COPILOT_ALLOWED_USER_IDS = "11111111-1111-1111-1111-111111111111";
    const cfg = loadCopilotConfig();
    // "admin" is not a user id — must not be treated as a wildcard/role grant.
    expect(isUserAllowed(cfg, "admin")).toBe(false);
  });
});
