/**
 * Phase 13 — Reports, Export Parity, and Business Signoff.
 *
 * The Diagnosis Report (server/diagnosis-report-routes.ts) had zero
 * automated test coverage before this phase. This file covers the
 * documented view-permission matrix (server/middleware/report-permission.ts's
 * diagnosis_report entry) — which this phase wired into the route for the
 * first time — plus filter validation and canonical-source (list vs export)
 * parity. Soft-skips if the dev Postgres pool is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Diagnosis Report — Phase 13 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdDiagnosisIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p13diag_${role}_${SUFFIX}_${createdUserIds.length}`;
    const email = `${username}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, is_active, full_name, password_hash)
       VALUES ($1, $2, $3, $3, true, $4, $5) RETURNING id`,
      [username, email, role, `Full Name ${username}`, "test_hash"],
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

  let accountManager: SeededUser;
  let hod: SeededUser;
  let salesExecutive: SeededUser;

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

    accountManager = await seedUser("account_manager");
    hod = await seedUser("hod");
    salesExecutive = await seedUser("sales_executive");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdDiagnosisIds.length) {
          await pool.query(`DELETE FROM drm.diagnosis_reports WHERE id = ANY($1::uuid[])`, [
            createdDiagnosisIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[diagnosis-report.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("returns 401 with no auth token", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/reports/diagnose");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a role outside the documented view matrix (the gate this phase wired in)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/reports/diagnose").set(auth(salesExecutive.token));
    expect(res.status).toBe(403);
  });

  it("allows account_manager and hod (both in the documented matrix) to view", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const amRes = await request(app).get("/api/reports/diagnose").set(auth(accountManager.token));
    expect(amRes.status).toBe(200);

    const hodRes = await request(app).get("/api/reports/diagnose").set(auth(hod.token));
    expect(hodRes.status).toBe(200);
  });

  it("rejects an invalid status filter with 400", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app)
      .get("/api/reports/diagnose?status=NOT_A_REAL_STATUS")
      .set(auth(accountManager.token));
    expect(res.status).toBe(400);
  });

  it("a created record appears in both the list and the export with matching content (canonical source, no drift)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const diagnosisType = `__p13diag type ${SUFFIX}`;
    const create = await request(app)
      .post("/api/reports/diagnose")
      .set(auth(accountManager.token))
      .send({ diagnosisDate: "2026-01-15", diagnosisType, companyName: `__p13diag Co ${SUFFIX}` });
    expect(create.status).toBe(201);
    createdDiagnosisIds.push(create.body.id);

    const list = await request(app)
      .get(`/api/reports/diagnose?diagnosisType=${encodeURIComponent(diagnosisType)}`)
      .set(auth(accountManager.token));
    expect(list.status).toBe(200);
    expect(list.body.rows.length).toBe(1);
    expect(list.body.rows[0].diagnosisType).toBe(diagnosisType);

    const exportRes = await request(app)
      .get(`/api/reports/diagnose/export?diagnosisType=${encodeURIComponent(diagnosisType)}`)
      .set(auth(accountManager.token));
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain(diagnosisType);
  });
});
