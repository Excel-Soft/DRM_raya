import { describe, it, expect } from "vitest";
import {
  BUSINESS_RULES_CONFIG_DEFAULTS,
  businessRulesConfigSchema,
  abForceCloseApprovedSchema,
  walletNegativeBalanceApprovedSchema,
  decisionMetaSchema,
  roleNameSchema,
  allowedRolesSchema,
} from "./business-rules-config";

/**
 * Proves shared/business-rules-config.ts (and its shared/roles.ts,
 * shared/validators.ts dependencies) work standalone, with zero import from
 * server/ or client/. This file itself imports nothing outside shared/ —
 * that absence of a "../server/..." or "../client/..." import IS the proof,
 * not just an assertion about it.
 */

describe("shared/business-rules-config — standalone (no server import)", () => {
  it("defaults parse successfully", () => {
    expect(businessRulesConfigSchema.safeParse(BUSINESS_RULES_CONFIG_DEFAULTS).success).toBe(true);
  });

  it("roleNameSchema accepts a real role and rejects a made-up one", () => {
    expect(roleNameSchema.safeParse("admin").success).toBe(true);
    expect(roleNameSchema.safeParse("not_a_real_role").success).toBe(false);
  });

  it("allowedRolesSchema requires at least one role and rejects duplicates", () => {
    expect(allowedRolesSchema.safeParse([]).success).toBe(false);
    expect(allowedRolesSchema.safeParse(["admin", "admin"]).success).toBe(false);
    expect(allowedRolesSchema.safeParse(["admin", "super_hod"]).success).toBe(true);
  });

  it("decisionMetaSchema rejects an invalid decidedAt and accepts a valid one", () => {
    expect(
      decisionMetaSchema.safeParse({
        decidedBy: "Test Project Owner",
        decidedAt: "not-a-real-date",
        decisionRef: "DECISION_LOG.md D-TEST",
      }).success,
    ).toBe(false);
    expect(
      decisionMetaSchema.safeParse({
        decidedBy: "Test Project Owner",
        decidedAt: "2026-07-17",
        decisionRef: "DECISION_LOG.md D-TEST",
      }).success,
    ).toBe(true);
  });

  it("rejects a contradictory wallet policy (allowNegative:false with a non-null overdraftLimitUsd)", () => {
    expect(
      walletNegativeBalanceApprovedSchema.safeParse({
        status: "APPROVED",
        allowNegative: false,
        overdraftLimitUsd: 500,
        decidedBy: "Test Project Owner",
        decidedAt: "2026-07-17",
        decisionRef: "DECISION_LOG.md D-TEST",
      }).success,
    ).toBe(false);
  });

  it("accepts a consistent wallet policy", () => {
    expect(
      walletNegativeBalanceApprovedSchema.safeParse({
        status: "APPROVED",
        allowNegative: false,
        overdraftLimitUsd: null,
        decidedBy: "Test Project Owner",
        decidedAt: "2026-07-17",
        decisionRef: "DECISION_LOG.md D-TEST",
      }).success,
    ).toBe(true);
  });

  it("abForceCloseApprovedSchema rejects an invalid role and an empty role list", () => {
    const base = {
      status: "APPROVED" as const,
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    };
    expect(abForceCloseApprovedSchema.safeParse({ ...base, allowedRoles: ["fake_role"] }).success).toBe(false);
    expect(abForceCloseApprovedSchema.safeParse({ ...base, allowedRoles: [] }).success).toBe(false);
    expect(abForceCloseApprovedSchema.safeParse({ ...base, allowedRoles: ["admin"] }).success).toBe(true);
  });
});
