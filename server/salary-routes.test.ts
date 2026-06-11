/**
 * Task #32 — automated tests for the salary payroll workflow.
 *
 * Three layers, all under the existing `npm test` (vitest) setup:
 *
 *   1. Pure-unit tests of the payroll math (computeSalaryLine): gross,
 *      deductions, net and payable — the most sensitive part of the feature.
 *   2. Pure-unit tests of the lifecycle transition tables (ALLOWED_NEXT /
 *      LOCKED_STATUSES / STATUS_ACTION) which back the route's 409 responses:
 *      legal DRAFT→GENERATED→APPROVED→FINALIZED flow, illegal jumps, and the
 *      finalize/locked immutability rule.
 *   3. Pure-unit tests of the per-action permission matrix
 *      (salaryClassForRole / classCan): e.g. executive cannot
 *      preview/generate/export, HOD may view+approve only.
 *
 * Plus a DB-backed integration layer (seeded users + JWTs minted via
 * authService, seeded salary runs/items, cleaned up afterwards) that exercises
 * the real route behaviour through supertest: legal lifecycle success, illegal
 * transition 409s, FINALIZED immutability (status + line edit), the duplicate-
 * finalized guard, executive preview/generate/export denial, and HOD
 * own-department vs cross-department approval. A thin wiring layer also asserts
 * the endpoints sit behind the auth gate (401, never 404).
 *
 * Every DB-touching test soft-skips when the dev Postgres pool is unreachable,
 * mirroring the other suites so CI stays green offline.
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";
import {
  computeSalaryLine,
  salaryClassForRole,
  classCan,
  CLASS_ACTIONS,
  ALLOWED_NEXT,
  LOCKED_STATUSES,
  STATUS_ACTION,
  type SalaryAction,
} from "./salary-routes";

// ---------------------------------------------------------------------------
// 1. Payroll math — computeSalaryLine.
// ---------------------------------------------------------------------------

describe("computeSalaryLine — payroll formulas", () => {
  it("computes per-day salary as basic/30", () => {
    const r = computeSalaryLine({ basicSalary: 30000 });
    expect(r.perDaySalary).toBe(1000);
  });

  it("with no deductions, gross = net = payable = basic", () => {
    const r = computeSalaryLine({ basicSalary: 30000 });
    expect(r.grossSalary).toBe(30000);
    expect(r.totalDeductions).toBe(0);
    expect(r.netSalary).toBe(30000);
    expect(r.payableSalary).toBe(30000);
  });

  it("adds allowance, bonus and overtime into gross", () => {
    const r = computeSalaryLine({
      basicSalary: 30000,
      allowanceAmount: 2000,
      bonusAmount: 1500,
      overtimeAmount: 500,
    });
    // 30000 + 2000 + 1500 + 500
    expect(r.grossSalary).toBe(34000);
    expect(r.netSalary).toBe(34000);
  });

  it("deducts absence and unpaid leave at the per-day rate", () => {
    const r = computeSalaryLine({
      basicSalary: 30000, // perDay = 1000
      daysAbsent: 2, // 2000
      unpaidLeaveDays: 3, // 3000
    });
    expect(r.absenceDeduction).toBe(2000);
    expect(r.unpaidLeaveDeduction).toBe(3000);
    expect(r.totalDeductions).toBe(5000);
    expect(r.netSalary).toBe(25000);
    expect(r.payableSalary).toBe(25000);
  });

  it("includes penalty, loan and other amounts in total deductions", () => {
    const r = computeSalaryLine({
      basicSalary: 30000,
      penaltyAmount: 1000,
      loanDeduction: 500,
      otherDeductions: 250,
    });
    expect(r.totalDeductions).toBe(1750);
    expect(r.netSalary).toBe(28250);
  });

  it("never returns a late deduction (no late-penalty policy)", () => {
    const r = computeSalaryLine({ basicSalary: 30000, daysAbsent: 5 });
    expect(r.lateDeduction).toBe(0);
  });

  it("floors payable salary at 0 when net is negative", () => {
    const r = computeSalaryLine({
      basicSalary: 10000, // perDay ~333.33
      daysAbsent: 30, // ~10000 absence
      penaltyAmount: 5000,
    });
    expect(r.netSalary).toBeLessThan(0);
    expect(r.payableSalary).toBe(0);
  });

  it("rounds money to 2 decimal places", () => {
    const r = computeSalaryLine({ basicSalary: 10000 }); // perDay = 333.33
    expect(r.perDaySalary).toBe(333.33);
    const r2 = computeSalaryLine({ basicSalary: 10000, daysAbsent: 1 });
    expect(r2.absenceDeduction).toBe(333.33);
  });

  it("treats missing/blank inputs as 0 — never fabricates amounts", () => {
    const r = computeSalaryLine({ basicSalary: 30000 });
    expect(r.allowanceAmount).toBe(0);
    expect(r.bonusAmount).toBe(0);
    expect(r.overtimeAmount).toBe(0);
    expect(r.loanDeduction).toBe(0);
    expect(r.otherDeductions).toBe(0);
    expect(r.penaltyAmount).toBe(0);
  });

  it("parses string/comma-formatted money inputs", () => {
    const r = computeSalaryLine({ basicSalary: "30,000", bonusAmount: "1,500" });
    expect(r.basicSalary).toBe(30000);
    expect(r.bonusAmount).toBe(1500);
    expect(r.grossSalary).toBe(31500);
  });

  it("full worked example reconciles gross/deductions/net/payable", () => {
    const r = computeSalaryLine({
      basicSalary: 30000, // perDay 1000
      daysAbsent: 1, // 1000
      unpaidLeaveDays: 2, // 2000
      penaltyAmount: 500,
      loanDeduction: 1000,
      otherDeductions: 250,
      allowanceAmount: 3000,
      bonusAmount: 2000,
      overtimeAmount: 1000,
    });
    expect(r.grossSalary).toBe(36000); // 30000+3000+2000+1000
    expect(r.totalDeductions).toBe(4750); // 1000+2000+500+1000+250
    expect(r.netSalary).toBe(31250);
    expect(r.payableSalary).toBe(31250);
    // sanity: net = gross - deductions
    expect(r.netSalary).toBe(r.grossSalary - r.totalDeductions);
  });
});

// ---------------------------------------------------------------------------
// 2. Lifecycle transition tables (back the route's 409s).
// ---------------------------------------------------------------------------

function canTransition(from: string, to: string): boolean {
  if (LOCKED_STATUSES.has(from)) return false;
  return (ALLOWED_NEXT[from] || []).includes(to);
}

describe("salary lifecycle transitions", () => {
  it("allows the happy path DRAFT→GENERATED→APPROVED→FINALIZED", () => {
    expect(canTransition("DRAFT", "GENERATED")).toBe(true);
    expect(canTransition("GENERATED", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "FINALIZED")).toBe(true);
  });

  it("allows cancelling from any pre-finalized state", () => {
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransition("GENERATED", "CANCELLED")).toBe(true);
    expect(canTransition("APPROVED", "CANCELLED")).toBe(true);
  });

  it("rejects skipping stages (these map to 409 in the route)", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("DRAFT", "FINALIZED")).toBe(false);
    expect(canTransition("GENERATED", "FINALIZED")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("APPROVED", "GENERATED")).toBe(false);
    expect(canTransition("GENERATED", "DRAFT")).toBe(false);
  });

  it("treats FINALIZED and LOCKED as immutable (no further transitions)", () => {
    expect(LOCKED_STATUSES.has("FINALIZED")).toBe(true);
    expect(LOCKED_STATUSES.has("LOCKED")).toBe(true);
    expect(ALLOWED_NEXT.FINALIZED).toEqual([]);
    expect(ALLOWED_NEXT.LOCKED).toEqual([]);
    expect(canTransition("FINALIZED", "APPROVED")).toBe(false);
    expect(canTransition("FINALIZED", "CANCELLED")).toBe(false);
    expect(canTransition("LOCKED", "FINALIZED")).toBe(false);
  });

  it("a CANCELLED run is terminal", () => {
    expect(ALLOWED_NEXT.CANCELLED).toEqual([]);
    expect(canTransition("CANCELLED", "GENERATED")).toBe(false);
  });

  it("maps each target status to the permission action it requires", () => {
    expect(STATUS_ACTION.GENERATED).toBe("generate");
    expect(STATUS_ACTION.APPROVED).toBe("approve");
    expect(STATUS_ACTION.FINALIZED).toBe("finalize");
    expect(STATUS_ACTION.CANCELLED).toBe("cancel");
  });
});

// ---------------------------------------------------------------------------
// 3. Per-action permission matrix.
// ---------------------------------------------------------------------------

describe("salaryClassForRole — role → class resolution", () => {
  it("maps admin variants to the full class", () => {
    for (const role of ["admin", "super_admin", "administrator"]) {
      expect(salaryClassForRole(role)).toBe("full");
    }
  });

  it("maps super_hod to the full class", () => {
    expect(salaryClassForRole("super_hod")).toBe("full");
  });

  it("maps account roles (incl. accountant/accounts_office) to accounts", () => {
    for (const role of ["account_manager", "accountant", "accounts_office"]) {
      expect(salaryClassForRole(role)).toBe("accounts");
    }
  });

  it("maps HR roles to the hr class", () => {
    expect(salaryClassForRole("hr")).toBe("hr");
    expect(salaryClassForRole("hr_manager")).toBe("hr");
  });

  it("maps hod to the hod class", () => {
    expect(salaryClassForRole("hod")).toBe("hod");
  });

  it("maps other managerial roles to the manager class", () => {
    expect(salaryClassForRole("sales_manager")).toBe("manager");
  });

  it("falls back to the executive class for non-managerial roles", () => {
    expect(salaryClassForRole("sales_executive")).toBe("executive");
    expect(salaryClassForRole("executive")).toBe("executive");
  });
});

describe("classCan — per-action capability matrix", () => {
  const allActions: SalaryAction[] = [
    "preview", "generate", "view", "export", "approve", "finalize", "edit", "cancel",
  ];

  it("full and accounts may do every action", () => {
    for (const action of allActions) {
      expect(classCan("full", action)).toBe(true);
      expect(classCan("accounts", action)).toBe(true);
    }
  });

  it("HR may preview/generate/export/approve/edit but NOT finalize", () => {
    expect(classCan("hr", "preview")).toBe(true);
    expect(classCan("hr", "generate")).toBe(true);
    expect(classCan("hr", "export")).toBe(true);
    expect(classCan("hr", "approve")).toBe(true);
    expect(classCan("hr", "edit")).toBe(true);
    expect(classCan("hr", "finalize")).toBe(false);
  });

  it("HOD may only view and approve", () => {
    expect(classCan("hod", "view")).toBe(true);
    expect(classCan("hod", "approve")).toBe(true);
    for (const action of ["preview", "generate", "export", "finalize", "edit", "cancel"] as SalaryAction[]) {
      expect(classCan("hod", action)).toBe(false);
    }
  });

  it("manager and executive may only view", () => {
    for (const cls of ["manager", "executive"] as const) {
      expect(classCan(cls, "view")).toBe(true);
      for (const action of ["preview", "generate", "export", "approve", "finalize", "edit", "cancel"] as SalaryAction[]) {
        expect(classCan(cls, action)).toBe(false);
      }
    }
  });

  it("executive cannot preview, generate or export (explicit task requirement)", () => {
    const cls = salaryClassForRole("sales_executive");
    expect(cls).toBe("executive");
    expect(classCan(cls, "preview")).toBe(false);
    expect(classCan(cls, "generate")).toBe(false);
    expect(classCan(cls, "export")).toBe(false);
  });

  it("the matrix exposes a class for every role bucket", () => {
    expect(Object.keys(CLASS_ACTIONS).sort()).toEqual(
      ["accounts", "executive", "full", "hod", "hr", "manager"],
    );
  });
});

// ---------------------------------------------------------------------------
// 4. HTTP wiring — salary endpoints sit behind the auth gate (resilient).
// ---------------------------------------------------------------------------

let app: Express | null = null;
let dbAvailable = false;

// Seeded fixtures (only populated when the DB is reachable). Cleaned up in
// afterAll. Unique markers keep these isolated from real data, and a far-future
// period (year 2099) is used per-scenario so finalize guards never collide.
const DEPT_A = "__SalTestDeptA";
const DEPT_B = "__SalTestDeptB";
const createdRunIds: string[] = [];
const createdUserIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
  email: string;
}
let adminUser: SeededUser;
let hodAUser: SeededUser;
let execUser: SeededUser;
let empUser: SeededUser;

async function seedUser(role: string, department: string | null): Promise<SeededUser> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `__saltest_${role}_${suffix}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, department, is_active)
     VALUES ($1, $2, $3, $3, $4, true) RETURNING id`,
    [username, email, role, department],
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
  return { id, token, email };
}

async function seedRun(opts: {
  status: string;
  month: number;
  year: number;
  department: string | null;
  employee: SeededUser;
  employeeName: string;
}): Promise<{ runId: string; itemId: string }> {
  const runRes = await pool.query(
    `INSERT INTO drm.salary_runs
       (period_month, period_year, department, status, employee_count,
        total_gross, total_deductions, total_net, created_by_user_id)
     VALUES ($1, $2, $3, $4, 1, 30000, 0, 30000, $5) RETURNING id`,
    [opts.month, opts.year, opts.department, opts.status, adminUser.id],
  );
  const runId = String(runRes.rows[0].id);
  createdRunIds.push(runId);
  const itemRes = await pool.query(
    `INSERT INTO drm.salary_run_items
       (run_id, user_id, employee_name, department, basic_salary, gross_salary,
        per_day_salary, net_salary, total_deductions, payable_salary, payment_status)
     VALUES ($1, $2, $3, $4, 30000, 30000, 1000, 30000, 0, 30000, 'UNPAID') RETURNING id`,
    [runId, opts.employee.id, opts.employeeName, opts.department],
  );
  return { runId, itemId: String(itemRes.rows[0].id) };
}

beforeAll(async () => {
  try {
    await pool.query("SELECT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  if (dbAvailable) {
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    adminUser = await seedUser("admin", null);
    hodAUser = await seedUser("hod", DEPT_A);
    execUser = await seedUser("sales_executive", DEPT_A);
    empUser = await seedUser("sales_executive", DEPT_A);
  }
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      // Runs first (salary_run_items cascade), then the seeded users they FK to.
      if (createdRunIds.length) {
        await pool.query(`DELETE FROM drm.salary_runs WHERE id = ANY($1)`, [createdRunIds]);
      }
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1)`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[salary-routes.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("salary workflow — route-level integration (DB-backed)", () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("walks the legal lifecycle DRAFT→GENERATED→APPROVED→FINALIZED via the API", async () => {
    if (!dbAvailable || !app) return;
    const { runId } = await seedRun({
      status: "DRAFT", month: 1, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });

    let res = await request(app).patch(`/api/salary/runs/${runId}/status`).set(auth(adminUser.token)).send({ status: "GENERATED" });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("GENERATED");

    res = await request(app).patch(`/api/salary/runs/${runId}/status`).set(auth(adminUser.token)).send({ status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("APPROVED");

    res = await request(app).patch(`/api/salary/runs/${runId}/status`).set(auth(adminUser.token)).send({ status: "FINALIZED" });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("FINALIZED");
  });

  it("rejects illegal transitions with 409", async () => {
    if (!dbAvailable || !app) return;
    const draft = await seedRun({
      status: "DRAFT", month: 2, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    // DRAFT cannot jump straight to FINALIZED or APPROVED.
    let res = await request(app).patch(`/api/salary/runs/${draft.runId}/status`).set(auth(adminUser.token)).send({ status: "FINALIZED" });
    expect(res.status).toBe(409);
    res = await request(app).patch(`/api/salary/runs/${draft.runId}/status`).set(auth(adminUser.token)).send({ status: "APPROVED" });
    expect(res.status).toBe(409);

    // GENERATED cannot skip APPROVED.
    const gen = await seedRun({
      status: "GENERATED", month: 2, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    res = await request(app).patch(`/api/salary/runs/${gen.runId}/status`).set(auth(adminUser.token)).send({ status: "FINALIZED" });
    expect(res.status).toBe(409);
  });

  it("treats a FINALIZED run as immutable (status change and line edit both 409)", async () => {
    if (!dbAvailable || !app) return;
    const { runId, itemId } = await seedRun({
      status: "FINALIZED", month: 3, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });

    const statusRes = await request(app).patch(`/api/salary/runs/${runId}/status`).set(auth(adminUser.token)).send({ status: "CANCELLED" });
    expect(statusRes.status).toBe(409);
    expect(String(statusRes.body.error)).toMatch(/cannot be modified/i);

    const editRes = await request(app).patch(`/api/salary/run-items/${itemId}`).set(auth(adminUser.token)).send({ bonusAmount: 100 });
    expect(editRes.status).toBe(409);
    expect(String(editRes.body.error)).toMatch(/DRAFT or GENERATED/i);
  });

  it("blocks finalizing when the same employee already has a FINALIZED run in the period (duplicate guard)", async () => {
    if (!dbAvailable || !app) return;
    // Existing finalized run for the employee in this period.
    await seedRun({
      status: "FINALIZED", month: 4, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    // A second run (APPROVED) for the SAME employee + period.
    const runB = await seedRun({
      status: "APPROVED", month: 4, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });

    const res = await request(app).patch(`/api/salary/runs/${runB.runId}/status`).set(auth(adminUser.token)).send({ status: "FINALIZED" });
    expect(res.status).toBe(409);
    expect(res.body.employees).toContain("Test Employee");
  });

  it("denies an executive from previewing, generating or exporting salary (403)", async () => {
    if (!dbAvailable || !app) return;
    const preview = await request(app).get("/api/salary/preview?month=1&year=2099").set(auth(execUser.token));
    expect(preview.status).toBe(403);

    const create = await request(app).post("/api/salary/runs").set(auth(execUser.token)).send({ month: 1, year: 2099, mode: "DRAFT" });
    expect(create.status).toBe(403);

    const exp = await request(app).get("/api/reports/salary/export").set(auth(execUser.token));
    expect(exp.status).toBe(403);
  });

  it("lets an HOD approve their own department but not another department's run", async () => {
    if (!dbAvailable || !app) return;
    // Own department (A): GENERATED → APPROVED allowed.
    const own = await seedRun({
      status: "GENERATED", month: 5, year: 2099, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    const okRes = await request(app).patch(`/api/salary/runs/${own.runId}/status`).set(auth(hodAUser.token)).send({ status: "APPROVED" });
    expect(okRes.status).toBe(200);
    expect(okRes.body.run.status).toBe("APPROVED");

    // Other department (B): same HOD is denied with 403.
    const other = await seedRun({
      status: "GENERATED", month: 6, year: 2099, department: DEPT_B,
      employee: empUser, employeeName: "Test Employee",
    });
    const denyRes = await request(app).patch(`/api/salary/runs/${other.runId}/status`).set(auth(hodAUser.token)).send({ status: "APPROVED" });
    expect(denyRes.status).toBe(403);
    expect(String(denyRes.body.error)).toMatch(/own department/i);
  });
});

// ---------------------------------------------------------------------------
// 5. Highest-risk money paths against a live DB (Task #35):
//      a) the duplicate-FINALIZED guard on BOTH the create path
//         (POST /api/salary/runs) and the finalize path
//         (PATCH /api/salary/runs/:id/status), and
//      b) parent-run total recomputation after a line edit
//         (PATCH /api/salary/run-items/:id).
//    These were previously only verified by the pure transition table; here we
//    seed real rows and drive the real routes through supertest.
// ---------------------------------------------------------------------------

describe("salary money-path safety (DB-backed, Task #35)", () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("once an employee is FINALIZED in a period, a second CREATE 409s and a second FINALIZE 409s", async () => {
    if (!dbAvailable || !app) return;
    const month = 7, year = 2099;

    // First run for the employee in this period — take it all the way to FINALIZED.
    const first = await seedRun({
      status: "APPROVED", month, year, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    let res = await request(app)
      .patch(`/api/salary/runs/${first.runId}/status`)
      .set(auth(adminUser.token))
      .send({ status: "FINALIZED" });
    expect(res.status).toBe(200);
    expect(res.body.run.status).toBe("FINALIZED");

    // Create-path guard: POST a new run scoped to the same employee + period.
    const createRes = await request(app)
      .post("/api/salary/runs")
      .set(auth(adminUser.token))
      .send({ month, year, mode: "DRAFT", employeeId: empUser.id });
    expect(createRes.status).toBe(409);
    expect(createRes.body.employees).toContain("Test Employee");

    // Finalize-path guard: an independently-seeded APPROVED run for the same
    // employee + period cannot be finalized while the first one is finalized.
    const second = await seedRun({
      status: "APPROVED", month, year, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });
    res = await request(app)
      .patch(`/api/salary/runs/${second.runId}/status`)
      .set(auth(adminUser.token))
      .send({ status: "FINALIZED" });
    expect(res.status).toBe(409);
    expect(res.body.employees).toContain("Test Employee");
  });

  it("recomputes the parent run's total_gross/total_deductions/total_net from its lines after a line edit", async () => {
    if (!dbAvailable || !app) return;
    const month = 8, year = 2099;
    // seedRun creates one GENERATED line: basic 30000, gross 30000, deductions 0, net 30000.
    const { runId, itemId } = await seedRun({
      status: "GENERATED", month, year, department: DEPT_A,
      employee: empUser, employeeName: "Test Employee",
    });

    // Edit the editable manual fields: +5000 bonus (gross), +1000 loan (deduction).
    const editRes = await request(app)
      .patch(`/api/salary/run-items/${itemId}`)
      .set(auth(adminUser.token))
      .send({ bonusAmount: 5000, loanDeduction: 1000 });
    expect(editRes.status).toBe(200);
    // Line: gross 30000+5000=35000, deductions 0+1000=1000, net 34000.
    expect(Number(editRes.body.item.gross_salary)).toBe(35000);
    expect(Number(editRes.body.item.total_deductions)).toBe(1000);
    expect(Number(editRes.body.item.net_salary)).toBe(34000);

    // Parent run totals must be recomputed from the (single) line, not stale.
    const runRes = await request(app)
      .get(`/api/salary/runs/${runId}`)
      .set(auth(adminUser.token));
    expect(runRes.status).toBe(200);
    expect(Number(runRes.body.run.total_gross)).toBe(35000);
    expect(Number(runRes.body.run.total_deductions)).toBe(1000);
    expect(Number(runRes.body.run.total_net)).toBe(34000);
  });
});

describe("salary route wiring (behind the auth gate)", () => {
  const UUID = "00000000-0000-0000-0000-000000000000";

  it("GET /api/salary/preview rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get("/api/salary/preview?month=1&year=2026");
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("POST /api/salary/runs rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post("/api/salary/runs")
      .send({ month: 1, year: 2026, mode: "DRAFT" });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("GET /api/salary/runs rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get("/api/salary/runs");
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("PATCH /api/salary/runs/:id/status rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .patch(`/api/salary/runs/${UUID}/status`)
      .send({ status: "APPROVED" });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("GET /api/reports/salary/export rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get("/api/reports/salary/export");
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
