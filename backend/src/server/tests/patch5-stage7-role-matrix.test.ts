/**
 * Patch 5 Stage 7 — Service-Executive GM / Manual-Invoice role matrix (P13) +
 * Accounts dashboard smoke tests (P11/P12), DB-backed.
 *
 * Stage 7 is thin/additive. The server already owns the GM-create and
 * manual-invoice permission gates; this suite locks that behavior down through
 * the real wiring (registerRoutes(), the same entrypoint as server/index.ts):
 *
 *   - POST /api/gm is gated by requireGmSalesActionPermission(GM_CREATE). With the
 *     default config a sales_executive may create (entry gate + FULL narrow both
 *     admit it); a service_executive is admitted ONLY when serviceExecutiveCanCreateGM
 *     is on; hod / account_manager are never admitted on this route; admin bypasses;
 *     an unauthenticated request is 401 (never a silent 404).
 *   - POST /api/invoices is gated by requireManualInvoiceCreator(). admin /
 *     sales_executive / sales_manager are admitted; a service_executive is admitted
 *     ONLY when serviceExecutiveCanCreateManualInvoice is on; hod / account_manager
 *     are denied on THIS route (account_manager creates invoices via the account
 *     route's extraAllowedRoles, not here); unauthenticated is 401.
 *   - The new read surfaces (ui-config, gm-summary, gm-entries/:id/invoices) answer
 *     with the {success,data} envelope and 404 (not 500/200) for a missing GM.
 *
 * The permission middleware runs before each handler, so denied roles get 403
 * regardless of body; admitted roles get PAST the gate (their request then fails
 * downstream validation with 400, which still proves the boundary was crossed —
 * we assert only that it is NOT 403/401).
 *
 * Resilient: if the dev Postgres pool is unreachable the suite soft-skips rather
 * than failing the build (mirrors the other *-routes.test.ts suites). The two
 * service-executive config flags are snapshotted before the run and restored
 * after, and each service-executive case sets the flag it needs explicitly so the
 * cases never depend on ordering. Seeded users are cleaned up afterwards.
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import { getConfig, patchConfig } from "./services/gm-sales-config.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let app: Express | null = null;
let dbAvailable = false;

const createdUserIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
  email: string;
}

async function seedUser(role: string, branch = "Lahore Gulburg"): Promise<SeededUser> {
  const username = `__s7_${role}_${SUFFIX}_${createdUserIds.length}`;
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

// A minimal GM body — enough to clear createSchema for admitted roles is NOT
// required: admitted roles legitimately fail body validation (400) AFTER the
// permission gate, which still proves they were not blocked (403). Denied roles
// never reach the handler. We send a small body so the resolved type is FULL.
const GM_BODY = { companyName: `__s7_co_${SUFFIX}` };
const INVOICE_BODY = { customerName: `__s7_inv_${SUFFIX}`, amount: 1 };

let admin: SeededUser;
let salesExec: SeededUser;
let serviceExec: SeededUser;
let salesManager: SeededUser;
let hod: SeededUser;
let accountManager: SeededUser;

// Snapshot of the two service-executive flags so we can restore exactly.
let originalCanCreateGm = false;
let originalCanCreateManualInvoice = false;

async function setServiceExecGm(enabled: boolean) {
  await patchConfig({ serviceExecutiveCanCreateGM: enabled }, "__s7_test");
}
async function setServiceExecManualInvoice(enabled: boolean) {
  await patchConfig({ serviceExecutiveCanCreateManualInvoice: enabled }, "__s7_test");
}

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

  const cfg = (await getConfig()).config;
  originalCanCreateGm = cfg.serviceExecutiveCanCreateGM;
  originalCanCreateManualInvoice = cfg.serviceExecutiveCanCreateManualInvoice;

  admin = await seedUser("admin");
  salesExec = await seedUser("sales_executive");
  serviceExec = await seedUser("service_executive");
  salesManager = await seedUser("sales_manager");
  hod = await seedUser("hod");
  accountManager = await seedUser("account_manager");
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      // Restore the config flags to their pre-test values.
      await setServiceExecGm(originalCanCreateGm);
      await setServiceExecManualInvoice(originalCanCreateManualInvoice);
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[stage7.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("Stage 7 — POST /api/gm role matrix (GM_CREATE gate)", () => {
  it("rejects an unauthenticated GM create with 401 (never 404)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/gm").send(GM_BODY);
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("admits a sales_executive past the permission gate (default config)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/gm").set(auth(salesExec.token)).send(GM_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });

  it("admits an admin past the permission gate (bypass)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/gm").set(auth(admin.token)).send(GM_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });

  it("denies a hod (not a GM initiator on this route) with 403", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/gm").set(auth(hod.token)).send(GM_BODY);
    expect(res.status).toBe(403);
  });

  it("denies an account_manager (uses the account GM route, not this one) with 403", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/gm").set(auth(accountManager.token)).send(GM_BODY);
    expect(res.status).toBe(403);
  });

  it("denies a service_executive when serviceExecutiveCanCreateGM is OFF", async () => {
    if (!dbAvailable || !app) return;
    await setServiceExecGm(false);
    const res = await request(app).post("/api/gm").set(auth(serviceExec.token)).send(GM_BODY);
    expect(res.status).toBe(403);
  });

  it("admits a service_executive when serviceExecutiveCanCreateGM is ON", async () => {
    if (!dbAvailable || !app) return;
    await setServiceExecGm(true);
    const res = await request(app).post("/api/gm").set(auth(serviceExec.token)).send(GM_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });
});

describe("Stage 7 — POST /api/invoices role matrix (manual-invoice gate)", () => {
  it("rejects an unauthenticated invoice create with 401 (never 404)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").send(INVOICE_BODY);
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("admits a sales_executive past the manual-invoice gate", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").set(auth(salesExec.token)).send(INVOICE_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });

  it("admits a sales_manager past the manual-invoice gate", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").set(auth(salesManager.token)).send(INVOICE_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });

  it("admits an admin past the manual-invoice gate", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").set(auth(admin.token)).send(INVOICE_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });

  it("denies a hod on this route with 403", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").set(auth(hod.token)).send(INVOICE_BODY);
    expect(res.status).toBe(403);
  });

  it("denies an account_manager on THIS route with 403 (account route admits them, not /api/invoices)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).post("/api/invoices").set(auth(accountManager.token)).send(INVOICE_BODY);
    expect(res.status).toBe(403);
  });

  it("denies a service_executive when serviceExecutiveCanCreateManualInvoice is OFF", async () => {
    if (!dbAvailable || !app) return;
    await setServiceExecManualInvoice(false);
    const res = await request(app).post("/api/invoices").set(auth(serviceExec.token)).send(INVOICE_BODY);
    expect(res.status).toBe(403);
  });

  it("admits a service_executive when serviceExecutiveCanCreateManualInvoice is ON", async () => {
    if (!dbAvailable || !app) return;
    await setServiceExecManualInvoice(true);
    const res = await request(app).post("/api/invoices").set(auth(serviceExec.token)).send(INVOICE_BODY);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
    expect(res.status).toBeLessThan(500); // admitted -> reaches validation, never a masked 5xx
  });
});

describe("Stage 7 — read surfaces answer with the {success,data} envelope", () => {
  it("GET /api/gm-sales-workflow/ui-config returns the 3 UI flags to any authed user", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/gm-sales-workflow/ui-config").set(auth(salesExec.token));
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.data?.verificationManagerRequiredAfterQa).toBe("boolean");
    expect(typeof res.body?.data?.serviceExecutiveCanCreateGM).toBe("boolean");
    expect(typeof res.body?.data?.serviceExecutiveCanCreateManualInvoice).toBe("boolean");
  });

  it("GET /api/gm-sales-workflow/ui-config rejects an unauthenticated caller with 401", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/gm-sales-workflow/ui-config");
    expect(res.status).toBe(401);
  });

  it("GET /api/accounts/dashboard/gm-summary returns totals/byStatus/recentGms", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/accounts/dashboard/gm-summary").set(auth(accountManager.token));
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.totals).toBeTruthy();
    expect(Array.isArray(res.body?.data?.byStatus)).toBe(true);
    expect(Array.isArray(res.body?.data?.recentGms)).toBe(true);
  });

  it("GET /api/accounts/dashboard/gm-summary honors an invalid gmType with 400 (zod guard)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/accounts/dashboard/gm-summary?gmType=NONSENSE")
      .set(auth(accountManager.token));
    expect(res.status).toBe(400);
  });

  it("GET /api/account/gm-entries/:id/invoices returns 404 for a missing GM", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/account/gm-entries/00000000-0000-0000-0000-000000000000/invoices")
      .set(auth(accountManager.token));
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe("GM_NOT_FOUND");
  });
});
