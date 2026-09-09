import { describe, it, expect } from "vitest";
import {
  BUSINESS_RULES_CONFIG_DEFAULTS,
  BUSINESS_RULES_REGISTRY,
  businessRulesConfigSchema,
  abForceCloseApprovedSchema,
  walletNegativeBalanceApprovedSchema,
  decisionMetaSchema,
  type BusinessRulesConfig,
} from "../shared/business-rules-config";
import {
  checkWalletNegativeBalanceAllowed,
  getApprovedProfitLossFormulaVersion,
  checkAbForceCloseAllowed,
  checkReopenAllowed,
} from "./services/business-rules-policy.service";

describe("BUSINESS_RULES_CONFIG_DEFAULTS", () => {
  it("defaults every decision to PENDING_APPROVAL", () => {
    expect(BUSINESS_RULES_CONFIG_DEFAULTS.walletNegativeBalancePolicy).toEqual({ status: "PENDING_APPROVAL" });
    expect(BUSINESS_RULES_CONFIG_DEFAULTS.profitLossFormulaVersion).toEqual({ status: "PENDING_APPROVAL" });
    expect(BUSINESS_RULES_CONFIG_DEFAULTS.abForceClosePolicy).toEqual({ status: "PENDING_APPROVAL" });
    expect(BUSINESS_RULES_CONFIG_DEFAULTS.reopenPolicy).toEqual({ status: "PENDING_APPROVAL" });
  });

  it("parses successfully against its own schema", () => {
    expect(businessRulesConfigSchema.safeParse(BUSINESS_RULES_CONFIG_DEFAULTS).success).toBe(true);
  });
});

describe("BUSINESS_RULES_REGISTRY", () => {
  it("indexes all 8 Phase-1 business-rule areas", () => {
    expect(Object.keys(BUSINESS_RULES_REGISTRY).sort()).toEqual(
      [
        "abForceClosePolicy",
        "gmEligibility",
        "invoiceTrigger",
        "listingQaRequirement",
        "paymentThresholds",
        "profitLossFormulaVersion",
        "reopenPolicy",
        "walletNegativeBalancePolicy",
      ].sort(),
    );
  });

  it("marks the 4 already-externalized areas CONFIGURED and the 4 new areas PENDING_APPROVAL", () => {
    expect(BUSINESS_RULES_REGISTRY.gmEligibility.status).toBe("CONFIGURED");
    expect(BUSINESS_RULES_REGISTRY.paymentThresholds.status).toBe("CONFIGURED");
    expect(BUSINESS_RULES_REGISTRY.invoiceTrigger.status).toBe("CONFIGURED");
    expect(BUSINESS_RULES_REGISTRY.listingQaRequirement.status).toBe("CONFIGURED");
    expect(BUSINESS_RULES_REGISTRY.walletNegativeBalancePolicy.status).toBe("PENDING_APPROVAL");
    expect(BUSINESS_RULES_REGISTRY.profitLossFormulaVersion.status).toBe("PENDING_APPROVAL");
    expect(BUSINESS_RULES_REGISTRY.abForceClosePolicy.status).toBe("PENDING_APPROVAL");
    expect(BUSINESS_RULES_REGISTRY.reopenPolicy.status).toBe("PENDING_APPROVAL");
  });
});

describe("checkWalletNegativeBalanceAllowed — controlled pending behavior", () => {
  it("succeeds for a positive balance while the policy is pending (no decision required)", () => {
    const r = checkWalletNegativeBalanceAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, 500);
    expect(r.ok).toBe(true);
  });

  it("succeeds for a zero balance while the policy is pending (no decision required)", () => {
    const r = checkWalletNegativeBalanceAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, 0);
    expect(r.ok).toBe(true);
  });

  it("fails safe with WALLET_POLICY_PENDING_APPROVAL for a negative balance while pending", () => {
    const r = checkWalletNegativeBalanceAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, -500);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("WALLET_POLICY_PENDING_APPROVAL");
  });
});

describe("checkWalletNegativeBalanceAllowed — approved decision (simulated)", () => {
  const approvedNoOverdraft: BusinessRulesConfig = {
    ...BUSINESS_RULES_CONFIG_DEFAULTS,
    walletNegativeBalancePolicy: {
      status: "APPROVED",
      allowNegative: false,
      overdraftLimitUsd: null,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    },
  };
  const approvedWithOverdraft: BusinessRulesConfig = {
    ...BUSINESS_RULES_CONFIG_DEFAULTS,
    walletNegativeBalancePolicy: {
      status: "APPROVED",
      allowNegative: true,
      overdraftLimitUsd: 1000,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    },
  };

  it("allows any non-negative balance once approved", () => {
    expect(checkWalletNegativeBalanceAllowed(approvedNoOverdraft, 0).ok).toBe(true);
    expect(checkWalletNegativeBalanceAllowed(approvedWithOverdraft, 250).ok).toBe(true);
  });

  it("forbids negative balance when allowNegative is false", () => {
    const r = checkWalletNegativeBalanceAllowed(approvedNoOverdraft, -1);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("WALLET_NEGATIVE_BALANCE_FORBIDDEN");
  });

  it("allows negative balance within the approved overdraft limit", () => {
    expect(checkWalletNegativeBalanceAllowed(approvedWithOverdraft, -999).ok).toBe(true);
  });

  it("rejects negative balance beyond the approved overdraft limit", () => {
    const r = checkWalletNegativeBalanceAllowed(approvedWithOverdraft, -1001);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("WALLET_OVERDRAFT_LIMIT_EXCEEDED");
  });
});

describe("getApprovedProfitLossFormulaVersion", () => {
  it("fails safe with PROFIT_LOSS_NOT_APPROVED and no value while pending", () => {
    const r = getApprovedProfitLossFormulaVersion(BUSINESS_RULES_CONFIG_DEFAULTS);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("PROFIT_LOSS_NOT_APPROVED");
    expect(r.value).toBeUndefined();
  });

  it("returns the approved version once decided (simulated)", () => {
    const approved: BusinessRulesConfig = {
      ...BUSINESS_RULES_CONFIG_DEFAULTS,
      profitLossFormulaVersion: {
        status: "APPROVED",
        version: "v1-gross-margin",
        decidedBy: "Test Project Owner",
        decidedAt: "2026-07-17",
        decisionRef: "DECISION_LOG.md D-TEST",
      },
    };
    const r = getApprovedProfitLossFormulaVersion(approved);
    expect(r.ok).toBe(true);
    expect(r.value).toBe("v1-gross-margin");
  });
});

describe("checkAbForceCloseAllowed — controlled pending behavior", () => {
  it("fails safe with AB_FORCE_CLOSE_NOT_APPROVED regardless of actor role", () => {
    expect(checkAbForceCloseAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, ["admin"]).code).toBe(
      "AB_FORCE_CLOSE_NOT_APPROVED",
    );
    expect(checkAbForceCloseAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, []).code).toBe(
      "AB_FORCE_CLOSE_NOT_APPROVED",
    );
  });
});

describe("checkAbForceCloseAllowed — approved decision (simulated)", () => {
  const approved: BusinessRulesConfig = {
    ...BUSINESS_RULES_CONFIG_DEFAULTS,
    abForceClosePolicy: {
      status: "APPROVED",
      allowedRoles: ["admin", "super_hod"],
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    },
  };

  it("allows a role in the approved allow-list", () => {
    expect(checkAbForceCloseAllowed(approved, ["super_hod"]).ok).toBe(true);
  });

  it("forbids a role outside the approved allow-list", () => {
    const r = checkAbForceCloseAllowed(approved, ["sales_executive"]);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("AB_FORCE_CLOSE_ROLE_FORBIDDEN");
  });
});

describe("checkReopenAllowed — controlled pending behavior", () => {
  it("fails safe with REOPEN_NOT_APPROVED regardless of actor role", () => {
    expect(checkReopenAllowed(BUSINESS_RULES_CONFIG_DEFAULTS, ["admin"]).code).toBe("REOPEN_NOT_APPROVED");
  });
});

describe("checkReopenAllowed — approved decision (simulated)", () => {
  const approved: BusinessRulesConfig = {
    ...BUSINESS_RULES_CONFIG_DEFAULTS,
    reopenPolicy: {
      status: "APPROVED",
      allowedRoles: ["admin"],
      requireReason: true,
      maxReopensPerPeriod: 1,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    },
  };

  it("allows a role in the approved allow-list", () => {
    expect(checkReopenAllowed(approved, ["admin"]).ok).toBe(true);
  });

  it("forbids a role outside the approved allow-list", () => {
    expect(checkReopenAllowed(approved, ["hod"]).code).toBe("REOPEN_ROLE_FORBIDDEN");
  });
});

describe("allowedRoles schema — invalid role name", () => {
  it("rejects a role name that isn't in the authoritative ROLES registry", () => {
    const r = abForceCloseApprovedSchema.safeParse({
      status: "APPROVED",
      allowedRoles: ["totally_made_up_role"],
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a real role name from the ROLES registry", () => {
    const r = abForceCloseApprovedSchema.safeParse({
      status: "APPROVED",
      allowedRoles: ["admin"],
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty allowedRoles list (at least one role required)", () => {
    const r = abForceCloseApprovedSchema.safeParse({
      status: "APPROVED",
      allowedRoles: [],
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(false);
  });
});

describe("allowedRoles schema — duplicate roles", () => {
  it("rejects a duplicate role entry", () => {
    const r = abForceCloseApprovedSchema.safeParse({
      status: "APPROVED",
      allowedRoles: ["admin", "super_hod", "admin"],
      requireReason: true,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(false);
  });
});

describe("decisionMetaSchema — invalid decision date", () => {
  it("rejects a decidedAt value that isn't a valid ISO date/datetime", () => {
    const r = decisionMetaSchema.safeParse({
      decidedBy: "Test Project Owner",
      decidedAt: "not-a-real-date",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid ISO date", () => {
    const r = decisionMetaSchema.safeParse({
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid ISO datetime", () => {
    const r = decisionMetaSchema.safeParse({
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17T12:00:00Z",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(true);
  });
});

describe("walletNegativeBalanceApprovedSchema — contradictory wallet policy", () => {
  it("rejects allowNegative:false with a non-null overdraftLimitUsd", () => {
    const r = walletNegativeBalanceApprovedSchema.safeParse({
      status: "APPROVED",
      allowNegative: false,
      overdraftLimitUsd: 500,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(false);
  });

  it("accepts allowNegative:false with a null overdraftLimitUsd", () => {
    const r = walletNegativeBalanceApprovedSchema.safeParse({
      status: "APPROVED",
      allowNegative: false,
      overdraftLimitUsd: null,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(true);
  });

  it("accepts allowNegative:true with a non-null overdraftLimitUsd", () => {
    const r = walletNegativeBalanceApprovedSchema.safeParse({
      status: "APPROVED",
      allowNegative: true,
      overdraftLimitUsd: 500,
      decidedBy: "Test Project Owner",
      decidedAt: "2026-07-17",
      decisionRef: "DECISION_LOG.md D-TEST",
    });
    expect(r.success).toBe(true);
  });
});
