/**
 * Phase 12 — Product Posting, PMS, QA, and Workflow Dependency UAT.
 *
 * Route-level UAT for the Software workflow (server/routes/software-workflow-routes.ts).
 * This module shares the same fail-closed transition engine as Product
 * Posting (server/services/workflow-transition.service.ts) but previously had
 * zero route-level test coverage — only the shared engine's generic unit
 * tests touched it indirectly. Mirrors product-posting-workflow-uat.test.ts.
 * Soft-skips if the dev Postgres pool is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import { ensureSoftwareWorkflowInfrastructure } from "./services/software-workflow.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Software workflow — Phase 12 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdWorkflowIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p12sw_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  async function seedProject(): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.projects (name, status) VALUES ($1, 'Active') RETURNING id`,
      [`__p12sw project ${SUFFIX}_${createdProjectIds.length}`],
    );
    const id = String(r.rows[0].id);
    createdProjectIds.push(id);
    return id;
  }

  async function seedTask(projectId: string, ownerUserId: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.tasks (project_id, title, owner_user_id, status)
       VALUES ($1, $2, $3, 'ToDo') RETURNING id`,
      [projectId, `__p12sw task ${SUFFIX}_${createdTaskIds.length}`, ownerUserId],
    );
    const id = String(r.rows[0].id);
    createdTaskIds.push(id);
    return id;
  }

  async function seedWorkflow(projectId: string, taskId: string, currentPhase: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.software_workflows (project_id, task_id, current_phase)
       VALUES ($1, $2, $3) RETURNING id`,
      [projectId, taskId, currentPhase],
    );
    const id = String(r.rows[0].id);
    createdWorkflowIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let admin: SeededUser;

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
    // The software_workflows table is created lazily on first request to
    // /api/software/*; ensure it exists before seeding rows directly via SQL.
    await ensureSoftwareWorkflowInfrastructure();

    admin = await seedUser("admin");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdWorkflowIds.length) {
          await pool.query(`DELETE FROM drm.software_workflows WHERE id = ANY($1::uuid[])`, [
            createdWorkflowIds,
          ]);
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
      console.warn("[software-workflow-uat.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("rejects a direct skip straight to verification-complete on a workflow still at RUNNING_PROJECT", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const projectId = await seedProject();
    const taskId = await seedTask(projectId, admin.id);
    await seedWorkflow(projectId, taskId, "RUNNING_PROJECT");

    const res = await request(app)
      .post(`/api/software/tasks/${taskId}/verification-review`)
      .set(auth(admin.token))
      .send({ action: "complete" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WORKFLOW_ILLEGAL_TRANSITION");
  });

  it("rejects a verification-review attempt by a role outside verification_manager/admin", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const projectId = await seedProject();
    const taskId = await seedTask(projectId, admin.id);
    await seedWorkflow(projectId, taskId, "VERIFICATION_PENDING");

    const wrongRole = await seedUser("software_executive");
    const res = await request(app)
      .post(`/api/software/tasks/${taskId}/verification-review`)
      .set(auth(wrongRole.token))
      .send({ action: "complete" });

    expect(res.status).toBe(403);
  });

  it("allows the real QA-review-complete transition once a workflow has genuinely reached QA_REVIEW", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const projectId = await seedProject();
    const taskId = await seedTask(projectId, admin.id);
    await seedWorkflow(projectId, taskId, "QA_REVIEW");

    const res = await request(app)
      .post(`/api/software/tasks/${taskId}/qa-review`)
      .set(auth(admin.token))
      .send({ action: "complete", remarks: "looks good" });

    expect(res.status).toBe(200);
    expect(res.body.data.currentPhase).toBe("VERIFICATION_PENDING");
  });
});
