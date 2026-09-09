/**
 * Phase 13 — Reports, Export Parity, and Business Signoff.
 *
 * Formula-correctness UAT for the Daily Target KPI report
 * (server/services/day-target.service.ts, GET /api/reports/day-target).
 * Prior coverage (server/report-permission.test.ts) only exercised the
 * generic permission-matrix logic using "day_target" as an example key —
 * nothing asserted the actual arithmetic (assigned/achieved/pending/
 * achievement%) against real seeded data. Soft-skips if the dev Postgres
 * pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("Daily Target KPI — Phase 13 formula UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdTargetIds: number[] = [];
  const createdGmIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p13dt_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  let admin: SeededUser;
  let startDate: string;
  let endDate: string;

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

    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 2);
    const to = new Date(today); to.setDate(to.getDate() + 2);
    startDate = toDateStr(from);
    endDate = toDateStr(to);
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdGmIds.length) {
          await pool.query(`DELETE FROM drm.gm_entries WHERE id = ANY($1::uuid[])`, [createdGmIds]);
        }
        if (createdTargetIds.length) {
          await pool.query(`DELETE FROM drm.target_system_user_targets WHERE id = ANY($1::int[])`, [
            createdTargetIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[day-target-kpi.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("computes assigned/achieved/pending/achievementPercent from real target + Approved-GM rows, never a fabricated value", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const employee = await seedUser("sales_executive");

    const targetRes = await pool.query(
      `INSERT INTO drm.target_system_user_targets (user_id, target_name, category, total, start_date, end_date)
       VALUES ($1, $2, 'GM', 10000, $3::date, $4::date) RETURNING id`,
      [employee.id, `__p13dt target ${SUFFIX}`, startDate, endDate],
    );
    createdTargetIds.push(targetRes.rows[0].id);

    const gmRes = await pool.query(
      `INSERT INTO drm.gm_entries (created_by, sales_person_id, amount, amount_usd, status)
       VALUES ($1, $1, 4000, 4000, 'Approved') RETURNING id`,
      [employee.id],
    );
    createdGmIds.push(gmRes.rows[0].id);

    const res = await request(app)
      .get(`/api/reports/day-target?startDate=${startDate}&endDate=${endDate}&userId=${employee.id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
    const row = res.body.rows[0];
    expect(row.assignedTarget).toBe(10000);
    expect(row.achieved).toBe(4000);
    expect(row.pending).toBe(6000);
    expect(row.achievementPercent).toBe(40);
  });

  it("never fabricates a target: an employee with no target row gets null (not 0) and appears in missingData", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const employee = await seedUser("sales_executive");

    const res = await request(app)
      .get(`/api/reports/day-target?startDate=${startDate}&endDate=${endDate}&userId=${employee.id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(200);
    const row = res.body.rows[0];
    expect(row.assignedTarget).toBeNull();
    expect(row.achievementPercent).toBeNull();
    expect(res.body.missingData.some((m: any) => m.employeeId === employee.id)).toBe(true);
  });

  it("excludes non-Approved GM entries from the achieved total", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const employee = await seedUser("sales_executive");
    const targetRes = await pool.query(
      `INSERT INTO drm.target_system_user_targets (user_id, target_name, category, total, start_date, end_date)
       VALUES ($1, $2, 'GM', 5000, $3::date, $4::date) RETURNING id`,
      [employee.id, `__p13dt target2 ${SUFFIX}`, startDate, endDate],
    );
    createdTargetIds.push(targetRes.rows[0].id);

    const gmRes = await pool.query(
      `INSERT INTO drm.gm_entries (created_by, sales_person_id, amount, amount_usd, status)
       VALUES ($1, $1, 9999, 9999, 'Pending') RETURNING id`,
      [employee.id],
    );
    createdGmIds.push(gmRes.rows[0].id);

    const res = await request(app)
      .get(`/api/reports/day-target?startDate=${startDate}&endDate=${endDate}&userId=${employee.id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(200);
    const row = res.body.rows[0];
    expect(row.achieved).toBe(0);
  });
});
