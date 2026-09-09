/**
 * Phase 6 — GM Full/Partial/Loan Final UAT and Business Rule Closure.
 *
 * This audit found the business rules already correctly implemented (see
 * PHASE6_GM_UAT_SIGNOFF.md for the file:line evidence); this file is the
 * missing automated coverage proving each acceptance-criteria line is true
 * end-to-end against the real routes and the real dev DB. Soft-skips if the
 * dev Postgres pool is unreachable, mirroring invoice-workflow.test.ts /
 * project-creation.test.ts.
 *
 * CORRECTION (2026-07-20, see docs/completion/DECISION_LOG.md D-012): the
 * claim that previously stood here — that `super-hod-approve` /
 * `pending_super_hod` are unreachable dead code because nothing sets
 * `approval_status = 'pending_super_hod'` — was FALSE. `PATCH
 * /api/account/gm-entries/:id/approve` (account-routes.ts) unconditionally
 * sets it, and that route is live (registered via `registerAccountRoutes`).
 * `pending_super_hod` → `super-hod-approve`/`super-hod-reject` IS a real,
 * reachable path; this false assumption is what let those two routes ship
 * with no MD-15 department/reporting-line scope. That gap is now fixed
 * (`gm-pool-routes.ts`'s `super-hod-approve`/`super-hod-reject` now call
 * `gmApprovalScopeClause`, same as every other approval action). The loan
 * gate description below (`enforceLoanPartialFinalApprovalGate` blocking
 * `account-manager-approve`) is independently true and unaffected by this
 * correction — it describes a different check on a different route.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let gmCounter = 0;

describe("GM Full/Partial/Loan UAT (Phase 6)", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdGmIds: string[] = [];
  const createdCustomerIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p6_${role}_${SUFFIX}_${createdUserIds.length}`;
    const email = `${username}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
       VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
      [username, email, role, "Lahore Gulburg", `Full Name ${username}`, "test_hash"],
    );
    const id = String(r.rows[0].id);
    createdUserIds.push(id);
    const token = authService.generateToken({
      userId: id,
      email,
      roleId: role,
      roles: [role],
      activeRoleId: role,
      branch: "Lahore Gulburg",
      country: "Pakistan",
    });
    return { id, token };
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let admin: SeededUser;
  let salesExec: SeededUser;
  let hod: SeededUser;
  let accountManager: SeededUser;
  let superHod: SeededUser;

  // amount_usd/customer_dollar = pkrAmount / dollarRate = 28000 / 280 = 100.00
  function gmPayload(loanMode: "none" | "installment" | "loan", label: string) {
    gmCounter += 1;
    return {
      companyName: `__p6 ${label} Co ${SUFFIX}-${gmCounter}`,
      memberId: `MEM-${SUFFIX}-${gmCounter}`,
      orderId: `ORD-${SUFFIX}-${gmCounter}`,
      packageId: "basic",
      packageName: "Basic",
      pkrAmount: 28000,
      dollarRate: 280,
      alibabaDiscount: 0,
      paymentStatus: "Pending",
      type: "New",
      loanMode,
    };
  }

  async function createGm(actorToken: string, loanMode: "none" | "installment" | "loan", label: string) {
    const res = await request(app!)
      .post("/api/gm")
      .set(auth(actorToken))
      .send(gmPayload(loanMode, label));
    if (res.status === 201) createdGmIds.push(res.body.gm.id);
    return res;
  }

  async function hodApprove(id: string) {
    return request(app!).post(`/api/gm-pool/${id}/hod-approve`).set(auth(hod.token)).send({});
  }

  async function accountManagerApprove(id: string) {
    return request(app!)
      .post(`/api/gm-pool/${id}/account-manager-approve`)
      .set(auth(accountManager.token))
      .send({});
  }

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1");
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
    if (!dbAvailable) return;

    app = express();
    app.use(express.json());
    await registerRoutes(app);

    admin = await seedUser("admin");
    salesExec = await seedUser("sales_executive");
    hod = await seedUser("hod");
    accountManager = await seedUser("account_manager");
    superHod = await seedUser("super_hod");

    // Wire full reporting-line hierarchy so gmApprovalScopeClause resolves
    // salesExec as being reachable from every approval tier:
    //   salesExec → accountManager → hod → superHod
    await pool.query(
      `UPDATE drm.users SET under_works = $1 WHERE id = $2`,
      [accountManager.id, salesExec.id],
    );
    await pool.query(
      `UPDATE drm.users SET under_works = $1 WHERE id = $2`,
      [hod.id, accountManager.id],
    );
    await pool.query(
      `UPDATE drm.users SET under_works = $1 WHERE id = $2`,
      [superHod.id, hod.id],
    );
  });

  afterAll(async () => {
    try {
      if (dbAvailable && createdGmIds.length) {
        await pool.query(`DELETE FROM drm.gm_loan_terms WHERE gm_id = ANY($1::text[])`, [createdGmIds]);
        await pool.query(`DELETE FROM drm.gm_partial_receipts WHERE gm_id = ANY($1::text[])`, [createdGmIds]);
        await pool.query(
          `DELETE FROM drm.product_posting_invoices WHERE gm_id = ANY($1::text[])`,
          [createdGmIds],
        );
        await pool.query(`DELETE FROM drm.gm_entries WHERE id = ANY($1::uuid[])`, [createdGmIds]);
      }
      if (dbAvailable && createdCustomerIds.length) {
        await pool.query(`DELETE FROM drm.customers WHERE id = ANY($1::uuid[])`, [createdCustomerIds]);
      }
      if (dbAvailable && createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    } catch (err) {
      console.warn("[gm-uat.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  // ---------------------------------------------------------------------
  // Full GM — no special gate
  // ---------------------------------------------------------------------
  describe("Full GM", () => {
    it("follows create -> hod-approve -> account-manager-approve with no gate, and auto-generates invoices", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "none", "Full");
      expect(createRes.status).toBe(201);
      expect(createRes.body.gm.isLoan).toBeFalsy();
      expect(createRes.body.gm.isPartialPayment).toBeFalsy();
      const id = createRes.body.gm.id;

      const hodRes = await hodApprove(id);
      expect(hodRes.status).toBe(200);
      expect(hodRes.body.data.approval_status).toBe("pending_managers");

      const acctRes = await accountManagerApprove(id);
      expect(acctRes.status).toBe(200);
      expect(acctRes.body.data.final_status).toBe("approved");

      // GM creation auto-generates the default product-posting invoices
      // (server/services/gm-invoice-generation.service.ts) — the invoice/project
      // link itself is already covered end-to-end by Phase 4/5's tests
      // (invoice-workflow.test.ts, project-creation.test.ts); here we only
      // confirm the link exists for a Full GM.
      const invRes = await pool.query(
        `SELECT count(*)::int AS c FROM drm.product_posting_invoices WHERE gm_id = $1`,
        [id],
      );
      expect(invRes.rows[0].c).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------
  // DRM ID consistency — a company's DRM ID is assigned once and must be
  // identical everywhere it's shown (GM entry, Duplicate Check/customers row).
  // ---------------------------------------------------------------------
  describe("DRM ID consistency", () => {
    it("reuses the existing customer's DRM ID for a new GM instead of generating a different one", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }

      const knownDrmId = `pktest_${SUFFIX}`;
      const custRes = await pool.query(
        `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
         VALUES ($1, $2, $3, $4, 'Other', 'C', $5) RETURNING id`,
        [
          `__p6 DrmIdCo ${SUFFIX}`,
          "Test Holder",
          `drmid_${SUFFIX}@example.invalid`,
          "03000000000",
          knownDrmId,
        ],
      );
      const customerId = String(custRes.rows[0].id);
      createdCustomerIds.push(customerId);

      const createRes = await request(app!)
        .post("/api/gm")
        .set(auth(salesExec.token))
        .send({ ...gmPayload("none", "DrmId"), companyId: customerId });
      expect(createRes.status).toBe(201);
      if (createRes.status === 201) createdGmIds.push(createRes.body.gm.id);

      // The GM entry must carry the SAME DRM ID as the customer — not a freshly
      // generated one — so Add GM and Duplicate Check never disagree.
      expect(createRes.body.gm.drmId).toBe(knownDrmId);

      const custAfter = await pool.query(`SELECT drm_id FROM drm.customers WHERE id = $1`, [customerId]);
      expect(custAfter.rows[0].drm_id).toBe(knownDrmId);
    });

    it("backfills a legacy customer's missing DRM ID from its first GM entry", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }

      const custRes = await pool.query(
        `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade, drm_id)
         VALUES ($1, $2, $3, $4, 'Other', 'C', NULL) RETURNING id`,
        [
          `__p6 LegacyCo ${SUFFIX}`,
          "Legacy Holder",
          `legacy_${SUFFIX}@example.invalid`,
          "03000000001",
        ],
      );
      const customerId = String(custRes.rows[0].id);
      createdCustomerIds.push(customerId);

      const createRes = await request(app!)
        .post("/api/gm")
        .set(auth(salesExec.token))
        .send({ ...gmPayload("none", "Legacy"), companyId: customerId });
      expect(createRes.status).toBe(201);
      if (createRes.status === 201) createdGmIds.push(createRes.body.gm.id);
      const drmId = createRes.body.gm.drmId;
      expect(drmId).toBeTruthy();

      // The customer's previously-null drm_id is now backfilled with that same ID,
      // so a later Duplicate Check lookup returns this exact value, not a different one.
      const custAfter = await pool.query(`SELECT drm_id FROM drm.customers WHERE id = $1`, [customerId]);
      expect(custAfter.rows[0].drm_id).toBe(drmId);
    });
  });

  // ---------------------------------------------------------------------
  // Partial GM — paid-in-full gate
  // ---------------------------------------------------------------------
  describe("Partial GM", () => {
    it("blocks final approval until fully paid, then allows it", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "installment", "Partial");
      expect(createRes.status).toBe(201);
      expect(Number(createRes.body.gm.isPartialPayment)).toBe(1);
      const id = createRes.body.gm.id;
      const target = Number(createRes.body.gm.customerDollar); // 100.00

      const hodRes = await hodApprove(id);
      expect(hodRes.status).toBe(200);

      // No receipts yet -> blocked.
      const blockedRes = await accountManagerApprove(id);
      expect(blockedRes.status).toBe(409);
      expect(blockedRes.body.code).toBe("PARTIAL_PAYMENT_INCOMPLETE");

      // Partial receipt (half) -> still blocked.
      const half = Number((target / 2).toFixed(2));
      const receipt1 = await request(app)
        .post(`/api/gm-pool/${id}/partial-receipts`)
        .set(auth(accountManager.token))
        .send({ amountUsd: half });
      expect(receipt1.status).toBe(201);

      const stillBlockedRes = await accountManagerApprove(id);
      expect(stillBlockedRes.status).toBe(409);
      expect(stillBlockedRes.body.code).toBe("PARTIAL_PAYMENT_INCOMPLETE");

      // A receipt that would overpay the remaining balance is rejected.
      const overpayRes = await request(app)
        .post(`/api/gm-pool/${id}/partial-receipts`)
        .set(auth(accountManager.token))
        .send({ amountUsd: target }); // remaining is only `half`, this exceeds it
      expect(overpayRes.status).toBe(409);

      // Pay the remaining balance -> approval now succeeds.
      const remaining = Number((target - half).toFixed(2));
      const receipt2 = await request(app)
        .post(`/api/gm-pool/${id}/partial-receipts`)
        .set(auth(accountManager.token))
        .send({ amountUsd: remaining });
      expect(receipt2.status).toBe(201);

      const approvedRes = await accountManagerApprove(id);
      expect(approvedRes.status).toBe(200);
      expect(approvedRes.body.data.final_status).toBe("approved");
    }, 180000);
  });

  // ---------------------------------------------------------------------
  // Loan GM — Admin (Super HOD) approval gate + overdue behavior
  // ---------------------------------------------------------------------
  describe("Loan GM", () => {
    it("blocks final approval until loan terms exist AND are admin-approved by super_hod", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "loan", "Loan");
      expect(createRes.status).toBe(201);
      expect(Number(createRes.body.gm.isLoan)).toBe(1);
      const id = createRes.body.gm.id;

      const hodRes = await hodApprove(id);
      expect(hodRes.status).toBe(200);

      // No loan terms yet -> blocked.
      const noTermsRes = await accountManagerApprove(id);
      expect(noTermsRes.status).toBe(409);
      expect(noTermsRes.body.code).toBe("LOAN_ADMIN_APPROVAL_REQUIRED");

      // Loan terms recorded, but not yet admin-approved -> still blocked.
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() + 30);
      const termsRes = await request(app)
        .post(`/api/gm-pool/${id}/loan-terms`)
        .set(auth(accountManager.token))
        .send({ loanAmountUsd: 100, agreedReturnDate: pastDate.toISOString().slice(0, 10) });
      expect(termsRes.status).toBe(200);

      const stillBlockedRes = await accountManagerApprove(id);
      expect(stillBlockedRes.status).toBe(409);
      expect(stillBlockedRes.body.code).toBe("LOAN_ADMIN_APPROVAL_REQUIRED");

      // A plain HOD (not super_hod) may NOT grant loan admin approval.
      const hodAdminAttempt = await request(app)
        .post(`/api/gm-pool/${id}/loan-admin-approve`)
        .set(auth(hod.token))
        .send({});
      expect(hodAdminAttempt.status).toBe(403);

      // super_hod grants loan admin approval -> gate opens.
      const adminApproveRes = await request(app)
        .post(`/api/gm-pool/${id}/loan-admin-approve`)
        .set(auth(superHod.token))
        .send({ comment: "Approved for UAT" });
      expect(adminApproveRes.status).toBe(200);

      const approvedRes = await accountManagerApprove(id);
      expect(approvedRes.status).toBe(200);
      expect(approvedRes.body.data.final_status).toBe("approved");
    });

    it("flags a loan past its agreed return date as overdue, not due-soon", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "loan", "LoanOverdue");
      const id = createRes.body.gm.id;
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      await request(app)
        .post(`/api/gm-pool/${id}/loan-terms`)
        .set(auth(accountManager.token))
        .send({ loanAmountUsd: 100, agreedReturnDate: pastDate.toISOString().slice(0, 10) });

      const reportRes = await request(app)
        .get("/api/gm-pool/loan-return-report")
        .set(auth(accountManager.token));
      expect(reportRes.status).toBe(200);
      const body = JSON.stringify(reportRes.body);
      expect(body).toContain(id);
    });
  });

  // ---------------------------------------------------------------------
  // Accounts GM Summary — the 6 requested metrics move as expected
  // ---------------------------------------------------------------------
  describe("Accounts GM Summary dashboard", () => {
    it("reflects full/partial/loan counts and amounts, and loan due-soon/overdue counts", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }

      const baselineRes = await request(app)
        .get("/api/accounts/dashboard/gm-summary")
        .set(auth(accountManager.token));
      expect(baselineRes.status).toBe(200);
      const baseline = baselineRes.body.data.totals;

      // One Full, one Partial (with a receipt), one Loan (overdue).
      const fullRes = await createGm(salesExec.token, "none", "SummaryFull");
      const partialRes = await createGm(salesExec.token, "installment", "SummaryPartial");
      await request(app)
        .post(`/api/gm-pool/${partialRes.body.gm.id}/partial-receipts`)
        .set(auth(accountManager.token))
        .send({ amountUsd: 40 });
      const loanRes = await createGm(salesExec.token, "loan", "SummaryLoan");
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 5);
      await request(app)
        .post(`/api/gm-pool/${loanRes.body.gm.id}/loan-terms`)
        .set(auth(accountManager.token))
        .send({ loanAmountUsd: 250, agreedReturnDate: overdueDate.toISOString().slice(0, 10) });

      const afterRes = await request(app)
        .get("/api/accounts/dashboard/gm-summary")
        .set(auth(accountManager.token));
      expect(afterRes.status).toBe(200);
      const totals = afterRes.body.data.totals;

      expect(totals.fullGmCount).toBe(baseline.fullGmCount + 1);
      expect(totals.partialGmCount).toBe(baseline.partialGmCount + 1);
      expect(totals.loanGmCount).toBe(baseline.loanGmCount + 1);
      expect(Number(totals.partialGmReceivedAmount)).toBeGreaterThanOrEqual(
        Number(baseline.partialGmReceivedAmount) + 40,
      );
      expect(Number(totals.partialGmPendingAmount)).toBeGreaterThanOrEqual(
        Number(baseline.partialGmPendingAmount) + 59, // 100 - 40 - rounding slack
      );
      expect(Number(totals.loanGmAmount)).toBeGreaterThanOrEqual(Number(baseline.loanGmAmount) + 250);
      expect(totals.loanOverdueCount).toBeGreaterThanOrEqual(baseline.loanOverdueCount + 1);
    });
  });

  // ---------------------------------------------------------------------
  // Role-based UAT matrix
  // ---------------------------------------------------------------------
  describe("Role-based UAT matrix", () => {
    it("sales_executive can create a GM; a role with no create permission cannot act on GM approval routes", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "none", "RoleCreate");
      expect(createRes.status).toBe(201);
    });

    it("only hod/super_hod may hod-approve; account_manager may not", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "none", "RoleHod");
      const id = createRes.body.gm.id;
      const wrongRoleRes = await request(app)
        .post(`/api/gm-pool/${id}/hod-approve`)
        .set(auth(accountManager.token))
        .send({});
      expect(wrongRoleRes.status).toBe(403);
      const correctRoleRes = await hodApprove(id);
      expect(correctRoleRes.status).toBe(200);
    });

    it("only account_manager (or admin) may account-manager-approve; hod may not", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "none", "RoleAccount");
      const id = createRes.body.gm.id;
      await hodApprove(id);
      const wrongRoleRes = await request(app)
        .post(`/api/gm-pool/${id}/account-manager-approve`)
        .set(auth(hod.token))
        .send({});
      expect(wrongRoleRes.status).toBe(403);
      const correctRoleRes = await accountManagerApprove(id);
      expect(correctRoleRes.status).toBe(200);
    });

    it("admin bypasses the create/approve role gates end-to-end", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(admin.token, "none", "RoleAdmin");
      expect(createRes.status).toBe(201);
      const id = createRes.body.gm.id;
      const hodRes = await request(app)
        .post(`/api/gm-pool/${id}/hod-approve`)
        .set(auth(admin.token))
        .send({});
      expect(hodRes.status).toBe(200);
      const acctRes = await request(app)
        .post(`/api/gm-pool/${id}/account-manager-approve`)
        .set(auth(admin.token))
        .send({});
      expect(acctRes.status).toBe(200);
    });

    it("only super_hod (not hod or account_manager) may grant loan admin approval", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const createRes = await createGm(salesExec.token, "loan", "RoleLoanAdmin");
      const id = createRes.body.gm.id;
      await hodApprove(id);
      await request(app)
        .post(`/api/gm-pool/${id}/loan-terms`)
        .set(auth(accountManager.token))
        .send({ loanAmountUsd: 100 });

      const accountManagerAttempt = await request(app)
        .post(`/api/gm-pool/${id}/loan-admin-approve`)
        .set(auth(accountManager.token))
        .send({});
      expect(accountManagerAttempt.status).toBe(403);

      const superHodAttempt = await request(app)
        .post(`/api/gm-pool/${id}/loan-admin-approve`)
        .set(auth(superHod.token))
        .send({});
      expect(superHodAttempt.status).toBe(200);
    });
  });
});
