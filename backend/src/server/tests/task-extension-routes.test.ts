/**
 * Regression coverage for POST /api/tasks/:id/extensions rejection paths.
 *
 * Stage 4 requires that an extension request is validated BEFORE any DB write:
 * a non-owner gets 403, an invalid payload (non-positive minutes / empty reason)
 * gets 400, and a second pending request for the same task is rejected (400).
 * In every rejected case NO new task_time_extensions row may be created. These
 * tests hit a real Postgres (the Replit dev DB) through the same pool the app
 * uses, seeding throwaway users + tasks so the checks resolve against real rows.
 */
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { taskExecutionRouter } from "./routes/task-execution-routes";

let currentUser: any = null;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = currentUser;
    next();
  });
  app.use("/api/tasks", taskExecutionRouter);
  return app;
}

const app = buildApp();

const RUN_TAG = `__exttest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const createdUserIds: string[] = [];
const createdTaskIds: string[] = [];

async function seedUser(tag: string): Promise<string> {
  const { rows } = await pool.query(
    `insert into drm.users (name, full_name, username, email, password, role, role_id, is_active)
       values ($1, $1, $2, $3, $4, $5, $5, true)
       returning id`,
    [`Ext Test ${tag}`, `${RUN_TAG}_${tag}`, `${RUN_TAG}_${tag}@example.test`, "x", "product_posting_executive"],
  );
  createdUserIds.push(rows[0].id);
  return rows[0].id;
}

async function seedTask(ownerId: string, assigneeId: string | null): Promise<string> {
  const { rows } = await pool.query(
    `insert into drm.tasks (title, owner_user_id, assigned_to_user_id)
       values ($1, $2, $3)
       returning id`,
    [`${RUN_TAG}_task`, ownerId, assigneeId],
  );
  createdTaskIds.push(rows[0].id);
  return rows[0].id;
}

async function countExtensions(taskId: string): Promise<number> {
  const { rows } = await pool.query(
    `select count(*)::int as c from drm.task_time_extensions where task_id = $1`,
    [taskId],
  );
  return rows[0].c;
}

function asExecutive(userId: string) {
  currentUser = { userId, roleId: "product_posting_executive", roles: ["product_posting_executive"] };
}

afterAll(async () => {
  if (createdTaskIds.length) {
    await pool.query(`delete from drm.tasks where id = any($1::uuid[])`, [createdTaskIds]);
  }
  if (createdUserIds.length) {
    await pool.query(`delete from drm.users where id = any($1::uuid[])`, [createdUserIds]);
  }
});

describe("POST /api/tasks/:id/extensions — rejection paths leave no row", () => {
  let executiveId: string;
  let otherId: string;

  beforeAll(async () => {
    executiveId = await seedUser("owner");
    otherId = await seedUser("other");
  });

  it("rejects a non-assignee with 403 and writes no extension row", async () => {
    const taskId = await seedTask(executiveId, executiveId);
    asExecutive(otherId); // not the assignee
    const res = await request(app)
      .post(`/api/tasks/${taskId}/extensions`)
      .send({ requestedTimeMinutes: 30, reason: "please" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("WORKFLOW_OWNERSHIP_FORBIDDEN");
    expect(await countExtensions(taskId)).toBe(0);
  });

  it("rejects non-positive minutes with 400 and writes no extension row", async () => {
    const taskId = await seedTask(executiveId, executiveId);
    asExecutive(executiveId);
    const res = await request(app)
      .post(`/api/tasks/${taskId}/extensions`)
      .send({ requestedTimeMinutes: 0, reason: "valid reason" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EXTENSION_MINUTES_INVALID");
    expect(await countExtensions(taskId)).toBe(0);
  });

  it("rejects an empty reason with 400 and writes no extension row", async () => {
    const taskId = await seedTask(executiveId, executiveId);
    asExecutive(executiveId);
    const res = await request(app)
      .post(`/api/tasks/${taskId}/extensions`)
      .send({ requestedTimeMinutes: 30, reason: "   " });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EXTENSION_REASON_REQUIRED");
    expect(await countExtensions(taskId)).toBe(0);
  });

  it("rejects a duplicate pending request with 400 and adds no second row", async () => {
    const taskId = await seedTask(executiveId, executiveId);
    await pool.query(
      `insert into drm.task_time_extensions (task_id, requested_time_minutes, reason, status)
         values ($1, 15, 'first request', 'PENDING')`,
      [taskId],
    );
    asExecutive(executiveId);
    const res = await request(app)
      .post(`/api/tasks/${taskId}/extensions`)
      .send({ requestedTimeMinutes: 30, reason: "second request" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EXTENSION_DUPLICATE_PENDING");
    expect(await countExtensions(taskId)).toBe(1); // only the seeded one
  });
});
