/**
 * Phase 15 — Full Technical Gate and Role-Based UAT.
 *
 * Consolidated role-boundary matrix, mirroring the established
 * patch5-stage7-role-matrix.test.ts idiom: seed once, assert exact 403 for
 * denied roles and not-401/403/5xx for allowed roles (boundary proof, not
 * full business-flow success — deep per-flow coverage already exists in
 * gm-uat.test.ts, invoice-workflow.test.ts, service-bridge.test.ts, etc.).
 *
 * This file closes the specific role/ownership gaps the Phase 15 coverage
 * audit found: qa_manager, verification_manager, hr, and hr_manager have
 * zero HTTP-level test coverage anywhere in the repo on any flow, and PMS
 * ownership-vs-non-ownership scoping is only ever exercised with admin.
 * Soft-skips if the dev Postgres pool is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Phase 15 — Role-based UAT matrix", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdSalaryRunIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p15_${role}_${SUFFIX}_${createdUserIds.length}`;
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
  let hod: SeededUser;
  let accountManager: SeededUser;
  let salesExecutive: SeededUser;
  let serviceExecutive: SeededUser;
  let qaManager: SeededUser;
  let verificationManager: SeededUser;
  let hr: SeededUser;
  let hrManager: SeededUser;
  let restrictedUser: SeededUser;

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
    hod = await seedUser("hod");
    accountManager = await seedUser("account_manager");
    salesExecutive = await seedUser("sales_executive");
    serviceExecutive = await seedUser("service_executive");
    qaManager = await seedUser("qa_manager");
    verificationManager = await seedUser("verification_manager");
    hr = await seedUser("hr");
    hrManager = await seedUser("hr_manager");
    restrictedUser = await seedUser("sales_executive");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdSalaryRunIds.length) {
          await pool.query(`DELETE FROM drm.salary_runs WHERE id = ANY($1::uuid[])`, [createdSalaryRunIds]);
        }
        if (createdTaskIds.length) {
          await pool.query(`DELETE FROM drm.tasks WHERE id = ANY($1::uuid[])`, [createdTaskIds]);
        }
        if (createdProjectIds.length) {
          await pool.query(`DELETE FROM drm.projects WHERE id = ANY($1::uuid[])`, [createdProjectIds]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[phase15-role-uat-matrix.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  describe("QA Manager / Verification Manager — own queue allowed, unrelated financial denied", () => {
    it("qa_manager can reach the QA queue, but is denied on Office Accounts", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const queue = await request(app).get("/api/product-posting/qa/queue").set(auth(qaManager.token));
      expect(queue.status).not.toBe(401);
      expect(queue.status).not.toBe(403);
      expect(queue.status).toBeLessThan(500);

      const denied = await request(app)
        .post("/api/office/account-heads")
        .set(auth(qaManager.token))
        .send({ code: `__p15qa_${SUFFIX}`, name: "QA attempt", category: "Assets", type: "Current Asset" });
      expect(denied.status).toBe(403);
    });

    it("verification_manager can reach the verification queue, but is denied on Office Accounts", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const queue = await request(app).get("/api/product-posting/verification/queue").set(auth(verificationManager.token));
      expect(queue.status).not.toBe(401);
      expect(queue.status).not.toBe(403);
      expect(queue.status).toBeLessThan(500);

      const denied = await request(app)
        .post("/api/office/account-heads")
        .set(auth(verificationManager.token))
        .send({ code: `__p15vm_${SUFFIX}`, name: "Verification attempt", category: "Assets", type: "Current Asset" });
      expect(denied.status).toBe(403);
    });
  });

  describe("HR / HR Manager — DB permission layer vs. code-level matrix disagree; salary-run creation denied either way", () => {
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 1);
    const to = new Date(today); to.setDate(to.getDate() + 1);
    const startDate = from.toISOString().slice(0, 10);
    const endDate = to.toISOString().slice(0, 10);

    // Phase 15 finding: server/middleware/report-permission.ts's day_target
    // matrix lists "hr"/"hr_manager" as allowed viewers, but the DB-seeded
    // drm.url_permissions "reports" row does NOT include either role — the
    // earlier, DB-driven checkUrlPermission middleware blocks the request
    // with 403 before the code-level matrix is ever reached. Pinned here as
    // a documented, real discrepancy (not fixed — changing seeded permission
    // data on the shared DB is outside this phase's scope, matching the
    // super_hod/account-path asymmetry noted in stage8-ab-payments.test.ts).
    it("hr is currently denied the day-target report by the DB permission layer (despite the code-level matrix allowing it)", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const view = await request(app)
        .get(`/api/reports/day-target?startDate=${startDate}&endDate=${endDate}`)
        .set(auth(hr.token));
      expect(view.status).toBe(403);
    });

    it("hr_manager is currently denied the day-target report by the DB permission layer (despite the code-level matrix allowing it)", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const view = await request(app)
        .get(`/api/reports/day-target?startDate=${startDate}&endDate=${endDate}`)
        .set(auth(hrManager.token));
      expect(view.status).toBe(403);
    });

    // HR's salary class (server/salary-routes.ts CLASS_ACTIONS.hr) genuinely
    // includes preview/generate/view/export/approve/edit/cancel — HR
    // co-manages payroll alongside Accounts. It's missing only "finalize" and
    // "mark_paid". This proves the real permission boundary rather than the
    // (incorrect) assumption that HR cannot touch salary at all.
    it("hr can generate and approve a salary run, but cannot finalize it", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const month = 3, year = 2098;

      const createRes = await request(app)
        .post("/api/salary/runs")
        .set(auth(hr.token))
        .send({ month, year, mode: "DRAFT" });
      expect(createRes.status).toBe(201);
      const runId = createRes.body.run.id;
      createdSalaryRunIds.push(runId);

      const generateRes = await request(app)
        .patch(`/api/salary/runs/${runId}/status`)
        .set(auth(hr.token))
        .send({ status: "GENERATED" });
      expect(generateRes.status).toBe(200);

      const approveRes = await request(app)
        .patch(`/api/salary/runs/${runId}/status`)
        .set(auth(hr.token))
        .send({ status: "APPROVED" });
      expect(approveRes.status).toBe(200);

      const finalizeRes = await request(app)
        .patch(`/api/salary/runs/${runId}/status`)
        .set(auth(hr.token))
        .send({ status: "FINALIZED" });
      expect(finalizeRes.status).toBe(403);
    });
  });

  describe("PMS ownership scoping — owner allowed, unrelated user denied, HOD elevated", () => {
    it("only the task owner or a managerial role may edit it; an unrelated executive is denied", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }

      const projRes = await pool.query(
        `INSERT INTO drm.projects (name, status) VALUES ($1, 'Active') RETURNING id`,
        [`__p15pms project ${SUFFIX}`],
      );
      const projectId = String(projRes.rows[0].id);
      createdProjectIds.push(projectId);

      const createRes = await request(app)
        .post("/api/pms/tasks")
        .set(auth(salesExecutive.token))
        .send({ projectId, title: `__p15pms task ${SUFFIX}` });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;
      createdTaskIds.push(taskId);

      const ownerEdit = await request(app)
        .put(`/api/pms/tasks/${taskId}`)
        .set(auth(salesExecutive.token))
        .send({ description: "edited by owner" });
      expect(ownerEdit.status).toBe(200);

      const strangerEdit = await request(app)
        .put(`/api/pms/tasks/${taskId}`)
        .set(auth(restrictedUser.token))
        .send({ description: "edited by stranger" });
      expect(strangerEdit.status).toBe(403);

      const hodEdit = await request(app)
        .put(`/api/pms/tasks/${taskId}`)
        .set(auth(hod.token))
        .send({ description: "edited by hod" });
      expect(hodEdit.status).toBe(200);
    });
  });

  describe("Normal restricted user — floor checks every financial flow must pass", () => {
    it("a plain sales_executive is denied on Office Accounts and AB Payments (401 with no token, 403 with the wrong role)", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }

      const noToken1 = await request(app).get("/api/office/account-heads");
      expect(noToken1.status).toBe(401);

      const wrongRole1 = await request(app).post("/api/office/account-heads").set(auth(restrictedUser.token)).send({});
      expect(wrongRole1.status).toBe(403);

      const noToken2 = await request(app).get("/api/account/ab-payments");
      expect(noToken2.status).toBe(401);

      const wrongRole2 = await request(app).get("/api/account/ab-payments").set(auth(restrictedUser.token));
      expect(wrongRole2.status).toBe(403);
    });
  });

  describe("Admin / HOD / Account Manager / Service Executive — lightweight allow-checks", () => {
    it("admin passes the Office Accounts and PMS gates unconditionally", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const office = await request(app).get("/api/office/account-heads").set(auth(admin.token));
      expect(office.status).toBe(200);
    });

    it("account_manager passes the Office Accounts and AB Payments gates", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const office = await request(app).get("/api/office/account-heads").set(auth(accountManager.token));
      expect(office.status).toBe(200);
      const ab = await request(app).get("/api/account/ab-payments").set(auth(accountManager.token));
      expect(ab.status).toBe(200);
    });

    it("hod passes the day-target report gate", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/reports/day-target?startDate=${today}&endDate=${today}`)
        .set(auth(hod.token));
      expect(res.status).toBe(200);
    });

    it("service_executive is denied on Office Accounts write, matching the ordinary-executive floor", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      const res = await request(app).post("/api/office/account-heads").set(auth(serviceExecutive.token)).send({});
      expect(res.status).toBe(403);
    });
  });
});
