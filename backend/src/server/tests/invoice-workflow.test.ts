/**
 * Phase 4 — Canonical Invoice Workflow and Legacy Invoice Cleanup.
 *
 * Two groups of coverage:
 *  1. Pure unit tests for the new legacy-invoice transition guard
 *     (assertLegalInvoiceStatusTransition / assertPaymentProofForPaid) — no DB.
 *  2. DB-backed HTTP tests (soft-skip if the dev Postgres pool is unreachable,
 *     mirroring patch5-stage7-role-matrix.test.ts / penalty-routes.test.ts)
 *     proving: stage skipping is rejected on the canonical invoice state
 *     machine, wrong-role approval attempts are 403, rejection requires a
 *     reason, the legacy transition guard rejects illegal jumps, and the
 *     deprecated legacy status endpoint is blocked.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import {
  assertLegalInvoiceStatusTransition,
  assertPaymentProofForPaid,
} from "./utils/financial-validation";
import { ApiError } from "./utils/api-error";

describe("assertLegalInvoiceStatusTransition (legacy drm.invoices guard)", () => {
  it("allows Draft -> Sent", () => {
    expect(assertLegalInvoiceStatusTransition("Draft", "Sent")).toBe("Sent");
  });
  it("allows a no-op (same status)", () => {
    expect(assertLegalInvoiceStatusTransition("Sent", "Sent")).toBe("Sent");
  });
  it("rejects Paid -> Draft (un-paying an invoice)", () => {
    expect(() => assertLegalInvoiceStatusTransition("Paid", "Draft")).toThrow(ApiError);
  });
  it("rejects Cancelled -> anything (terminal state)", () => {
    expect(() => assertLegalInvoiceStatusTransition("Cancelled", "Sent")).toThrow(ApiError);
  });
  it("rejects an unknown target status", () => {
    expect(() => assertLegalInvoiceStatusTransition("Draft", "Approved")).toThrow(ApiError);
  });
});

describe("assertPaymentProofForPaid (legacy drm.invoices guard)", () => {
  it("rejects marking Paid with no payment method (incoming or existing)", () => {
    expect(() => assertPaymentProofForPaid("Paid", {})).toThrow(ApiError);
  });
  it("accepts marking Paid with an incoming payment method", () => {
    expect(() => assertPaymentProofForPaid("Paid", { paymentMethod: "Bank Transfer" })).not.toThrow();
  });
  it("accepts marking Paid when a payment method already exists on the record", () => {
    expect(() =>
      assertPaymentProofForPaid("Paid", { existingPaymentMethod: "Cheque" }),
    ).not.toThrow();
  });
  it("is a no-op for non-Paid targets even with no payment method", () => {
    expect(() => assertPaymentProofForPaid("Sent", {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// HTTP-level: canonical state-machine + legacy-guard behavior against the real
// app. Soft-skips if the dev Postgres pool is unreachable.
// ---------------------------------------------------------------------------
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";
import { patchConfig } from "./services/gm-sales-config.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Invoice workflow — stage skipping, wrong-role approval, legacy guard", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdLegacyInvoiceIds: string[] = [];
  const createdProjectIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p4_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  async function seedCustomer(): Promise<string> {
    const email = `__p4_cust_${SUFFIX}_${createdCustomerIds.length}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`__p4 Co ${SUFFIX}`, "Test Account", email, "0000000000", "Lahore", "A"],
    );
    const id = String(r.rows[0].id);
    createdCustomerIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let salesExec: SeededUser;
  let hod: SeededUser;
  let accountManager: SeededUser;
  let admin: SeededUser;
  let customerId: string;

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

    salesExec = await seedUser("sales_executive");
    hod = await seedUser("hod");
    accountManager = await seedUser("account_manager");
    admin = await seedUser("admin");
    customerId = await seedCustomer();
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.notifications WHERE user_id = ANY($1::uuid[])`, [createdUserIds]);
        }
        if (createdProjectIds.length) {
          await pool.query(`DELETE FROM drm.projects WHERE id = ANY($1::uuid[])`, [createdProjectIds]);
        }
        if (createdInvoiceIds.length) {
          await pool.query(`DELETE FROM drm.product_posting_invoices WHERE id = ANY($1::uuid[])`, [createdInvoiceIds]);
        }
        if (createdLegacyInvoiceIds.length) {
          await pool.query(`DELETE FROM drm.invoices WHERE id = ANY($1::uuid[])`, [createdLegacyInvoiceIds]);
        }
        if (createdCustomerIds.length) {
          await pool.query(`DELETE FROM drm.customers WHERE id = ANY($1::uuid[])`, [createdCustomerIds]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[invoice-workflow.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("creates a canonical invoice (lands in PENDING_HOD, per documented default)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .post("/api/invoices")
      .set(auth(salesExec.token))
      .send({ customerId, amount: 100, invoiceType: "LISTING_PAGE" });
    expect(res.status).toBe(201);
    expect(res.body?.data?.status).toBe("PENDING_HOD");
    createdInvoiceIds.push(res.body.data.id);
  });

  it("rejects stage skipping: account-approve on a PENDING_HOD invoice (must go through HOD first)", async () => {
    if (!dbAvailable || !app || !createdInvoiceIds.length) { expect(true).toBe(true); return; }
    const id = createdInvoiceIds[0];
    const res = await request(app)
      .post(`/api/invoices/${id}/account-approve`)
      .set(auth(accountManager.token));
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(200);
  });

  it("rejects a sales_executive attempting hod-approve with 403", async () => {
    if (!dbAvailable || !app || !createdInvoiceIds.length) { expect(true).toBe(true); return; }
    const id = createdInvoiceIds[0];
    const res = await request(app)
      .post(`/api/invoices/${id}/hod-approve`)
      .set(auth(salesExec.token));
    expect(res.status).toBe(403);
  });

  it("rejects a hod attempting account-approve with 403 (wrong stage owner)", async () => {
    if (!dbAvailable || !app || !createdInvoiceIds.length) { expect(true).toBe(true); return; }
    const id = createdInvoiceIds[0];
    const res = await request(app)
      .post(`/api/invoices/${id}/account-approve`)
      .set(auth(hod.token));
    expect(res.status).toBe(403);
  });

  it("hod-approve advances PENDING_HOD -> PENDING_ACCOUNT, then account-approve completes it", async () => {
    if (!dbAvailable || !app || !createdInvoiceIds.length) { expect(true).toBe(true); return; }
    const id = createdInvoiceIds[0];
    const approveRes = await request(app)
      .post(`/api/invoices/${id}/hod-approve`)
      .set(auth(hod.token));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body?.data?.status).toBe("PENDING_ACCOUNT");

    const accountRes = await request(app)
      .post(`/api/invoices/${id}/account-approve`)
      .set(auth(accountManager.token));
    expect(accountRes.status).toBe(200);
    expect(accountRes.body?.data?.status).toBe("APPROVED");
  });

  it("rejects hod-reject with no reason (separate invoice, still at PENDING_HOD)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const createRes = await request(app)
      .post("/api/invoices")
      .set(auth(salesExec.token))
      .send({ customerId, amount: 50, invoiceType: "MINIWEBSITE" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;
    createdInvoiceIds.push(id);

    const rejectRes = await request(app)
      .post(`/api/invoices/${id}/hod-reject`)
      .set(auth(hod.token))
      .send({});
    expect(rejectRes.status).toBe(400);
  });

  it("accepts hod-reject with a reason", async () => {
    if (!dbAvailable || !app || createdInvoiceIds.length < 2) { expect(true).toBe(true); return; }
    const id = createdInvoiceIds[1];
    const rejectRes = await request(app)
      .post(`/api/invoices/${id}/hod-reject`)
      .set(auth(hod.token))
      .send({ reason: "Missing supporting documents" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body?.data?.status).toBe("REJECTED");
  });

  it("legacy drm.invoices: rejects an illegal status jump (Paid -> Draft) via the general PATCH", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const r = await pool.query(
      `INSERT INTO drm.invoices (invoice_number, customer_name, subtotal, total, items, created_by_user_id, status)
       VALUES ($1, $2, 100, 100, '[]', $3, 'Paid') RETURNING id`,
      [`__P4-${SUFFIX}-1`, "Legacy Test Co", admin.id],
    );
    const id = String(r.rows[0].id);
    createdLegacyInvoiceIds.push(id);

    const res = await request(app)
      .patch(`/api/account/invoices/${id}`)
      .set(auth(admin.token))
      .send({ status: "Draft" });
    expect(res.status).toBe(400);
  });

  it("legacy drm.invoices: allows a legal transition (Draft -> Sent) via the general PATCH", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const r = await pool.query(
      `INSERT INTO drm.invoices (invoice_number, customer_name, subtotal, total, items, created_by_user_id, status)
       VALUES ($1, $2, 100, 100, '[]', $3, 'Draft') RETURNING id`,
      [`__P4-${SUFFIX}-2`, "Legacy Test Co", admin.id],
    );
    const id = String(r.rows[0].id);
    createdLegacyInvoiceIds.push(id);

    const res = await request(app)
      .patch(`/api/account/invoices/${id}`)
      .set(auth(admin.token))
      .send({ status: "Sent" });
    expect(res.status).toBe(200);
  });

  it("legacy drm.invoices: requires a payment method to mark Paid", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const r = await pool.query(
      `INSERT INTO drm.invoices (invoice_number, customer_name, subtotal, total, items, created_by_user_id, status)
       VALUES ($1, $2, 100, 100, '[]', $3, 'Sent') RETURNING id`,
      [`__P4-${SUFFIX}-3`, "Legacy Test Co", admin.id],
    );
    const id = String(r.rows[0].id);
    createdLegacyInvoiceIds.push(id);

    const noProofRes = await request(app)
      .patch(`/api/account/invoices/${id}`)
      .set(auth(admin.token))
      .send({ status: "Paid" });
    expect(noProofRes.status).toBe(400);

    const withProofRes = await request(app)
      .patch(`/api/account/invoices/${id}`)
      .set(auth(admin.token))
      .send({ status: "Paid", paymentMethod: "Bank Transfer" });
    expect(withProofRes.status).toBe(200);
  });

  it("legacy PATCH /:id/status is deprecated and blocked with 410", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .patch("/api/account/invoices/00000000-0000-0000-0000-000000000000/status")
      .set(auth(admin.token))
      .send({ status: "Paid" });
    expect(res.status).toBe(410);
  });

  // -------------------------------------------------------------------------
  // D-017 (2026-07-21): amount 0 is legitimate for a genuinely free invoice,
  // not just an unfilled auto-generated placeholder -- see
  // docs/completion/DECISION_LOG.md D-017.
  // -------------------------------------------------------------------------
  async function seedProductPostingInvoice(opts: {
    salesExecId: string;
    customerId: string;
    status: string;
    paymentMethod?: string | null;
  }): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.product_posting_invoices
         (amount, sales_exec_id, customer_id, project_name, company_name, status, service_type, payment_method)
       VALUES (0, $1, $2, 'Alibaba Product Posting', $3, $4, 'Alibaba Product Posting', $5)
       RETURNING id`,
      [opts.salesExecId, opts.customerId, `__p4 free-test Co ${SUFFIX}`, opts.status, opts.paymentMethod ?? null],
    );
    const id = String(r.rows[0].id);
    createdInvoiceIds.push(id);
    return id;
  }

  it("D-017: still rejects a zero-amount invoice at the Account stage when it is not marked Free (placeholder guard unchanged)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_ACCOUNT",
    });
    const res = await request(app)
      .post(`/api/invoices/${id}/account-approve`)
      .set(auth(accountManager.token));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/amount/i);
  });

  it("D-017: approves a zero-amount invoice already marked Free at both HOD and Account stages", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_HOD",
      paymentMethod: "free",
    });
    const hodRes = await request(app)
      .post(`/api/invoices/${id}/hod-approve`)
      .set(auth(hod.token));
    expect(hodRes.status).toBe(200);
    expect(hodRes.body?.data?.status).toBe("PENDING_ACCOUNT");

    const accountRes = await request(app)
      .post(`/api/invoices/${id}/account-approve`)
      .set(auth(accountManager.token));
    expect(accountRes.status).toBe(200);
    expect(accountRes.body?.data?.status).toBe("APPROVED");
  });

  it("D-017: the Account Manager's pending-quotations approve marks a zero-amount invoice Free and persists it", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_ACCOUNT",
    });
    const res = await request(app)
      .post(`/api/account/pending-quotations/${id}/approve`)
      .set(auth(accountManager.token))
      .send({ action: "approve", paymentMethod: "free" });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT status, payment_method FROM drm.product_posting_invoices WHERE id = $1`,
      [id],
    );
    expect(rows[0]?.status).toBe("APPROVED");
    expect(rows[0]?.payment_method).toBe("free");
  });

  // -------------------------------------------------------------------------
  // D-018 (2026-07-22): the Account-stage approval notification was gated
  // behind PMS project-creation being a brand-new create (genResult.created),
  // so once a project had ever been linked to an invoice (including from an
  // earlier, since-fixed approval attempt on the same invoice), the Sales
  // Executive was never notified again and the last notification they had
  // (e.g. the HOD-stage one) stayed stale. See docs/completion/DECISION_LOG.md
  // D-018.
  // -------------------------------------------------------------------------
  async function getNotifications(userId: string, entityId: string) {
    const { rows } = await pool.query(
      `SELECT message, read_status, entity_type, entity_id FROM drm.notifications
         WHERE user_id = $1 AND entity_id = $2 ORDER BY created_at ASC`,
      [userId, entityId],
    );
    return rows;
  }

  it("D-018: legacy HOD-stage approval notifies the sales exec with a taggable (entityType/entityId) notification", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_HOD",
    });
    const res = await request(app)
      .post(`/api/hod/approvals/${id}/approve`)
      .set(auth(hod.token));
    expect(res.status).toBe(200);

    const notifs = await getNotifications(salesExec.id, id);
    expect(notifs.length).toBe(1);
    expect(notifs[0].message).toMatch(/approved by the HOD/i);
    expect(notifs[0].read_status).toBe("UNREAD");
    expect(notifs[0].entity_type).toBe("INVOICE");
  });

  it("D-018: Account-stage approval unconditionally notifies the sales exec and supersedes the prior HOD notification", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    // This scenario asserts a project actually gets created (and its "project
    // has been created" notification fires) on account-approval, which only
    // happens in AUTOMATIC projectGenerationMode -- the default is MANUAL.
    // (Both /api/invoices/:id/account-approve and this pending-quotations
    // endpoint now honor the same config, so this must be set explicitly
    // rather than relying on the old always-auto-create behavior.)
    await patchConfig({ projectGenerationMode: "AUTOMATIC" }, undefined);
    try {
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_HOD",
    });
    const hodRes = await request(app)
      .post(`/api/hod/approvals/${id}/approve`)
      .set(auth(hod.token));
    expect(hodRes.status).toBe(200);

    const accountRes = await request(app)
      .post(`/api/account/pending-quotations/${id}/approve`)
      .set(auth(accountManager.token))
      .send({ action: "approve", paymentMethod: "free" });
    expect(accountRes.status).toBe(200);

    // This approval is a genuine first-time creation, so a real PMS project
    // gets auto-generated -- track it for cleanup (drm.projects.invoice_id
    // FK-references this invoice, so it must be deleted before afterAll's
    // product_posting_invoices cleanup).
    const projRow = await pool.query(`SELECT id FROM drm.projects WHERE invoice_id = $1`, [id]);
    if (projRow.rows[0]?.id) createdProjectIds.push(String(projRow.rows[0].id));

    const notifs = await getNotifications(salesExec.id, id);
    // 3 notifications, in creation order: the original HOD one (now
    // superseded/read); the pre-existing, separate "project has been created"
    // one from the project-generation service, fired while creating the PMS
    // project (fixed alongside this to be taggable too -- see
    // DECISION_LOG.md D-018 -- but intentionally left in place: it is the
    // ONLY notification the sales exec gets when a project is generated later
    // via the manual POST /:invoiceId/generate-project retry endpoint, so
    // removing it here would silently lose that information for that path);
    // and finally the new unconditional "fully approved" one this fix adds,
    // created last so the supersede-prior-notifications step (which runs
    // before project generation) can never mark it -- or the project-created
    // one -- as read by mistake.
    expect(notifs.length).toBe(3);
    expect(notifs[0].message).toMatch(/approved by the HOD/i);
    expect(notifs[0].read_status).toBe("READ");
    expect(notifs[1].message).toMatch(/project.*has been created/i);
    expect(notifs[1].entity_type).toBe("INVOICE");
    expect(notifs[2].message).toMatch(/fully approved by the Account Manager/i);
    expect(notifs[2].message).toMatch(/upload the required documents/i);
    expect(notifs[2].read_status).toBe("UNREAD");
    } finally {
      await patchConfig({ projectGenerationMode: "MANUAL" }, undefined);
    }
  });

  it("D-018: Account-stage approval still notifies the sales exec even when a project was already linked from an earlier attempt", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const id = await seedProductPostingInvoice({
      salesExecId: salesExec.id,
      customerId,
      status: "PENDING_ACCOUNT",
    });
    // Simulate an earlier (already-completed) approval attempt on this exact
    // invoice having already created/linked a PMS project -- reproducing the
    // real-world scenario found during investigation, where
    // createOrLinkProjectForApprovedInvoice's idempotency check (keyed only on
    // invoice_id) would make every later approval see created:false forever.
    const projRes = await pool.query(
      `INSERT INTO drm.projects (invoice_id, customer_id, name, owner_user_id, project_type, status)
         VALUES ($1, $2, 'Pre-existing linked project', $3, 'INVOICE_ROOT', 'Active') RETURNING id`,
      [id, customerId, salesExec.id],
    );
    createdProjectIds.push(String(projRes.rows[0].id));

    const res = await request(app)
      .post(`/api/account/pending-quotations/${id}/approve`)
      .set(auth(accountManager.token))
      .send({ action: "approve", paymentMethod: "free" });
    expect(res.status).toBe(200);

    const notifs = await getNotifications(salesExec.id, id);
    expect(notifs.length).toBe(1);
    expect(notifs[0].message).toMatch(/fully approved by the Account Manager/i);
    expect(notifs[0].message).toMatch(/upload the required documents/i);
    expect(notifs[0].read_status).toBe("UNREAD");
  });
});
