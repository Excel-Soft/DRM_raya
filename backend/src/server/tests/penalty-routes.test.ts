/**
 * Patch 2 Stage 2 — Penalty engine route-wiring tests.
 *
 * Pure-unit assertions on the exported penalty constants, plus resilient HTTP
 * assertions that the new/changed penalty endpoints sit behind the auth gate
 * (401 when unauthenticated, never 404 — the route must actually exist).
 *
 * The HTTP tests soft-skip when the dev Postgres pool is unreachable, mirroring
 * report-permission.test.ts / stage10-smoke.test.ts so CI stays green offline.
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import { PENALTY_STATUSES, PENALTY_HEADS } from "./services/penalty.service";

describe("penalty constants", () => {
  it("exposes the approval status vocabulary", () => {
    expect(Array.isArray(PENALTY_STATUSES)).toBe(true);
    expect(PENALTY_STATUSES).toContain("PENDING");
    expect(PENALTY_STATUSES).toContain("APPROVED");
    expect(PENALTY_STATUSES).toContain("REJECTED");
  });

  it("exposes a non-empty penalty-head list", () => {
    expect(Array.isArray(PENALTY_HEADS)).toBe(true);
    expect(PENALTY_HEADS.length).toBeGreaterThan(0);
  });
});

let app: Express | null = null;
let dbAvailable = false;

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
  }
});

afterAll(async () => {
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

describe("penalty route wiring (behind the auth gate)", () => {
  it("PATCH /api/penalties/:id/void rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .patch("/api/penalties/00000000-0000-0000-0000-000000000000/void")
      .send({ reason: "test" });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("PATCH /api/penalties/:id/approval rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .patch("/api/penalties/00000000-0000-0000-0000-000000000000/approval")
      .send({ approvalStatus: "APPROVED" });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it("GET /api/penalties/meta rejects unauthenticated requests with 401", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get("/api/penalties/meta");
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Phase 13 — DB-backed lifecycle, permission, and segregation-of-duties tests.
// Previously this file only asserted auth-gate 401s; the actual
// create/decide/void lifecycle, row-scoping, and (new this phase) the
// creator-cannot-decide-their-own-penalty guard had no automated coverage.
// ---------------------------------------------------------------------------
const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const DEPT_A = "__PenTestDeptA";
const DEPT_B = "__PenTestDeptB";
const createdUserIds: string[] = [];
const createdPenaltyIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
}

async function seedUser(role: string, department: string | null): Promise<SeededUser> {
  const username = `__p13pen_${role}_${SUFFIX}_${createdUserIds.length}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, department, is_active, full_name, password_hash)
     VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
    [username, email, role, department, `Full Name ${username}`, "test_hash"],
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

function penaltyBody(employeeId: string, overrides: Record<string, any> = {}) {
  return {
    employeeId,
    penaltyHead: "Missed Deadline",
    reason: `__p13pen reason ${SUFFIX}`,
    amount: 500,
    penaltyDate: "2026-01-15",
    ...overrides,
  };
}

describe("Penalty lifecycle, permissions, and segregation of duties — Phase 13", () => {
  let admin: SeededUser;
  let hodA: SeededUser;
  let hodB: SeededUser;
  let employeeA: SeededUser;

  beforeAll(async () => {
    if (!dbAvailable) return;
    admin = await seedUser("admin", null);
    hodA = await seedUser("hod", DEPT_A);
    hodB = await seedUser("hod", DEPT_B);
    employeeA = await seedUser("sales_executive", DEPT_A);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      if (createdPenaltyIds.length) {
        await pool.query(`DELETE FROM drm.penalties WHERE id = ANY($1::uuid[])`, [createdPenaltyIds]);
      }
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    } catch (err) {
      console.warn("[penalty-routes.test] Phase 13 cleanup failed:", err);
    }
  });

  it("creates a penalty as PENDING even when a decider supplies approvalStatus: Approved (auto-approve shortcut closed)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const res = await request(app)
      .post("/api/penalties")
      .set(auth(hodA.token))
      .send(penaltyBody(employeeA.id, { approvalStatus: "Approved" }));
    expect(res.status).toBe(201);
    createdPenaltyIds.push(res.body.penalty.id);
    expect(res.body.penalty.approvalStatus).toBe("PENDING");
  });

  it("blocks the creator from approving their own penalty, but allows a different decider", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const create = await request(app).post("/api/penalties").set(auth(hodA.token)).send(penaltyBody(employeeA.id));
    expect(create.status).toBe(201);
    const id = create.body.penalty.id;
    createdPenaltyIds.push(id);

    const selfApprove = await request(app)
      .patch(`/api/penalties/${id}/approval`)
      .set(auth(hodA.token))
      .send({ approvalStatus: "APPROVED" });
    expect(selfApprove.status).toBe(403);

    const otherApprove = await request(app)
      .patch(`/api/penalties/${id}/approval`)
      .set(auth(admin.token))
      .send({ approvalStatus: "APPROVED" });
    expect(otherApprove.status).toBe(200);
    expect(otherApprove.body.penalty.approvalStatus).toBe("APPROVED");
  });

  it("blocks the creator from voiding their own penalty, but allows a different decider (reason required)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const create = await request(app).post("/api/penalties").set(auth(admin.token)).send(penaltyBody(employeeA.id));
    expect(create.status).toBe(201);
    const id = create.body.penalty.id;
    createdPenaltyIds.push(id);

    // Approve it first (by a different actor, since admin created it).
    const approve = await request(app).patch(`/api/penalties/${id}/approval`).set(auth(hodA.token)).send({ approvalStatus: "APPROVED" });
    expect(approve.status).toBe(200);

    const selfVoid = await request(app).patch(`/api/penalties/${id}/void`).set(auth(admin.token)).send({ reason: "self void attempt" });
    expect(selfVoid.status).toBe(403);

    const noReason = await request(app).patch(`/api/penalties/${id}/void`).set(auth(hodA.token)).send({});
    expect(noReason.status).toBe(400);

    const voided = await request(app).patch(`/api/penalties/${id}/void`).set(auth(hodA.token)).send({ reason: "policy correction" });
    expect(voided.status).toBe(200);
    expect(voided.body.penalty.status).toBe("VOIDED");

    const reVoid = await request(app).patch(`/api/penalties/${id}/void`).set(auth(hodA.token)).send({ reason: "again" });
    expect(reVoid.status).toBe(409);

    const approveAfterVoid = await request(app).patch(`/api/penalties/${id}/approval`).set(auth(hodA.token)).send({ approvalStatus: "APPROVED" });
    expect(approveAfterVoid.status).toBe(409);
  });

  it("requires hodRemarks when rejecting a penalty", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const create = await request(app).post("/api/penalties").set(auth(admin.token)).send(penaltyBody(employeeA.id));
    expect(create.status).toBe(201);
    const id = create.body.penalty.id;
    createdPenaltyIds.push(id);

    const noRemarks = await request(app).patch(`/api/penalties/${id}/approval`).set(auth(hodA.token)).send({ approvalStatus: "REJECTED" });
    expect(noRemarks.status).toBe(400);

    const withRemarks = await request(app)
      .patch(`/api/penalties/${id}/approval`)
      .set(auth(hodA.token))
      .send({ approvalStatus: "REJECTED", hodRemarks: "insufficient evidence" });
    expect(withRemarks.status).toBe(200);
    expect(withRemarks.body.penalty.approvalStatus).toBe("REJECTED");
  });

  it("scopes create/decide to the HOD's own department — a cross-department attempt is forbidden", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const crossCreate = await request(app).post("/api/penalties").set(auth(hodB.token)).send(penaltyBody(employeeA.id));
    expect(crossCreate.status).toBe(403);

    const create = await request(app).post("/api/penalties").set(auth(hodA.token)).send(penaltyBody(employeeA.id));
    expect(create.status).toBe(201);
    const id = create.body.penalty.id;
    createdPenaltyIds.push(id);

    const crossDecide = await request(app).patch(`/api/penalties/${id}/approval`).set(auth(hodB.token)).send({ approvalStatus: "APPROVED" });
    expect(crossDecide.status).toBe(403);
  });
});
