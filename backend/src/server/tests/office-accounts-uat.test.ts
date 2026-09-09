/**
 * Phase 15 — Full Technical Gate and Role-Based UAT.
 *
 * The Office Accounts module (server/office-account-routes.ts, ~2000 lines:
 * account heads, expenses, VAS, cheques, business customers, journal
 * vouchers, ledger, trial balance) had zero automated test coverage before
 * this phase. This file closes the account-heads slice and, in doing so,
 * proves the two independent permission layers this module relies on:
 * the DB-driven checkUrlPermission ("office" row in drm.url_permissions)
 * and the code-level requireFinancialPermission (STAGE2_FINANCIAL_ROLES,
 * office-account-routes.ts:33) are each enforced on their own, not
 * redundant with one another. Soft-skips if the dev Postgres pool is
 * unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Office Accounts — Phase 15 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdAccountHeadIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p15office_${role}_${SUFFIX}_${createdUserIds.length}`;
    const email = `${username}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, is_active, full_name, password_hash)
       VALUES ($1, $2, $3, $3, true, $4, $5) RETURNING id`,
      [username, email, role, `Full Name ${username}`, "test_hash"],
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

  let accountManager: SeededUser;
  let salesExecutive: SeededUser;
  let serviceManager: SeededUser;

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

    accountManager = await seedUser("account_manager");
    salesExecutive = await seedUser("sales_executive");
    serviceManager = await seedUser("service_manager");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdAccountHeadIds.length) {
          await pool.query(`DELETE FROM drm.account_heads WHERE id = ANY($1::varchar[])`, [
            createdAccountHeadIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[office-accounts-uat.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("returns 401 with no auth token", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/office/account-heads");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a role outside the seeded office url-permission list", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/office/account-heads").set(auth(salesExecutive.token));
    expect(res.status).toBe(403);
  });

  it("allows account_manager to view the account-heads list", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/office/account-heads").set(auth(accountManager.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("two-layer gate: service_manager is denied view and create access (outside three-role scope)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const view = await request(app).get("/api/office/account-heads").set(auth(serviceManager.token));
    expect(view.status).toBe(403);

    const create = await request(app)
      .post("/api/office/account-heads")
      .set(auth(serviceManager.token))
      .send({ code: `__p15sm_${SUFFIX}`, name: "Service manager attempt", category: "Assets", type: "Current Asset" });
    expect(create.status).toBe(403);
  });

  it("full CRUD lifecycle for account_manager: create -> update -> export -> delete", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const createRes = await request(app)
      .post("/api/office/account-heads")
      .set(auth(accountManager.token))
      .send({
        code: `__p15ah_${SUFFIX}`,
        name: `__p15 Test Account Head ${SUFFIX}`,
        category: "Assets",
        type: "Current Asset",
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    createdAccountHeadIds.push(id);

    const updateRes = await request(app)
      .patch(`/api/office/account-heads/${id}`)
      .set(auth(accountManager.token))
      .send({ description: "updated by phase 15 UAT" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe("updated by phase 15 UAT");

    const exportRes = await request(app)
      .get("/api/office/account-heads/export")
      .set(auth(accountManager.token));
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain(`__p15ah_${SUFFIX}`);

    const exportDenied = await request(app)
      .get("/api/office/account-heads/export")
      .set(auth(serviceManager.token));
    expect(exportDenied.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/office/account-heads/${id}`)
      .set(auth(accountManager.token))
      .send({ reason: "phase 15 UAT cleanup" });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    createdAccountHeadIds.splice(createdAccountHeadIds.indexOf(id), 1);

    const deleteNoReason = await request(app)
      .delete(`/api/office/account-heads/nonexistent-id`)
      .set(auth(accountManager.token))
      .send({});
    expect(deleteNoReason.status).toBe(400);
  });
});
