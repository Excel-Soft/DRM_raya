/**
 * Phase 5 — Invoice/GM to Project Creation Standardization.
 *
 * Duplicate-prevention coverage for the new idempotent InvoiceToProjectService
 * functions (createOrLinkProjectForGm, createOrLinkProjectForLegacySource),
 * plus HTTP-level role-gate coverage for the two legacy routes that used to be
 * open to any authenticated user. Soft-skips if the dev Postgres pool is
 * unreachable, mirroring invoice-workflow.test.ts / patch5-stage7-role-matrix.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import {
  createOrLinkProjectForGm,
  createOrLinkProjectForLegacySource,
} from "./services/invoice-to-project.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Project creation — duplicate prevention and role gates (Phase 5)", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdGmEntryIds: string[] = [];
  const createdQuotationIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p5_${role}_${SUFFIX}_${createdUserIds.length}`;
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
    const email = `__p5_cust_${SUFFIX}_${createdCustomerIds.length}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`__p5 Co ${SUFFIX}`, "Test Account", email, "0000000000", "Lahore", "A"],
    );
    const id = String(r.rows[0].id);
    createdCustomerIds.push(id);
    return id;
  }

  async function seedGmEntry(salesPersonId: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.gm_entries (drm_id, company_name, package_type, entry_type, amount_usd, amount, sales_person_id, created_by)
       VALUES ($1, $2, 'Standard', 'GM', 100, 100, $3, $3) RETURNING id`,
      [`__p5-gm-${SUFFIX}-${createdGmEntryIds.length}`, `__p5 GM Co ${SUFFIX}`, salesPersonId],
    );
    const id = String(r.rows[0].id);
    createdGmEntryIds.push(id);
    return id;
  }

  async function seedQuotation(createdBy: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.quotations (account_holder, company, created_by, save_status)
       VALUES ($1, $2, $3, 'pending_account_manager') RETURNING id`,
      [`__p5 Holder ${SUFFIX}`, `__p5 Quote Co ${SUFFIX}`, createdBy],
    );
    const id = String(r.rows[0].id);
    createdQuotationIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let salesExec: SeededUser;
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
    accountManager = await seedUser("account_manager");
    admin = await seedUser("admin");
    customerId = await seedCustomer();
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdProjectIds.length) {
          await pool.query(
            `DELETE FROM drm.project_financials WHERE project_id = ANY($1::uuid[])`,
            [createdProjectIds],
          );
          await pool.query(
            `DELETE FROM drm.project_payments WHERE project_id = ANY($1::uuid[])`,
            [createdProjectIds],
          );
          await pool.query(`DELETE FROM drm.projects WHERE id = ANY($1::uuid[])`, [createdProjectIds]);
        }
        if (createdGmEntryIds.length) {
          await pool.query(`DELETE FROM drm.gm_entries WHERE id = ANY($1::uuid[])`, [createdGmEntryIds]);
        }
        if (createdQuotationIds.length) {
          await pool.query(`DELETE FROM drm.quotations WHERE id = ANY($1::uuid[])`, [createdQuotationIds]);
        }
        if (createdCustomerIds.length) {
          await pool.query(`DELETE FROM drm.customers WHERE id = ANY($1::uuid[])`, [createdCustomerIds]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[project-creation.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("createOrLinkProjectForGm: calling twice for the same GM produces exactly one project", async () => {
    if (!dbAvailable) { expect(true).toBe(true); return; }
    const gmId = await seedGmEntry(salesExec.id);

    const first = await createOrLinkProjectForGm({
      gmId,
      customerId,
      ownerUserId: salesExec.id,
      name: "Test GM Project",
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(first.projectId).toBeTruthy();
    createdProjectIds.push(first.projectId!);

    const second = await createOrLinkProjectForGm({
      gmId,
      customerId,
      ownerUserId: salesExec.id,
      name: "Test GM Project",
    });
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(second.linked).toBe(true);
    expect(second.projectId).toBe(first.projectId);

    const countRes = await pool.query(
      `SELECT count(*)::int AS c FROM drm.projects WHERE gm_id = $1`,
      [gmId],
    );
    expect(countRes.rows[0].c).toBe(1);
  });

  it("createOrLinkProjectForLegacySource: calling twice for the same source produces exactly one project", async () => {
    if (!dbAvailable) { expect(true).toBe(true); return; }
    const quotationId = await seedQuotation(salesExec.id);

    const first = await createOrLinkProjectForLegacySource({
      sourceId: quotationId,
      customerId,
      ownerUserId: salesExec.id,
      name: "Test Quotation Project",
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    createdProjectIds.push(first.projectId!);

    const second = await createOrLinkProjectForLegacySource({
      sourceId: quotationId,
      customerId,
      ownerUserId: salesExec.id,
      name: "Test Quotation Project",
    });
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(second.projectId).toBe(first.projectId);

    const countRes = await pool.query(
      `SELECT count(*)::int AS c FROM drm.projects WHERE legacy_source_id = $1`,
      [quotationId],
    );
    expect(countRes.rows[0].c).toBe(1);
  });

  it("create-project-from-gm rejects a non-account_manager/admin role with 403", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .post("/api/account/create-project-from-gm")
      .set(auth(salesExec.token))
      .send({ gmId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(403);
  });

  it("pending-quotations/:id/approve rejects a non-account_manager/admin role with 403", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .post("/api/account/pending-quotations/00000000-0000-0000-0000-000000000000/approve")
      .set(auth(salesExec.token))
      .send({ action: "approve" });
    expect(res.status).toBe(403);
  });

  it("create-project-from-gm (GM source) end-to-end: repeated calls link instead of duplicating", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const gmId = await seedGmEntry(salesExec.id);

    const firstRes = await request(app)
      .post("/api/account/create-project-from-gm")
      .set(auth(accountManager.token))
      .send({ gmId, projectName: "Test GM Project E2E" });
    expect(firstRes.status).toBe(201);
    expect(firstRes.body?.success).toBe(true);
    expect(firstRes.body?.created).toBe(true);
    const projectId = firstRes.body.projectId;
    createdProjectIds.push(projectId);

    const secondRes = await request(app)
      .post("/api/account/create-project-from-gm")
      .set(auth(accountManager.token))
      .send({ gmId, projectName: "Test GM Project E2E" });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body?.created).toBe(false);
    expect(secondRes.body?.projectId).toBe(projectId);

    const countRes = await pool.query(
      `SELECT count(*)::int AS c FROM drm.projects WHERE gm_id = $1`,
      [gmId],
    );
    expect(countRes.rows[0].c).toBe(1);
  });
});
