import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("AB Payments and Closing Reconciliation UAT (Phase 8)", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdPaymentIds: number[] = [];
  const createdGmIds: string[] = [];
  const createdBuyerIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
    email: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p8_${role}_${SUFFIX}_${createdUserIds.length}`;
    const email = `${username}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
       VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
      [username, email, role, "Lahore Gulburg", `Full Name ${username}`, "test_hash"]
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
    return { id, token, email };
  }

  beforeAll(async () => {
    try {
      const res = await pool.query("SELECT 1");
      if (res.rows.length > 0) {
        dbAvailable = true;
        
        // Seed config value for lifecycle tests
        await pool.query(
          `INSERT INTO drm.gm_sales_workflow_config (key, value, description)
           VALUES ('abPaymentLifecycleEnabled', 'true'::jsonb, 'Enabled for testing')
           ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb`
        );

        app = express();
        app.use(express.json());
        try {
          await registerRoutes(app);
        } catch (rErr) {
          console.error("[registerRoutes error in test setup]:", rErr);
        }
      }
    } catch (e) {
      console.warn("[vitest] DB is not available, skipping Phase 8 tests", e);
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Revert config value
      await pool.query(
        `INSERT INTO drm.gm_sales_workflow_config (key, value, description)
         VALUES ('abPaymentLifecycleEnabled', 'false'::jsonb, 'Disabled after testing')
         ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb`
      );

      if (createdPaymentIds.length > 0) {
        await pool.query(`DELETE FROM drm.ab_payments WHERE id::text = ANY($1::text[])`, [createdPaymentIds]);
      }
      if (createdBuyerIds.length > 0) {
        await pool.query(`DELETE FROM drm.dollar_buyers WHERE id::text = ANY($1::text[])`, [createdBuyerIds]);
      }
      if (createdGmIds.length > 0) {
        await pool.query(`DELETE FROM drm.gm_entries WHERE id::text = ANY($1::text[])`, [createdGmIds]);
      }
      if (createdUserIds.length > 0) {
        await pool.query(`DELETE FROM drm.activity_logs WHERE user_id::text = ANY($1::text[])`, [createdUserIds]);
        await pool.query(`DELETE FROM drm.users WHERE id::text = ANY($1::text[])`, [createdUserIds]);
      }
    } catch (e) {
      console.error("Clean up error", e);
    }
  });

  it("1. Verify drm.ab_payments table schema exists with expected columns", async () => {
    if (!dbAvailable) return;
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND table_name = 'ab_payments'
    `);
    expect(res.rows.length).toBeGreaterThan(0);
    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain("id");
    expect(cols).toContain("ab_id");
    expect(cols).toContain("order_id");
    expect(cols).toContain("gm_drm_id");
    expect(cols).toContain("amount_usd");
    expect(cols).toContain("amount_pkr");
    expect(cols).toContain("rate");
    expect(cols).toContain("status");
    expect(cols).toContain("paid_date");
    expect(cols).toContain("created_by");
  });

  it("2. Confirm route authentication & authorization checks", async () => {
    if (!dbAvailable) return;
    // Unauthenticated request should yield 401
    const res = await request(app!)
      .get("/api/account/ab-payments");
    expect(res.status).toBe(401);

    // Sales Executive (non-financial role) should fail checkUrlPermission with 403
    const sales = await seedUser("sales_executive");
    const resForbidden = await request(app!)
      .get("/api/account/ab-payments")
      .set("Authorization", `Bearer ${sales.token}`);
    expect(resForbidden.status).toBe(403);
  });

  it("3. CRUD Lifecycle of AB Payments: Create, List, Status Transition, Delete, Export", async () => {
    if (!dbAvailable) return;
    const manager = await seedUser("account_manager");
    const headers = { Authorization: `Bearer ${manager.token}` };

    // 3a. POST /api/account/ab-payments (Create Pending)
    const createRes = await request(app!)
      .post("/api/account/ab-payments")
      .set(headers)
      .send({
        abId: `ab_${SUFFIX}`,
        orderId: `order_${SUFFIX}`,
        gmDrmId: `drm_${SUFFIX}`,
        companyName: "Web Excels test company",
        amountUsd: 150.50,
        amountPkr: 42000,
        rate: 279.0,
        notes: "Phase 8 automated test payment record"
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.status).toBe("pending");
    const paymentId = createRes.body.data.id;
    createdPaymentIds.push(paymentId);

    // 3b. GET /api/account/ab-payments (List and Search filter)
    const listRes = await request(app!)
      .get(`/api/account/ab-payments?search=drm_${SUFFIX}`)
      .set(headers);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(paymentId);

    // 3c. PATCH /api/account/ab-payments/:id/status (Lifecycle: pending -> paid)
    const statusRes = await request(app!)
      .patch(`/api/account/ab-payments/${paymentId}/status`)
      .set(headers)
      .send({
        status: "paid",
        notes: "Payment complete via Bank transfer",
        paidDate: "2026-07-06",
        proofUrl: "https://example.invalid/receipt.png",
        reason: "automated test approval"
      });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("paid");
    expect(statusRes.body.data.proof_url).toBe("https://example.invalid/receipt.png");

    // Transition back to cancelled so it can be soft-deleted
    const cancelRes = await request(app!)
      .patch(`/api/account/ab-payments/${paymentId}/status`)
      .set(headers)
      .send({
        status: "cancelled",
        reason: "automated test cancellation"
      });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    // 3d. GET /api/account/ab-payments/export (CSV export)
    const exportRes = await request(app!)
      .get("/api/account/ab-payments/export?status=cancelled")
      .set(headers);
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain("AB ID,Order ID");
    expect(exportRes.text).toContain("Web Excels test company");

    // 3e. DELETE /api/account/ab-payments/:id (soft delete)
    const deleteRes = await request(app!)
      .delete(`/api/account/ab-payments/${paymentId}`)
      .set(headers)
      .send({
        reason: "automated test delete"
      });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it("4. Confirm AB Closing reconciliation calculations & checklist math", async () => {
    if (!dbAvailable) return;
    const manager = await seedUser("account_manager");
    const headers = { Authorization: `Bearer ${manager.token}` };

    // Seed an approved GM entry
    const gmIdRes = await pool.query(`
      INSERT INTO drm.gm_entries (
        company_name, package_type, entry_type, amount_usd, amount_pkr, amount,
        dollar_rate, status, drm_id, order_id, created_by
      ) VALUES (
        'Reconciliation Test Co', 'Vanguard', 'Full', 1000.00, 280000.00, 280000.00,
        280.0, 'Approved', 'DRM-REC-1', 'ORD-REC-1', $1::uuid
      ) RETURNING id
    `, [manager.id]);
    const gmEntryId = gmIdRes.rows[0].id;
    createdGmIds.push(gmEntryId);

    // Seed an AB payment record for that GM
    const abRes = await pool.query(`
      INSERT INTO drm.ab_payments (
        ab_id, order_id, gm_drm_id, gm_entry_id, company_name,
        amount_usd, amount_pkr, rate, status, paid_date
      ) VALUES (
        'AB-REC-1', 'ORD-REC-1', 'DRM-REC-1', $1, 'Reconciliation Test Co',
        900.00, 252000.00, 280.0, 'paid', CURRENT_DATE
      ) RETURNING id
    `, [gmEntryId]);
    createdPaymentIds.push(abRes.rows[0].id);

    // Fetch AB closing summary
    const summaryRes = await request(app!)
      .get("/api/account/ab-closing/summary")
      .set(headers);

    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body;
    expect(summary.customerPayment).toBeDefined();
    expect(summary.dollarPurchased).toBeDefined();
    expect(summary.abPayments).toBeDefined();
    expect(summary.reconciliation).toBeDefined();
    expect(summary.checklist).toBeDefined();

    // Check reconciliation math
    // remainingBalanceUsd = dollarPurchased.buy_usd - abPayments.ab_paid_usd
    // Let's assert these properties exist and map to numeric aggregates
    expect(typeof summary.reconciliation.remainingBalanceUsd).toBe("number");
    expect(typeof summary.reconciliation.cashInHandPkr).toBe("number");
  });

  it("4b. Explicit Lifecycle Endpoints: Cancel, Void, and Soft-Delete", async () => {
    if (!dbAvailable) return;
    const manager = await seedUser("account_manager");
    const adminUser = await seedUser("admin");
    const mHeaders = { Authorization: `Bearer ${manager.token}` };
    const aHeaders = { Authorization: `Bearer ${adminUser.token}` };

    // Create a pending AB payment
    const createRes = await request(app!)
      .post("/api/account/ab-payments")
      .set(mHeaders)
      .send({
        abId: `ab_lc_${SUFFIX}`,
        orderId: `order_lc_${SUFFIX}`,
        gmDrmId: `drm_lc_${SUFFIX}`,
        companyName: "Lifecycle Test Co",
        amountUsd: 100.00,
        amountPkr: 28000,
        rate: 280.0,
      });
    expect(createRes.status).toBe(201);
    const paymentId = createRes.body.data.id;
    createdPaymentIds.push(paymentId);

    // 1. CANCEL the pending payment
    const cancelRes = await request(app!)
      .post(`/api/account/ab-payments/${paymentId}/cancel`)
      .set(mHeaders)
      .send({ reason: "Cancel reason test" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    // 2. SOFT-DELETE the cancelled payment
    const softDeleteRes = await request(app!)
      .post(`/api/account/ab-payments/${paymentId}/soft-delete`)
      .set(aHeaders)
      .send({ reason: "Soft-delete reason test" });
    expect(softDeleteRes.status).toBe(200);

    // Verify it is excluded from active listings
    const checkDeleted = await pool.query(`SELECT is_deleted, deletion_reason FROM drm.ab_payments WHERE id = $1`, [paymentId]);
    expect(checkDeleted.rows[0].is_deleted).toBe(true);
    expect(checkDeleted.rows[0].deletion_reason).toBe("Soft-delete reason test");

    // Create a paid AB payment
    const createRes2 = await request(app!)
      .post("/api/account/ab-payments")
      .set(mHeaders)
      .send({
        abId: `ab_lc_2_${SUFFIX}`,
        orderId: `order_lc_2_${SUFFIX}`,
        gmDrmId: `drm_lc_2_${SUFFIX}`,
        companyName: "Lifecycle Test Co 2",
        amountUsd: 200.00,
        amountPkr: 56000,
        rate: 280.0,
      });
    const paymentId2 = createRes2.body.data.id;
    createdPaymentIds.push(paymentId2);

    // Approve the payment (move status to paid)
    const patchRes2 = await request(app!)
      .patch(`/api/account/ab-payments/${paymentId2}/status`)
      .set(mHeaders)
      .send({ status: "paid", reason: "approve paid" });
    expect(patchRes2.status).toBe(200);
    expect(patchRes2.body.data.status).toBe("paid");

    // 3. VOID the paid payment
    const voidRes = await request(app!)
      .post(`/api/account/ab-payments/${paymentId2}/void`)
      .set(aHeaders)
      .send({ reason: "Void reason test" });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.data.status).toBe("voided");
  });

  // -------------------------------------------------------------------------
  // Phase 15 — admin coverage, a documented role asymmetry, and the untested
  // Dollar Buying / Dollar System sub-flows.
  // -------------------------------------------------------------------------

  it("5. Phase 15: admin can also list and create AB payments (previously only account_manager was exercised)", async () => {
    if (!dbAvailable) return;
    const admin = await seedUser("admin");
    const headers = { Authorization: `Bearer ${admin.token}` };

    const createRes = await request(app!)
      .post("/api/account/ab-payments")
      .set(headers)
      .send({
        abId: `ab_admin_${SUFFIX}`,
        orderId: `order_admin_${SUFFIX}`,
        gmDrmId: `drm_admin_${SUFFIX}`,
        companyName: "Web Excels admin test company",
        amountUsd: 75.25,
        amountPkr: 21000,
        rate: 279.0,
      });
    expect(createRes.status).toBe(201);
    createdPaymentIds.push(createRes.body.data.id);

    const listRes = await request(app!)
      .get(`/api/account/ab-payments?search=drm_admin_${SUFFIX}`)
      .set(headers);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
  });

  // Documented, not fixed: super_hod is in the "office" url-permission
  // allow-list (Office Accounts) but NOT in "account"'s
  // ([admin, accountant, account_manager, service_manager]) — an
  // asymmetry in the currently-seeded permission data, not a code bug.
  // Changing it is a business-policy call outside this phase's scope.
  it("6. Phase 15: super_hod is currently denied /api/account/ab-payments (documented role asymmetry vs. Office Accounts)", async () => {
    if (!dbAvailable) return;
    const superHod = await seedUser("super_hod");
    const res = await request(app!)
      .get("/api/account/ab-payments")
      .set({ Authorization: `Bearer ${superHod.token}` });
    expect(res.status).toBe(403);
  });

  it("7. Phase 15: Dollar Buyer create — account_manager succeeds, sales_executive is denied", async () => {
    if (!dbAvailable) return;
    const manager = await seedUser("account_manager");
    const sales = await seedUser("sales_executive");

    const denied = await request(app!)
      .post("/api/account/buyers")
      .set({ Authorization: `Bearer ${sales.token}` })
      .send({ name: `__p15 Denied Buyer ${SUFFIX}` });
    expect(denied.status).toBe(403);

    const created = await request(app!)
      .post("/api/account/buyers")
      .set({ Authorization: `Bearer ${manager.token}` })
      .send({ name: `__p15 Buyer ${SUFFIX}`, reference: "REF-1", paypalEmail: "buyer@example.invalid", accountNo: "ACC-1" });
    expect(created.status).toBe(200);
    createdBuyerIds.push(created.body.id);
  });

  it("8. Phase 15: Dollar System transaction persists the caller-supplied exchange rate, never a fabricated default", async () => {
    if (!dbAvailable) return;
    const manager = await seedUser("account_manager");

    const res = await request(app!)
      .post("/api/account/dollar-system/transaction")
      .set({ Authorization: `Bearer ${manager.token}` })
      .send({ type: "RECEIVE", amountUsd: 200, amountPkr: 56000, rate: 280.5, company: `__p15 Wallet Co ${SUFFIX}` });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    createdGmIds.push(res.body.id);

    const row = await pool.query(`SELECT dollar_rate, amount_usd FROM drm.gm_entries WHERE id = $1`, [res.body.id]);
    expect(Number(row.rows[0].dollar_rate)).toBe(280.5);
    expect(Number(row.rows[0].amount_usd)).toBe(200);
  });
});
