/**
 * Phase 12 — Product Posting, PMS, QA, and Workflow Dependency UAT.
 *
 * API-level UAT for the PMS task lifecycle (assign/start/submit/return/
 * complete) and the stage-skip fix this phase made: `PMS_STRICT_TRANSITIONS`
 * now defaults true, `Completed` is only reachable from `READY_FOR_QA`, and
 * the generic PUT/PATCH task-update endpoints route through the same
 * `changeTaskStatus` service as the Kanban endpoint (previously they bypassed
 * it entirely). Also covers the two related integrity fixes: task creation
 * ignoring a client-supplied `status`, and `project_approvals` rejecting a
 * repeat approve/reject once already decided. Soft-skips if the dev Postgres
 * pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("PMS lifecycle — Phase 12 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdApprovalIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p12_${role}_${SUFFIX}_${createdUserIds.length}`;
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
      `INSERT INTO drm.projects (name) VALUES ($1) RETURNING id`,
      [`__p12 project ${SUFFIX}_${createdProjectIds.length}`],
    );
    const id = String(r.rows[0].id);
    createdProjectIds.push(id);
    return id;
  }

  async function seedApproval(projectId: string, requestedBy: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.project_approvals (project_id, stage, requested_by)
       VALUES ($1, 'Manager', $2) RETURNING id`,
      [projectId, requestedBy],
    );
    const id = String(r.rows[0].id);
    createdApprovalIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let admin: SeededUser;
  let projectId: string;

  async function createTask(title: string): Promise<string> {
    const res = await request(app!)
      .post("/api/pms/tasks")
      .set(auth(admin.token))
      .send({ projectId, title });
    expect(res.status).toBe(201);
    const id = res.body.id;
    createdTaskIds.push(id);
    return id;
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
    projectId = await seedProject();
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdApprovalIds.length) {
          await pool.query(`DELETE FROM drm.project_approvals WHERE id = ANY($1::uuid[])`, [
            createdApprovalIds,
          ]);
        }
        if (createdTaskIds.length) {
          await pool.query(`DELETE FROM drm.task_status_history WHERE task_id = ANY($1::uuid[])`, [
            createdTaskIds,
          ]);
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
      console.warn("[pms-lifecycle.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("drives a task through the full assign -> start -> submit -> complete happy path", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const taskId = await createTask(`__p12 happy path ${SUFFIX}`);

    // "start" — the Kanban status endpoint's own hardcoded whitelist
    // (ToDo|InProgress|Blocked|Completed, pre-existing, unrelated to this
    // phase) covers this.
    const start = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "InProgress" });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe("InProgress");

    // "submit" — READY_FOR_QA is outside the Kanban endpoint's whitelist, so
    // it's only reachable via the generic update endpoint, which now routes
    // through the same transition-validated service (Phase 12 fix).
    const submit = await request(app).put(`/api/pms/tasks/${taskId}`).set(auth(admin.token)).send({ status: "READY_FOR_QA" });
    expect(submit.status).toBe(200);
    expect(submit.body.status).toBe("READY_FOR_QA");

    // "complete" — legal now that the task has actually been submitted.
    const complete = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "Completed" });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe("Completed");
  });

  it("rejects a direct ToDo -> Completed skip via the Kanban status endpoint", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const taskId = await createTask(`__p12 skip kanban ${SUFFIX}`);
    const res = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "Completed" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Illegal PMS task transition/i);
  });

  it("rejects the same skip via the generic PUT and PATCH task-update endpoints (bypass closed)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const putTaskId = await createTask(`__p12 skip put ${SUFFIX}`);
    const putRes = await request(app).put(`/api/pms/tasks/${putTaskId}`).set(auth(admin.token)).send({ status: "Completed" });
    expect(putRes.status).toBe(400);
    expect(putRes.body.code).toBe("PMS_ILLEGAL_TRANSITION");

    const patchTaskId = await createTask(`__p12 skip patch ${SUFFIX}`);
    const patchRes = await request(app).patch(`/api/pms/tasks/${patchTaskId}`).set(auth(admin.token)).send({ status: "Completed" });
    expect(patchRes.status).toBe(400);
    expect(patchRes.body.code).toBe("PMS_ILLEGAL_TRANSITION");
  });

  it("allows a task to be returned (Blocked) and resubmitted repeatedly", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const taskId = await createTask(`__p12 return loop ${SUFFIX}`);
    await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "InProgress" });
    await request(app).put(`/api/pms/tasks/${taskId}`).set(auth(admin.token)).send({ status: "READY_FOR_QA" });

    // Strict mode (Phase 12 default) ties "a reason is required to return/
    // block a task" to strict mode itself, not just the separate
    // PMS_REQUIRE_RETURN_REASON flag — this is pre-existing logic in
    // validateTaskTransition, now actually reachable.
    const return1 = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "Blocked", reason: "needs rework" });
    expect(return1.status).toBe(200);

    const rework = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "InProgress" });
    expect(rework.status).toBe(200);

    const resubmit = await request(app).put(`/api/pms/tasks/${taskId}`).set(auth(admin.token)).send({ status: "READY_FOR_QA" });
    expect(resubmit.status).toBe(200);

    const return2 = await request(app).patch(`/api/pms/task/${taskId}/status`).set(auth(admin.token)).send({ status: "Blocked", reason: "still needs rework" });
    expect(return2.status).toBe(200);
  });

  it("ignores a client-supplied status at creation time (always created as ToDo)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const res = await request(app)
      .post("/api/pms/tasks")
      .set(auth(admin.token))
      .send({ projectId, title: `__p12 create-completed ${SUFFIX}`, status: "Completed" });
    expect(res.status).toBe(201);
    createdTaskIds.push(res.body.id);
    expect(res.body.status).toBe("ToDo");
  });

  it("rejects a repeat approve/reject on a project_approvals row that's already decided", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const approvalId = await seedApproval(projectId, admin.id);

    const first = await request(app).post(`/api/pms/approvals/${approvalId}/approve`).set(auth(admin.token)).send({});
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("Approved");

    const second = await request(app).post(`/api/pms/approvals/${approvalId}/approve`).set(auth(admin.token)).send({});
    expect(second.status).toBe(409);

    const rejectAfterApprove = await request(app).post(`/api/pms/approvals/${approvalId}/reject`).set(auth(admin.token)).send({ comment: "too late" });
    expect(rejectAfterApprove.status).toBe(409);
  });
});
