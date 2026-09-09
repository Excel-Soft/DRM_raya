/**
 * Regression coverage for GET /api/drm/performance/team oversized-team handling.
 *
 * The /team endpoint is a server-side paginated leaderboard: it scores EVERY
 * employee the caller may see (no pre-score truncation), ranks them by score
 * across the whole scope, and returns just the requested page. These tests guard
 * that contract: the full scope is always ranked (nobody is silently dropped),
 * pages slice correctly with global ranks, and the total/page metadata stays in
 * sync with the actual rows. There is intentionally no truncation cap.
 *
 * The tests hit a real Postgres (the Replit dev DB) through the same pool the
 * app uses, seeding throwaway users in a unique department so the HOD access
 * scope resolves to exactly that seeded set.
 */
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerPerformanceRoutes } from "../routes/performance-routes";

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
      `insert into drm.users (name, full_name, username, email, password_hash, role, role_id, department, is_active)
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
  currentUser = null;
});

afterAll(async () => {
  for (const dept of createdDepts) {
    await pool.query(`delete from drm.users where department = $1`, [dept]);
  }
  await pool.end();
});

describe("GET /api/drm/performance/team — oversized team handling", () => {
  it("paginates across the whole scope (no truncation) and ranks every employee", async () => {
    const TOTAL = 5;
    const PAGE_SIZE = 3;
    const dept = freshDept();
    const ids = await seedTeam(dept, TOTAL);
    currentUser = { userId: ids[0], roleId: "hod" };

    // Page 1: first PAGE_SIZE rows, global ranks 1..PAGE_SIZE, true total reported.
    const page1 = await request(app)
      .get("/api/drm/performance/team")
      .query({ ...DATE_RANGE, page: "1", pageSize: String(PAGE_SIZE) });

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(TOTAL);
    expect(page1.body.totalScored).toBe(TOTAL);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(PAGE_SIZE);
    expect(page1.body.totalPages).toBe(Math.ceil(TOTAL / PAGE_SIZE));
    expect(page1.body.count).toBe(PAGE_SIZE);
    expect(page1.body.team).toHaveLength(PAGE_SIZE);
    expect(page1.body.team.map((r: any) => r.rank)).toEqual([1, 2, 3]);
    // The truncation contract is gone — these fields must no longer be present.
    expect(page1.body.truncated).toBeUndefined();
    expect(page1.body.limit).toBeUndefined();

    // Page 2: the remaining rows, continuing the global rank sequence.
    const page2 = await request(app)
      .get("/api/drm/performance/team")
      .query({ ...DATE_RANGE, page: "2", pageSize: String(PAGE_SIZE) });

    expect(page2.status).toBe(200);
    expect(page2.body.total).toBe(TOTAL);
    expect(page2.body.page).toBe(2);
    expect(page2.body.count).toBe(TOTAL - PAGE_SIZE);
    expect(page2.body.team).toHaveLength(TOTAL - PAGE_SIZE);
    expect(page2.body.team.map((r: any) => r.rank)).toEqual([4, 5]);

    // Together the two pages must cover every seeded employee — nobody dropped.
    const seen = new Set<string>([
      ...page1.body.team.map((r: any) => String(r.employee.id)),
      ...page2.body.team.map((r: any) => String(r.employee.id)),
    ]);
    expect(seen.size).toBe(TOTAL);
    for (const id of ids) expect(seen.has(id)).toBe(true);
  });

  it("returns the full team on a single page when it fits, with no truncation", async () => {
    const TOTAL = 3;
    const dept = freshDept();
    const ids = await seedTeam(dept, TOTAL);
    currentUser = { userId: ids[0], roleId: "hod" };

    const res = await request(app)
      .get("/api/drm/performance/team")
      .query(DATE_RANGE);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(TOTAL);
    expect(res.body.totalScored).toBe(TOTAL);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.count).toBe(TOTAL);
    expect(res.body.team).toHaveLength(TOTAL);
    expect(res.body.total).toBe(res.body.team.length);
    expect(res.body.truncated).toBeUndefined();
  });
});
