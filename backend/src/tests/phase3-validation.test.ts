/**
 * Phase 3 — Validation, API Safety, and SQL Safety Closure.
 *
 * Negative / malicious-payload coverage for the schemas added or tightened in
 * this phase, plus a handful of domains that already had validation but no
 * dedicated rejection tests (penalty, social media, invoices, office
 * accounts, dollar transactions).
 *
 * Pure schema-level tests (`describe` blocks without "HTTP" in the title) run
 * with no DB dependency, matching patch6-stage5-service.test.ts. The one HTTP
 * block proves target-system-routes.ts's new role gate actually blocks at the
 * wire level (a schema test alone can't prove that), soft-skipping if the dev
 * Postgres pool is unreachable, mirroring penalty-routes.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import {
  createTargetSchema,
  dailyTargetSchema,
  kwaRecordSchema,
  assignRoleSchema,
} from "./target-system-routes";
import { gmVerificationStatusSchema } from "./hod-routes";
import { createSchema as gmBvPoolCreateSchema, updateSchema as gmBvPoolUpdateSchema } from "./gm-bv-pool-routes";
import { permissionCreateSchema } from "./drm-routes";
import { createServerSchema, registryCreateSchema, hostingPackageCreateSchema } from "./it-assets-routes";
import { createPostSchema as socialMediaCreatePostSchema } from "./social-media-routes";
import { penaltyDecisionSchema, penaltyVoidSchema } from "./validators/penalty.validators";
import { workflowCreateInvoiceSchema } from "./validators/invoice.validators";
import { insertOfficeExpenseSchema, insertDollarBuyerSchema, insertDollarBuyingSchema } from "@models/schema";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";

describe("target-system-routes schemas reject invalid/malicious payloads", () => {
  it("createTargetSchema rejects a missing targetName", () => {
    expect(createTargetSchema.safeParse({}).success).toBe(false);
  });
  it("createTargetSchema rejects unknown fields (mass-assignment attempt)", () => {
    const r = createTargetSchema.safeParse({ targetName: "T", isAdmin: true });
    expect(r.success).toBe(false);
  });
  it("createTargetSchema rejects a negative price", () => {
    const r = createTargetSchema.safeParse({ targetName: "T", price: -5 });
    expect(r.success).toBe(false);
  });
  it("dailyTargetSchema rejects a non-integer target", () => {
    const r = dailyTargetSchema.safeParse({ role: "sales_executive", method: "call", target: "not-a-number" });
    expect(r.success).toBe(false);
  });
  it("kwaRecordSchema rejects a missing company", () => {
    expect(kwaRecordSchema.safeParse({ employee: "E", kwa: 5, type: "credit" }).success).toBe(false);
  });
  it("assignRoleSchema rejects an empty targets array", () => {
    const r = assignRoleSchema.safeParse({ role: "sales_executive", targets: [] });
    expect(r.success).toBe(false);
  });
  it("assignRoleSchema rejects an unexpected top-level field", () => {
    const r = assignRoleSchema.safeParse({ role: "sales_executive", targets: [{ targetName: "X" }], extra: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("hod-routes gmVerificationStatusSchema rejects invalid financial payloads", () => {
  it("rejects an invalid status value", () => {
    expect(gmVerificationStatusSchema.safeParse({ status: "Maybe" }).success).toBe(false);
  });
  it("rejects a negative dollarRate", () => {
    const r = gmVerificationStatusSchema.safeParse({ status: "Approved", dollarRate: -1 });
    expect(r.success).toBe(false);
  });
  it("rejects a non-numeric extraDiscountHod", () => {
    const r = gmVerificationStatusSchema.safeParse({ status: "Approved", extraDiscountHod: "a lot" });
    expect(r.success).toBe(false);
  });
  it("rejects an installments entry with an unknown field", () => {
    const r = gmVerificationStatusSchema.safeParse({
      status: "Approved",
      installments: [{ dollar: 10, pkr: 100, chequeNo: "1", payDate: "2026-01-01", junk: "x" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects an out-of-range dollarRate (implausible input)", () => {
    const r = gmVerificationStatusSchema.safeParse({ status: "Approved", dollarRate: 999999 });
    expect(r.success).toBe(false);
  });
  it("accepts a minimal valid payload", () => {
    expect(gmVerificationStatusSchema.safeParse({ status: "Rejected" }).success).toBe(true);
  });
});

describe("gm-bv-pool-routes schemas are .strict()", () => {
  it("createSchema rejects an unknown field", () => {
    const r = gmBvPoolCreateSchema.safeParse({ companyName: "Acme Co", extraField: "nope" });
    expect(r.success).toBe(false);
  });
  it("updateSchema (partial) still rejects an unknown field", () => {
    const r = gmBvPoolUpdateSchema.safeParse({ status: "Approved", extraField: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("drm-routes permissionCreateSchema rejects malformed RBAC shapes", () => {
  it("rejects a missing name", () => {
    expect(permissionCreateSchema.safeParse({}).success).toBe(false);
  });
  it("rejects a non-array allowedRoleIds", () => {
    const r = permissionCreateSchema.safeParse({ name: "Reports", allowedRoleIds: "admin" });
    expect(r.success).toBe(false);
  });
  it("rejects a subUrls object with an unknown key", () => {
    const r = permissionCreateSchema.safeParse({ name: "Reports", subUrls: { isRoot: true, items: [], extra: 1 } });
    expect(r.success).toBe(false);
  });
});

describe("it-assets-routes schemas reject malformed Domain/Server forms", () => {
  it("createServerSchema rejects a missing name", () => {
    expect(createServerSchema.safeParse({ ip: "1.2.3.4" }).success).toBe(false);
  });
  it("createServerSchema rejects an unknown field", () => {
    const r = createServerSchema.safeParse({ name: "srv1", ip: "1.2.3.4", credentials: "leaked" });
    expect(r.success).toBe(false);
  });
  it("registryCreateSchema rejects a missing name", () => {
    expect(registryCreateSchema.safeParse({ url: "https://registry.example.com" }).success).toBe(false);
  });
  it("hostingPackageCreateSchema rejects a negative price", () => {
    const r = hostingPackageCreateSchema.safeParse({ name: "Basic", price: -10 });
    expect(r.success).toBe(false);
  });
});

describe("social-media-routes createPostSchema rejects malicious/invalid payloads", () => {
  it("rejects a missing platform/content", () => {
    expect(socialMediaCreatePostSchema.safeParse({}).success).toBe(false);
  });
  it("rejects a non-URL mediaUrl (e.g. a javascript: URI attempt)", () => {
    const r = socialMediaCreatePostSchema.safeParse({
      platform: "facebook",
      socialAccountId: "acc1",
      content: "hello",
      mediaUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an unknown field (mass-assignment attempt on approval_status)", () => {
    const r = socialMediaCreatePostSchema.safeParse({
      platform: "facebook",
      socialAccountId: "acc1",
      content: "hello",
      approvalStatus: "APPROVED",
    });
    expect(r.success).toBe(false);
  });
  it("rejects content over the max length", () => {
    const r = socialMediaCreatePostSchema.safeParse({
      platform: "facebook",
      socialAccountId: "acc1",
      content: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });
});

describe("invoice workflowCreateInvoiceSchema rejects invalid payloads", () => {
  it("rejects a missing customerId", () => {
    const r = workflowCreateInvoiceSchema.safeParse({ amount: 100, invoiceType: "LISTING_PAGE" });
    expect(r.success).toBe(false);
  });
  it("rejects a zero/negative amount", () => {
    const r = workflowCreateInvoiceSchema.safeParse({
      customerId: "11111111-1111-1111-1111-111111111111",
      amount: -50,
      invoiceType: "LISTING_PAGE",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an invoiceType outside the closed enum (free-text injection attempt)", () => {
    const r = workflowCreateInvoiceSchema.safeParse({
      customerId: "11111111-1111-1111-1111-111111111111",
      amount: 100,
      invoiceType: "DROP TABLE invoices;",
    });
    expect(r.success).toBe(false);
  });
  it("rejects overrideDuplicate=true without an overrideReason", () => {
    const r = workflowCreateInvoiceSchema.safeParse({
      customerId: "11111111-1111-1111-1111-111111111111",
      amount: 100,
      invoiceType: "LISTING_PAGE",
      overrideDuplicate: true,
    });
    expect(r.success).toBe(false);
  });
});

describe("penalty validators reject invalid decision/void payloads (PEN-001, no prior test coverage)", () => {
  it("penaltyDecisionSchema rejects a decision that isn't APPROVED/REJECTED", () => {
    const r = penaltyDecisionSchema.safeParse({ approvalStatus: "MAYBE" });
    expect(r.success).toBe(false);
  });
  it("penaltyDecisionSchema rejects REJECTED with no hodRemarks", () => {
    const r = penaltyDecisionSchema.safeParse({ approvalStatus: "REJECTED" });
    expect(r.success).toBe(false);
  });
  it("penaltyDecisionSchema accepts REJECTED with hodRemarks", () => {
    const r = penaltyDecisionSchema.safeParse({ approvalStatus: "REJECTED", hodRemarks: "policy violation" });
    expect(r.success).toBe(true);
  });
  it("penaltyVoidSchema rejects an empty reason", () => {
    expect(penaltyVoidSchema.safeParse({}).success).toBe(false);
    expect(penaltyVoidSchema.safeParse({ reason: "   " }).success).toBe(false);
  });
});

describe("Office Accounts / Dollar transactions schemas reject invalid payloads", () => {
  it("insertOfficeExpenseSchema rejects a missing expenseHead/office/amount", () => {
    expect(insertOfficeExpenseSchema.safeParse({}).success).toBe(false);
  });
  it("insertOfficeExpenseSchema rejects amount as a boolean", () => {
    const r = insertOfficeExpenseSchema.safeParse({
      expenseHead: "Utilities",
      office: "HQ",
      amount: true,
    });
    expect(r.success).toBe(false);
  });
  it("insertDollarBuyerSchema rejects a completely empty payload if a required field is missing", () => {
    // dollarBuyers has at least one NOT NULL column with no default; confirm
    // the generated schema still enforces it rather than silently accepting {}.
    const r = insertDollarBuyerSchema.safeParse({});
    expect(r.success).toBe(false);
  });
  it("insertDollarBuyingSchema rejects a missing dollarAmount/dollarRate/pkrAmount", () => {
    expect(insertDollarBuyingSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HTTP-level: proves the new target-system-routes.ts role gate actually blocks
// at the wire level (a schema-only test can't prove middleware ordering).
// Soft-skips if the dev Postgres pool is unreachable, mirroring
// penalty-routes.test.ts / patch5-stage7-role-matrix.test.ts.
// ---------------------------------------------------------------------------

describe("target-system-routes HTTP role gate + payload validation", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1");
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
    if (dbAvailable) {
      app = express();
      app.use(express.json());
      await registerRoutes(app);
    }
  });

  afterAll(async () => {
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  const tokenFor = (roleId: string) =>
    authService.generateToken({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "phase3-test@example.invalid",
      roleId,
      roles: [roleId],
      activeRoleId: roleId,
      branch: "Lahore Gulburg",
      country: "Pakistan",
    });

  it("rejects an unauthenticated request with 401 (never a silent 404)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/target-system/targets");
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("rejects a role outside the target-system allowlist (e.g. account_manager) with 403", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    // account_manager is deliberately used here (not sales_executive) because it
    // is treated as managerial by ensureSalesTables() and so never triggers the
    // per-executive table creation side effect against the shared dev DB.
    const res = await request(app)
      .get("/api/target-system/targets")
      .set("Authorization", `Bearer ${tokenFor("account_manager")}`);
    expect(res.status).toBe(403);
  });

  it("rejects a malformed create payload from an admitted role with 400", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .post("/api/target-system/targets")
      .set("Authorization", `Bearer ${tokenFor("admin")}`)
      .send({ targetName: "", price: -1 });
    expect(res.status).toBe(400);
  });
});
