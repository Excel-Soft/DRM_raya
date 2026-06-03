/**
 * Regression coverage for GET /api/drm/performance/team oversized-team handling.
 *
 * The /team endpoint scores every employee the caller may see up to a safety
 * cap (MAX_TEAM_USERS, overridable via PERFORMANCE_TEAM_MAX_USERS) and reports
 * the *true* total plus a `truncated` flag so the UI can show "Showing N of M"
 * instead of silently dropping employees past the cap. These tests guard that
 * contract: the cap must never drop employees without flagging it, and the
 * total/truncated/row-count fields must stay in sync with the actual rows.
 *
 * The tests hit a real Postgres (the Replit dev DB) through the same pool the
 * app uses, seeding throwaway users in a unique department so the HOD access
 * scope resolves to exactly that seeded set.
 */
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { pool } from "./db";
import { registerPerformanceRoutes } from "./performance-routes";

// req.user is normally populated by auth middleware; the tests swap this in.
let currentUser: any = null;

function buildApp(): Express {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = currentUser;
    next();
  });
  registerPerformanceRoutes(app);
  return app;
}

const app = buildApp();

// Namespace for every department we create, so cleanup can find them all.
const RUN_TAG = `__perftest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const createdDepts: string[] = [];

// Each test gets its own department so HOD scoping (department-based) resolves
// to exactly that test's seeded users and nothing else in the dev DB.
function freshDept(): string {
  const dept = `${RUN_TAG}_d${createdDepts.length}`;
  createdDepts.push(dept);
  return dept;
}

/**
 * Seeds `count` active users in `dept`. The first id returned is treated as the
 * requester (a HOD scoped to that department). Returns all seeded ids.
 */
async function seedTeam(dept: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const tag = `${dept}_${i}`;
    const { rows } = await pool.query(
      `insert into drm.users (name, full_name, username, email, password, role, role_id, department, is_active)
         values ($1, $1, $2, $3, $4, $5, $5, $6, true)
         returning id`,
      [`Perf Test ${tag}`, `user_${tag}`, `${tag}@example.test`, "x", "hod", dept],
    );
    ids.push(String(rows[0].id));
  }
  return ids;
}

const DATE_RANGE = { startDate: "2020-01-01", endDate: "2020-01-31" };

beforeAll(async () => {
  // Fail loudly if the DB is unreachable rather than silently passing.
  await pool.query("select 1");
});

afterEach(() => {
  delete process.env.PERFORMANCE_TEAM_MAX_USERS;
  currentUser = null;
});

afterAll(async () => {
  for (const dept of createdDepts) {
    await pool.query(`delete from drm.users where department = $1`, [dept]);
  }
  await pool.end();
});

describe("GET /api/drm/performance/team — oversized team handling", () => {
  it("caps rows at the limit and reports the true total + truncated=true when the team exceeds the cap", async () => {
    const TOTAL = 5;
    const CAP = 3;
    const dept = freshDept();
    const ids = await seedTeam(dept, TOTAL);

    process.env.PERFORMANCE_TEAM_MAX_USERS = String(CAP);
    currentUser = { userId: ids[0], roleId: "hod" };

    const res = await request(app)
      .get("/api/drm/performance/team")
      .query(DATE_RANGE);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(TOTAL);
    expect(res.body.truncated).toBe(true);
    expect(res.body.limit).toBe(CAP);
    expect(res.body.count).toBe(CAP);
    expect(res.body.team).toHaveLength(CAP);
  });

  it("returns every row with truncated=false and total === team length for a small team", async () => {
    const TOTAL = 3;
    const dept = freshDept();
    const ids = await seedTeam(dept, TOTAL);

    // No PERFORMANCE_TEAM_MAX_USERS override -> default cap (1000) applies.
    currentUser = { userId: ids[0], roleId: "hod" };

    const res = await request(app)
      .get("/api/drm/performance/team")
      .query(DATE_RANGE);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(TOTAL);
    expect(res.body.truncated).toBe(false);
    expect(res.body.count).toBe(TOTAL);
    expect(res.body.team).toHaveLength(TOTAL);
    expect(res.body.total).toBe(res.body.team.length);
  });
});
