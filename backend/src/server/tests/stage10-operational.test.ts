/**
 * Patch 3 Stage 10 — P1 Operational Workflow tests (DB-backed).
 *
 * Stage 10 is largely a verification/hardening pass: the operational surfaces
 * (CRM/Sales/Leads, GM/BV lifecycle + reconciliation, Service, Events, Allowed
 * IP) were already built in earlier stages. The one endorsed additive change is
 * **Part D audit logging** — the DRM/DD operational mutations now write an
 * `drm.activity_logs` row after each successful mutation.
 *
 * This suite asserts the Stage 10 hard rules through the real wiring
 * (registerRoutes(), the same entrypoint as server/index.ts):
 *   - the DRM operational mutations stay gated (an unauthenticated request is
 *     rejected with 401/403, never silently 404/200),
 *   - the GM/BV reconciliation read is gated,
 *   - the Events + Allowed-IP persistence endpoints are gated,
 *   - a representative authorized DRM mutation (promotion create) actually
 *     PERSISTS an audit row in drm.activity_logs (the new Part D behavior),
 *     tagged with the correct action / resourceType / actor.
 *
 * Resilient: if the dev Postgres pool is unreachable the suite soft-skips rather
 * than failing the build (mirrors the other *-routes.test.ts suites). Seeded
 * rows and users are cleaned up afterwards (activity_logs cascade-delete with
 * their user).
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "../auth.service";
import { ActivityLogService } from "../services/activity-service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let app: Express | null = null;
let dbAvailable = false;

const createdUserIds: string[] = [];
const createdPromotionIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
  email: string;
}

async function seedUser(role: string, branch = "Lahore Gulburg"): Promise<SeededUser> {
  const username = `__s10_${role}_${SUFFIX}_${createdUserIds.length}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, branch, is_active)
     VALUES ($1, $2, $3, $3, $4, true) RETURNING id`,
    [username, email, role, branch],
  );
  const id = String(r.rows[0].id);
  createdUserIds.push(id);
  const token = authService.generateToken({
    userId: id,
    email,
    roleId: role,
    roles: [role],
    activeRoleId: role,
    branch,
    country: "Pakistan",
  });
  return { id, token, email };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let admin: SeededUser; // global admin → all permissions

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
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      if (createdPromotionIds.length) {
        await pool.query(`DELETE FROM drm.promotions WHERE id::text = ANY($1::text[])`, [createdPromotionIds]);
      }
      // Deleting the seeded users cascade-deletes their activity_logs rows.
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[stage10.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("Stage 10 — DRM/DD operational mutations stay gated (no auth → 401/403, never 404)", () => {
  it("rejects unauthenticated promotion create/update/delete", async () => {
    if (!dbAvailable || !app) return;
    const create = await request(app).post("/api/drm/promotions").send({ title: "x" });
    expect([401, 403]).toContain(create.status);
    expect(create.status).not.toBe(404);

    const update = await request(app).patch("/api/drm/promotions/00000000-0000-0000-0000-000000000000").send({ title: "y" });
    expect([401, 403]).toContain(update.status);

    const del = await request(app).delete("/api/drm/promotions/00000000-0000-0000-0000-000000000000");
    expect([401, 403]).toContain(del.status);
  });

  it("rejects unauthenticated today-post create", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/drm/today-posts").send({ platform: "x", postUrl: "https://e.invalid" });
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it("rejects unauthenticated social-account create + delete", async () => {
    if (!dbAvailable || !app) return;
    const create = await request(app).post("/api/drm/social-accounts").send({ platform: "x" });
    expect([401, 403]).toContain(create.status);
    expect(create.status).not.toBe(404);
    const del = await request(app).delete("/api/drm/social-accounts/00000000-0000-0000-0000-000000000000");
    expect([401, 403]).toContain(del.status);
  });

  it("rejects unauthenticated commission-verification create", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/drm/commission-verifications").send({ period: "2026-06" });
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it("rejects unauthenticated late-coming manual create", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/drm/late-coming").send({ userId: "x", lateMinutes: 5 });
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});

describe("Stage 10 — GM/BV reconciliation read is gated", () => {
  it("rejects unauthenticated reconciliation reads (401/403, not 404)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/reports/gm-bv-reconciliation");
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});

describe("Stage 10 — Events + Allowed-IP persistence are gated", () => {
  it("rejects unauthenticated event create (401/403, not 404)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/events").send({ title: "x" });
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it("rejects unauthenticated allowed-ip create (401/403, not 404)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/settings/allowed-ips").send({ ipAddress: "10.0.0.1" });
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});

describe("Stage 10 — Part D: a successful DRM mutation persists an audit row", () => {
  it("promotion create writes a drm.activity_logs row tagged with action + actor", async () => {
    if (!dbAvailable || !app) return;
    const title = `__s10_promo_${SUFFIX}`;
    const res = await request(app).post("/api/drm/promotions").set(auth(admin.token)).send({ title });
    expect(res.status).toBe(201);
    const id = String(res.body?.promotion?.id ?? "");
    expect(id).not.toBe("");
    if (id) createdPromotionIds.push(id);

    // The audit trail row must exist for this exact resource (Part D behavior).
    const logs = await ActivityLogService.getLogsForResource("drm_promotion", id);
    const createLog = logs.find((l) => l.action === "drm.promotion.create");
    expect(createLog).toBeTruthy();
    expect(createLog?.resourceType).toBe("drm_promotion");
    expect(String(createLog?.userId)).toBe(admin.id);
  });
});
