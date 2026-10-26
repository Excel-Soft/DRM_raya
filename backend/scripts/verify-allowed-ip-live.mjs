#!/usr/bin/env node
/**
 * Live check against running Express (default :5001). Prints status codes only.
 * Seeds ephemeral users, then deletes them. Requires DATABASE_URL / pool config.
 */
import { pool } from "../src/server/db.ts";
import { authService } from "../src/server/services/auth.service.ts";

const base = (process.env.BACKEND_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ids = [];

async function seed(role) {
  const username = `__live_aip_${role}_${suffix}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
     VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
    [username, email, role, "Lahore Gulburg", `Live ${username}`, "test_hash"],
  );
  const id = String(r.rows[0].id);
  ids.push(id);
  const token = authService.generateToken({
    userId: id,
    email,
    roleId: role,
    roles: [role],
    activeRoleId: role,
    branch: "Lahore Gulburg",
    country: "Pakistan",
  });
  return token;
}

async function status(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${base}${path}`, { headers });
  return res.status;
}

let failed = 0;
try {
  await pool.query("SELECT 1");

  const noAuth = await status("/api/settings/allowed-ips");
  console.log(`GET /api/settings/allowed-ips (no token) → ${noAuth}`);
  if (noAuth !== 401) failed++;

  const adminToken = await seed("admin");
  const adminStatus = await status("/api/settings/allowed-ips", adminToken);
  console.log(`GET /api/settings/allowed-ips (admin) → ${adminStatus}`);
  if (adminStatus !== 200) failed++;

  const outsiderToken = await seed("account_manager");
  const denied = await status("/api/settings/allowed-ips", outsiderToken);
  console.log(`GET /api/settings/allowed-ips (account_manager) → ${denied}`);
  if (denied !== 403) failed++;

  const rolesOk = await status("/api/settings/roles", outsiderToken);
  console.log(`GET /api/settings/roles (account_manager) → ${rolesOk}`);
  if (rolesOk !== 200) failed++;
} catch (e) {
  console.error("Live verification failed:", e.message);
  failed++;
} finally {
  if (ids.length) {
    await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [ids]).catch(() => {});
  }
  // Do not pool.end() — shared singleton; ending breaks subsequent vitest suites.
}
process.exit(failed ? 1 : 0);
