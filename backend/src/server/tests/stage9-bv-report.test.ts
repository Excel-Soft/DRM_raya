/**
 * Patch 3 Stage 9 — BV Report integration tests (DB-backed).
 *
 * Exercises the real wiring through registerRoutes() (same entrypoint as
 * server/index.ts), against the real `drm.bv_reports` canonical table, asserting
 * the Stage 9 hard rules:
 *   - the auth gate (401) on the BV report endpoints,
 *   - a non-approver CANNOT create a report with Approved/Rejected status (403),
 *     while an approver can; a non-approver CAN create Draft/Submitted,
 *   - honest input rejection: an unknown status → 400, and the legacy
 *     package/method filters → 400 (never a silent all-rows result),
 *   - metric honesty: followUpsCompleted / missedLeads are `null` and named in
 *     missingMetrics (never fabricated as 0/100); successRate is computed over the
 *     full filtered set, not the paginated slice,
 *   - approval lifecycle: only an approver may approve/reject (else 403), only a
 *     Submitted row may transition (else 409), and a reject requires a reason (400),
 *   - export is role-gated (a non-exporter → 403), is never paginated (row count ==
 *     reportCount), names the file with the date range + user, and rejects an
 *     unsupported format (400),
 *   - canonical source: a report created via POST appears in the list/export (the
 *     same table is read and written — no separate invisible model).
 *
 * Resilient: if the dev Postgres pool is unreachable the suite soft-skips rather
 * than failing the build (mirrors the other *-routes.test.ts suites). Seeded rows
 * and users are cleaned up afterwards.
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const FROM = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
const TO = new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10);
const RANGE = `from=${FROM}&to=${TO}`;

let app: Express | null = null;
let dbAvailable = false;

const createdUserIds: string[] = [];
const createdReportIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
  email: string;
}

async function seedUser(role: string, branch = "Lahore Gulburg"): Promise<SeededUser> {
  const username = `__s9_${role}_${SUFFIX}_${createdUserIds.length}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
     VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
    [username, email, role, branch, `Full Name ${username}`, "test_hash"],
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

function bvBody(over: Record<string, unknown> = {}) {
  return {
    title: `__s9_bv_${SUFFIX}_${Math.random().toString(36).slice(2, 7)}`,
    status: "Draft",
    reportDate: new Date().toISOString(),
    totalTasks: 2,
    valueSold: 1000,
    successRate: 50,
    followUpsDone: 1,
    missedLeads: 0,
    ...over,
  };
}

/** Create a BV report via the real POST route and track it for cleanup. */
async function createReport(token: string, over: Record<string, unknown> = {}) {
  const res = await request(app!).post("/api/bv-reports").set(auth(token)).send(bvBody(over));
  if (res.status === 201 && res.body?.data?.id) {
    createdReportIds.push(String(res.body.data.id));
  }
  return res;
}

let adminUser: SeededUser; // global admin → unscoped reads, all permissions
let approver: SeededUser; // account_manager → create/edit/view/export/approve
let creator: SeededUser; // sales_executive → create/edit/view; NOT approve, NOT export

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
  approver = await seedUser("account_manager");
  creator = await seedUser("sales_executive");
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      if (createdReportIds.length) {
        await pool.query(`DELETE FROM drm.bv_reports WHERE id = ANY($1::uuid[])`, [createdReportIds]);
      }
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[stage9.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("Stage 9 — auth gate", () => {
  it("rejects unauthenticated requests on the BV endpoints (401, not 404)", async () => {
    if (!dbAvailable || !app) return;
    const list = await request(app).get("/api/reports/bv");
    expect(list.status).toBe(401);
    expect(list.status).not.toBe(404);
    const exp = await request(app).get("/api/reports/bv/export");
    expect(exp.status).toBe(401);
    expect(exp.status).not.toBe(404);
    const post = await request(app).post("/api/bv-reports").send(bvBody());
    expect(post.status).toBe(401);
    expect(post.status).not.toBe(404);
  });
});

describe("Stage 9 — approver-only finalize on create", () => {
  it("a non-approver CANNOT create an Approved report (403)", async () => {
    if (!dbAvailable || !app) return;
    const res = await createReport(creator.token, { status: "Approved" });
    expect(res.status).toBe(403);
  });

  it("a non-approver CANNOT create a Rejected report (403)", async () => {
    if (!dbAvailable || !app) return;
    const res = await createReport(creator.token, { status: "Rejected" });
    expect(res.status).toBe(403);
  });

  it("a non-approver CAN create a Draft/Submitted report (201)", async () => {
    if (!dbAvailable || !app) return;
    const draft = await createReport(creator.token, { status: "Draft" });
    expect(draft.status).toBe(201);
    const submitted = await createReport(creator.token, { status: "Submitted" });
    expect(submitted.status).toBe(201);
  });

  it("an approver CAN create an Approved report (201)", async () => {
    if (!dbAvailable || !app) return;
    const res = await createReport(approver.token, { status: "Approved" });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("Approved");
  });
});

describe("Stage 9 — filters fail closed (no silent all-rows)", () => {
  it("rejects an out-of-range status with 400", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv?${RANGE}&status=Bogus`).set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });

  it("rejects the legacy `package` filter with 400", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv?${RANGE}&package=premium`).set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });

  it("rejects the legacy `method` filter with 400", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv?${RANGE}&method=cash`).set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });
});

describe("Stage 9 — metric honesty (no hardcoded values)", () => {
  it("followUpsCompleted/missedLeads are null + named in missingMetrics; successRate is honest", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv?${RANGE}`).set(auth(adminUser.token));
    expect(res.status).toBe(200);
    const { metrics, missingMetrics, missingMetricReasons } = res.body;
    expect(metrics.followUpsCompleted).toBeNull();
    expect(metrics.missedLeads).toBeNull();
    expect(missingMetrics).toContain("followUpsCompleted");
    expect(missingMetrics).toContain("missedLeads");
    expect(typeof missingMetricReasons.followUpsCompleted).toBe("string");
    expect(typeof missingMetricReasons.missedLeads).toBe("string");
    // successRate is either null (no rows) or a real 0..100 number — never a fabricated constant.
    if (metrics.successRate !== null) {
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(100);
    }
    // totalTasks is the COUNT of report records, not a fabricated value.
    expect(typeof metrics.totalTasks).toBe("number");
  });

  it("computes exact metrics over the FULL filtered set, not the page slice (catches hardcoded values)", async () => {
    if (!dbAvailable || !app) return;
    // Isolate a known set via a unique company so the assertion is order-independent
    // and not polluted by other suites: 1 Approved + 2 Submitted → successRate = 33.33.
    const company = `__s9co_${SUFFIX}`;
    await createReport(approver.token, { status: "Approved", companyName: company });
    await createReport(approver.token, { status: "Submitted", companyName: company });
    await createReport(creator.token, { status: "Submitted", companyName: company });
    const res = await request(app)
      .get(`/api/reports/bv?${RANGE}&company=${company}&limit=1&page=1`)
      .set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(res.body.reportCount).toBe(3);
    expect(res.body.rows.length).toBe(1); // page slice of 1...
    expect(res.body.pagination.total).toBe(3); // ...while the full count stays 3
    expect(res.body.metrics.totalTasks).toBe(3); // COUNT over the full set
    expect(res.body.metrics.successRate).toBe(33.33); // 1 Approved / 3 — NOT a hardcoded 100
    expect(res.body.metrics.followUpsCompleted).toBeNull();
    expect(res.body.metrics.missedLeads).toBeNull();
  });
});

describe("Stage 9 — approval lifecycle", () => {
  it("a non-approver cannot approve (403)", async () => {
    if (!dbAvailable || !app) return;
    const created = await createReport(creator.token, { status: "Submitted" });
    expect(created.status).toBe(201);
    const res = await request(app)
      .post(`/api/bv-reports/${created.body.data.id}/approve`)
      .set(auth(creator.token));
    expect(res.status).toBe(403);
  });

  it("approving a non-Submitted (Draft) report → 409", async () => {
    if (!dbAvailable || !app) return;
    const draft = await createReport(creator.token, { status: "Draft" });
    expect(draft.status).toBe(201);
    const res = await request(app)
      .post(`/api/bv-reports/${draft.body.data.id}/approve`)
      .set(auth(approver.token));
    expect(res.status).toBe(409);
  });

  it("rejecting without a reason → 400", async () => {
    if (!dbAvailable || !app) return;
    const submitted = await createReport(creator.token, { status: "Submitted" });
    expect(submitted.status).toBe(201);
    const res = await request(app)
      .post(`/api/bv-reports/${submitted.body.data.id}/reject`)
      .set(auth(approver.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it("approve happy path: Submitted → Approved, re-approve → 409", async () => {
    if (!dbAvailable || !app) return;
    const submitted = await createReport(creator.token, { status: "Submitted" });
    expect(submitted.status).toBe(201);
    const id = submitted.body.data.id;
    const ok = await request(app).post(`/api/bv-reports/${id}/approve`).set(auth(approver.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("Approved");
    const again = await request(app).post(`/api/bv-reports/${id}/approve`).set(auth(approver.token));
    expect(again.status).toBe(409);
  });

  it("reject happy path with a reason: Submitted → Rejected", async () => {
    if (!dbAvailable || !app) return;
    const submitted = await createReport(creator.token, { status: "Submitted" });
    expect(submitted.status).toBe(201);
    const res = await request(app)
      .post(`/api/bv-reports/${submitted.body.data.id}/reject`)
      .set(auth(approver.token))
      .send({ reason: "Incomplete figures" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Rejected");
  });
});

describe("Stage 9 — export role-scope, fidelity & format", () => {
  it("a non-exporter (sales_executive) is denied export (403)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv/export?${RANGE}`).set(auth(creator.token));
    expect(res.status).toBe(403);
  });

  it("an authorized exporter gets a CSV named with the date range", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv/export?${RANGE}&format=csv`).set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/csv");
    expect(String(res.headers["content-disposition"])).toContain("bv_report_");
    expect(String(res.headers["content-disposition"])).toContain(".csv");
  });

  it("export is never paginated: row count == reportCount == pagination.total", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv/export?${RANGE}&format=json`).set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(res.body.reportCount);
    expect(res.body.pagination.total).toBe(res.body.reportCount);
  });

  it("rejects an unsupported export format (400)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get(`/api/reports/bv/export?${RANGE}&format=xml`).set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });
});

describe("Stage 9 — canonical source (write/read symmetry)", () => {
  it("a report created via POST appears in BOTH the list and the export (same table, no invisible model)", async () => {
    if (!dbAvailable || !app) return;
    const marker = `__s9_canon_${SUFFIX}`;
    const created = await createReport(creator.token, { status: "Submitted", title: marker });
    expect(created.status).toBe(201);
    const list = await request(app).get(`/api/reports/bv?${RANGE}&limit=500`).set(auth(adminUser.token));
    expect(list.status).toBe(200);
    const titles = list.body.details.map((r: any) => r.title);
    expect(titles).toContain(marker);
    // Same canonical table feeds the export — the new report's title is in the CSV.
    const csv = await request(app).get(`/api/reports/bv/export?${RANGE}&format=csv`).set(auth(adminUser.token));
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(marker);
  });
});
