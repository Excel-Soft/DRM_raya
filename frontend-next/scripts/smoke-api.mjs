#!/usr/bin/env node
/**
 * API smoke checks (no credentials). Run with backend up:
 *   BACKEND_URL=http://localhost:5001 node scripts/smoke-api.mjs
 */
const base = (process.env.BACKEND_URL || "http://localhost:5001").replace(/\/$/, "");

async function status(path, init) {
  const res = await fetch(`${base}${path}`, init);
  return res.status;
}

const checks = [
  ["GET /api/health/db (public)", () => status("/api/health/db")],
  ["GET /api/auth/me (no auth)", () => status("/api/auth/me")],
  ["GET /api/notice-board (no auth)", () => status("/api/notice-board")],
  ["GET /api/audit-logs (no auth)", () => status("/api/audit-logs")],
  ["GET /api/settings/allowed-ips (no auth)", () => status("/api/settings/allowed-ips")],
];

let failed = 0;
for (const [label, fn] of checks) {
  try {
    const code = await fn();
    const ok =
      label.includes("health")
        ? code === 200
        : code === 401;
    console.log(`${ok ? "OK" : "FAIL"} ${label} → ${code}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL ${label} → ${e.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
