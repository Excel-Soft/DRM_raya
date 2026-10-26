/**
 * Allowed IP settings API — role gate (registry ADMIN_ONLY).
 * Requires dev Postgres (soft-skips when unreachable).
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "../services/auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let app: Express | null = null;
let dbAvailable = false;

const createdUserIds: string[] = [];
const createdAllowedIpIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
}

async function seedUser(role: string): Promise<SeededUser> {
  const username = `__aip_${role}_${SUFFIX}_${createdUserIds.length}`;
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

let adminUser: SeededUser;
let outsider: SeededUser;

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

  adminUser = await seedUser("admin");
  outsider = await seedUser("account_manager");
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      if (createdAllowedIpIds.length) {
        await pool.query(`DELETE FROM drm.allowed_ips WHERE id::text = ANY($1::text[])`, [createdAllowedIpIds]);
      }
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[allowed-ips-auth.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("Allowed IP API — authentication", () => {
  it("GET /api/settings/allowed-ips without token returns 401", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/settings/allowed-ips");
    expect(res.status).toBe(401);
  });
});

describe("Allowed IP API — authorized admin roles", () => {
  it("admin role can GET list", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/settings/allowed-ips").set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("admin role can POST a valid allowed IP", async () => {
    if (!dbAvailable || !app) return;
    const ip_cidr = `10.255.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
    const res = await request(app)
      .post("/api/settings/allowed-ips")
      .set(auth(adminUser.token))
      .send({ ip_cidr, description: "phase9.1 test", is_active: true });
    expect(res.status).toBe(201);
    expect(res.body?.id).toBeTruthy();
    expect(res.body?.ip_cidr).toBe(ip_cidr);
    createdAllowedIpIds.push(String(res.body.id));

    const byId = await request(app)
      .get(`/api/settings/allowed-ips/${res.body.id}`)
      .set(auth(adminUser.token));
    expect(byId.status).toBe(200);
    expect(byId.body?.ip_cidr).toBe(ip_cidr);
  });
});

describe("Allowed IP API — non-approved roles", () => {
  it("account_manager receives 403 on GET list", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/settings/allowed-ips").set(auth(outsider.token));
    expect(res.status).toBe(403);
  });

  it("account_manager receives 403 on GET by id", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/settings/allowed-ips/00000000-0000-0000-0000-000000000001")
      .set(auth(outsider.token));
    expect(res.status).toBe(403);
  });

  it("account_manager receives 403 on POST", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .post("/api/settings/allowed-ips")
      .set(auth(outsider.token))
      .send({ ip_cidr: "10.0.0.99", description: "blocked", is_active: true });
    expect(res.status).toBe(403);
  });

  it("account_manager receives 403 on PATCH", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .patch("/api/settings/allowed-ips/00000000-0000-0000-0000-000000000001")
      .set(auth(outsider.token))
      .send({ is_active: false });
    expect(res.status).toBe(403);
  });

  it("account_manager receives 403 on DELETE", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .delete("/api/settings/allowed-ips/00000000-0000-0000-0000-000000000001")
      .set(auth(outsider.token));
    expect(res.status).toBe(403);
  });
});

describe("Allowed IP API — unrelated settings routes", () => {
  it("account_manager can still GET /api/settings/roles", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/settings/roles").set(auth(outsider.token));
    expect(res.status).toBe(200);
  });
});
