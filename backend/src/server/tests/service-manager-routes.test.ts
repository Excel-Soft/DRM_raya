/**
 * Phase 16 — Final Patch 1 to Patch 7 Signoff Package (SRV-002 closure).
 *
 * server/service-manager-routes.ts previously had 5 GET endpoints with no
 * role restriction beyond global auth — any authenticated user of any role
 * could read Service Manager stats/activities/queue-performance/graph/
 * team-performance. This file proves the new requireRole("service_manager",
 * "admin") gate is actually enforced on all 5. Soft-skips if the dev
 * Postgres pool is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const ENDPOINTS = [
  "/api/service/manager/stats",
  "/api/service/manager/activities",
  "/api/service/manager/queue-performance",
  "/api/service/manager/current-month-graph",
  "/api/service/manager/team-work-performance",
];

describe("Service Manager routes — Phase 16 role-gate closure (SRV-002)", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p16srv_${role}_${SUFFIX}_${createdUserIds.length}`;
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
  let serviceManager: SeededUser;
  let salesExecutive: SeededUser;

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
    serviceManager = await seedUser("service_manager");
    salesExecutive = await seedUser("sales_executive");
  });

  afterAll(async () => {
    try {
      if (dbAvailable && createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    } catch (err) {
      console.warn("[service-manager-routes.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("returns 401 with no auth token, for every endpoint", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    for (const path of ENDPOINTS) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it("returns 403 for a role outside service_manager/admin, for every endpoint", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    for (const path of ENDPOINTS) {
      const res = await request(app).get(path).set(auth(salesExecutive.token));
      expect(res.status).toBe(403);
    }
  });

  it("allows service_manager and admin through, for every endpoint", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    for (const path of ENDPOINTS) {
      const smRes = await request(app).get(path).set(auth(serviceManager.token));
      expect(smRes.status).toBe(200);

      const adminRes = await request(app).get(path).set(auth(admin.token));
      expect(adminRes.status).toBe(200);
    }
  });
});
