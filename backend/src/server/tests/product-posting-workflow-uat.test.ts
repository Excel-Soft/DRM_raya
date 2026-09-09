/**
 * Phase 12 — Product Posting, PMS, QA, and Workflow Dependency UAT.
 *
 * Route-level UAT for the Product Posting workflow: proves the existing
 * fail-closed transition engine (server/services/workflow-transition.service.ts)
 * actually rejects a skipped stage and a wrong-role reviewer through the real
 * HTTP endpoints (not just the generic engine unit tests), and proves the
 * Listing-Page-QA dependency gate (PRODUCT_POSTING_LISTING_QA_DEPENDENCY.md)
 * genuinely blocks/unblocks `assign-task` when its config flag is enabled.
 * Per the user-confirmed decision this phase, the flag's default is left
 * untouched (still `false`) — this test only exercises it turned on
 * temporarily, restoring the original value in `afterAll`. Soft-skips if the
 * dev Postgres pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import { getConfig, patchConfig } from "./services/gm-sales-config.service";
import { satisfyListingQaDependencies } from "./services/invoice-to-project.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Product Posting workflow — Phase 12 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;
  let originalConfig: Record<string, unknown> = {};

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdWorkflowIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p12pp_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  async function seedProject(overrides: Record<string, any> = {}): Promise<string> {
    const {
      gmId = null,
      invoiceType = null,
      projectType = null,
    } = overrides;
    const r = await pool.query(
      `INSERT INTO drm.projects (name, gm_id, invoice_type, project_type, status)
       VALUES ($1, $2, $3, $4, 'Active') RETURNING id`,
      [`__p12pp project ${SUFFIX}_${createdProjectIds.length}`, gmId, invoiceType, projectType],
    );
    const id = String(r.rows[0].id);
    createdProjectIds.push(id);
    return id;
  }

  async function seedTask(projectId: string, ownerUserId: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.tasks (project_id, title, owner_user_id, status)
       VALUES ($1, $2, $3, 'ToDo') RETURNING id`,
      [projectId, `__p12pp task ${SUFFIX}_${createdTaskIds.length}`, ownerUserId],
    );
    const id = String(r.rows[0].id);
    createdTaskIds.push(id);
    return id;
  }

  async function seedWorkflow(projectId: string, taskId: string, currentPhase: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.product_posting_workflows (project_id, task_id, current_phase)
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

    admin = await seedUser("admin");
    const { config } = await getConfig();
    originalConfig = { ...config };
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        await patchConfig(originalConfig, "__p12pp_test_restore");

        if (createdWorkflowIds.length) {
          await pool.query(`DELETE FROM drm.product_posting_workflows WHERE id = ANY($1::uuid[])`, [
            createdWorkflowIds,
          ]);
        }
        await pool.query(`DELETE FROM drm.project_dependencies WHERE project_id = ANY($1::uuid[])`, [
          createdProjectIds,
        ]);
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
      console.warn("[product-posting-workflow-uat.test] cleanup failed:", err);
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
      .post(`/api/product-posting/tasks/${taskId}/verification-review`)
      .set(auth(admin.token))
      .send({ action: "complete" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WORKFLOW_ILLEGAL_TRANSITION");
  });

  it("rejects a QA-review attempt by a role outside qa_manager/admin", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const projectId = await seedProject();
    const taskId = await seedTask(projectId, admin.id);
    await seedWorkflow(projectId, taskId, "QA_REVIEW");

    const wrongRole = await seedUser("sales_executive");
    const res = await request(app)
      .post(`/api/product-posting/tasks/${taskId}/qa-review`)
      .set(auth(wrongRole.token))
      .send({ action: "complete" });

    expect(res.status).toBe(403);
  });

  it("blocks assign-task on a Product-Posting root project pending Listing-Page QA, then unblocks after it's satisfied", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    await patchConfig({ requireProductPostingWaitForListingQa: true }, admin.id);

    const gmId = crypto.randomUUID();
    const ppRootId = await seedProject({ gmId, invoiceType: "PRODUCT_POSTING", projectType: "INVOICE_ROOT" });

    // Advance the PP root workflow to PROJECT_OVERVIEW so assign-task's own
    // phase precondition doesn't block the test before the dependency check
    // even runs.
    const approveRes = await request(app)
      .post(`/api/product-posting/workflows/${ppRootId}/transition`)
      .set(auth(admin.token))
      .send({ status: "APPROVED" });
    expect(approveRes.status).toBe(200);

    const blocked = await request(app)
      .post(`/api/product-posting/projects/${ppRootId}/assign-task`)
      .set(auth(admin.token))
      .send({ assigneeId: admin.id, title: "blocked assignment" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("LISTING_QA_PENDING");

    // Satisfy the dependency the same way the real QA-review-complete path
    // does when a Listing Page project clears QA for this GM.
    await satisfyListingQaDependencies({ gmId, actorUserId: admin.id });

    const unblocked = await request(app)
      .post(`/api/product-posting/projects/${ppRootId}/assign-task`)
      .set(auth(admin.token))
      .send({ assigneeId: admin.id, title: "unblocked assignment" });
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.taskId).toBeTruthy();
    createdTaskIds.push(unblocked.body.taskId);
  });
});
