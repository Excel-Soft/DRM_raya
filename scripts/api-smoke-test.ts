/**
 * api-smoke-test.ts — lightweight API smoke test (Stage 10, section H).
 *
 * A dependency-free alternative to a full Playwright E2E suite: it exercises the
 * security-critical contracts (auth gating, required-reason validation, the
 * audit-log viewer) against a RUNNING server. It never writes business data —
 * every check is a GET or a deliberately-invalid POST that must be rejected
 * BEFORE any write.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 TOKEN=<admin-jwt> tsx scripts/api-smoke-test.ts
 * If TOKEN is omitted it falls back to /tmp/jwt.txt (dev convenience).
 *
 * Exit code is non-zero if any check fails, so it can gate CI.
 */
import { readFileSync } from "fs";

const BASE = process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:5000";
let TOKEN = process.env.TOKEN || "";
if (!TOKEN) {
  try {
    TOKEN = readFileSync("/tmp/jwt.txt", "utf8").trim();
  } catch {
    /* no token file — unauth checks still run */
  }
}

type Check = {
  name: string;
  method: string;
  path: string;
  auth: boolean;
  body?: unknown;
  expect: number[];
};

const checks: Check[] = [
  // --- Auth gating ---
  { name: "audit-logs requires auth", method: "GET", path: "/api/audit-logs?pageSize=1", auth: false, expect: [401] },
  { name: "audit-logs admin OK", method: "GET", path: "/api/audit-logs?pageSize=5", auth: true, expect: [200] },
  { name: "audit-logs filter by action", method: "GET", path: "/api/audit-logs?action=INVOICE&pageSize=5", auth: true, expect: [200] },

  // --- Required-reason / validation (must reject before any write) ---
  { name: "followup complete needs outcome", method: "PATCH", path: "/api/service/followups/__smoke__/complete", auth: true, body: {}, expect: [400, 404] },
  { name: "dropout create needs reason", method: "POST", path: "/api/service/dropouts", auth: true, body: {}, expect: [400] },
  { name: "renewal create needs fields", method: "POST", path: "/api/service/renewals", auth: true, body: {}, expect: [400] },

  // --- Deprecated bridges fail clearly (no fake success) ---
  { name: "GM bridge returns 501", method: "POST", path: "/api/service/gm", auth: true, body: {}, expect: [501] },
  { name: "BV bridge returns 501", method: "POST", path: "/api/service/bv", auth: true, body: {}, expect: [501] },
];

async function run() {
  let pass = 0;
  let fail = 0;
  for (const c of checks) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (c.auth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
    let status = 0;
    try {
      const res = await fetch(`${BASE}${c.path}`, {
        method: c.method,
        headers,
        body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
      });
      status = res.status;
    } catch (e: any) {
      console.log(`✗ ${c.name} — request failed: ${e?.message}`);
      fail++;
      continue;
    }
    const ok = c.expect.includes(status);
    console.log(`${ok ? "✓" : "✗"} ${c.name} — got ${status}, expected ${c.expect.join("/")}`);
    ok ? pass++ : fail++;
  }
  console.log(`\n${pass} passed, ${fail} failed (of ${checks.length})`);
  if (!TOKEN) console.log("NOTE: no TOKEN provided — authenticated checks may report 401.");
  process.exit(fail > 0 ? 1 : 0);
}

run();
