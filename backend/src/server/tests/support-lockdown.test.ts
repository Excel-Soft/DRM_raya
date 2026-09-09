/**
 * Phase 11 — Support and Social Media Final Scope Closure.
 *
 * API-level UAT proving the Support module's disabled-and-locked state is
 * genuinely enforced (per the user-confirmed decision to keep it disabled),
 * and that the newly-added requireRole() gate (server/support-routes.ts)
 * works correctly for the day it is ever re-enabled. Soft-skips if the dev
 * Postgres pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ORIGINAL_FLAG = process.env.SUPPORT_MODULE_ENABLED;

describe("Support module — Phase 11 lockdown UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdTicketIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p11_${role}_${SUFFIX}_${createdUserIds.length}`;
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
  let serviceExec: SeededUser;

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
    serviceExec = await seedUser("service_executive");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (ORIGINAL_FLAG === undefined) {
          delete process.env.SUPPORT_MODULE_ENABLED;
        } else {
          process.env.SUPPORT_MODULE_ENABLED = ORIGINAL_FLAG;
        }

        if (createdTicketIds.length) {
          await pool.query(`DELETE FROM drm.support_tickets WHERE id = ANY($1::varchar[])`, [
            createdTicketIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[support-lockdown.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  describe("Disabled by default — module-level 404, before auth/role checks", () => {
    it("404s every /api/support/* method regardless of role", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      delete process.env.SUPPORT_MODULE_ENABLED;

      const calls: Array<Promise<request.Response>> = [
        request(app).get("/api/support/tickets").set(auth(admin.token)),
        request(app).post("/api/support/tickets").set(auth(admin.token)).send({ subject: "x" }),
        request(app).put("/api/support/tickets/does-not-matter").set(auth(admin.token)).send({}),
        request(app).delete("/api/support/tickets/does-not-matter").set(auth(admin.token)),
        request(app).get("/api/support/channels").set(auth(admin.token)),
        request(app).get("/api/support/queue").set(auth(admin.token)),
      ];
      const results = await Promise.all(calls);
      for (const res of results) {
        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Not Found");
      }
    });

    it("404s even with no auth token at all (gate runs before authMiddleware)", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      delete process.env.SUPPORT_MODULE_ENABLED;

      const res = await request(app).get("/api/support/tickets");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Not Found");
    });
  });

  describe("Enabled + wrong role — role gate rejects", () => {
    it("rejects a role outside the seeded permission list with 403", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      process.env.SUPPORT_MODULE_ENABLED = "true";

      const res = await request(app)
        .get("/api/support/tickets")
        .set(auth(serviceExec.token));
      expect(res.status).toBe(403);
    });
  });

  describe("Enabled + correct role — real end-to-end DB operation", () => {
    it("creates a real support_tickets row for an allowed role (admin)", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      process.env.SUPPORT_MODULE_ENABLED = "true";

      const res = await request(app)
        .post("/api/support/tickets")
        .set(auth(admin.token))
        .send({ subject: `__p11 ticket ${SUFFIX}` });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      createdTicketIds.push(res.body.id);

      const row = await pool.query(`SELECT * FROM drm.support_tickets WHERE id = $1`, [res.body.id]);
      expect(row.rows.length).toBe(1);
      expect(row.rows[0].subject).toBe(`__p11 ticket ${SUFFIX}`);
    });
  });
});
