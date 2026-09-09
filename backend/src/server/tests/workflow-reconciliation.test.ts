/**
 * Phase 12 — Product Posting, PMS, QA, and Workflow Dependency UAT.
 *
 * UAT for GET /api/workflow/reconciliation (server/routes/workflow-reconciliation-routes.ts).
 * This route was fully built and documented (WORKFLOW_RECONCILIATION_REPORT.md)
 * but had zero automated test coverage before this phase. The route's own
 * code is NOT modified by this phase — this file only adds verification.
 * Does not assert `checkErrors` is empty: a documented, accepted
 * environment-drift item (a `department_type` column missing in some live
 * DBs, per .agents/memory/recon-department-type-drift.md) can legitimately
 * populate it independent of this phase's changes. Soft-skips if the dev
 * Postgres pool is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Workflow reconciliation route — Phase 12 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p12wr_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  let admin: SeededUser;
  let salesExec: SeededUser;

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
    salesExec = await seedUser("sales_executive");
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdInvoiceIds.length) {
          await pool.query(`DELETE FROM drm.product_posting_invoices WHERE id = ANY($1::uuid[])`, [
            createdInvoiceIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[workflow-reconciliation.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("returns 401 with no auth token", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/workflow/reconciliation");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin/non-HOD role", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/workflow/reconciliation").set(auth(salesExec.token));
    expect(res.status).toBe(403);
  });

  it("returns the documented response shape for admin", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }
    const res = await request(app).get("/api/workflow/reconciliation").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("generatedAt");
    expect(res.body).toHaveProperty("thresholds");
    expect(res.body).toHaveProperty("totalIssues");
    expect(res.body).toHaveProperty("summary");
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it("detects a real mismatch: an APPROVED invoice with no linked project", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const inv = await pool.query(
      `INSERT INTO drm.product_posting_invoices (sales_exec_id, status, company_name, project_name)
       VALUES ($1, 'APPROVED', $2, $3) RETURNING id`,
      [admin.id, `__p12wr Co ${SUFFIX}`, `__p12wr Project ${SUFFIX}`],
    );
    const invoiceId = String(inv.rows[0].id);
    createdInvoiceIds.push(invoiceId);

    const res = await request(app).get("/api/workflow/reconciliation").set(auth(admin.token));
    expect(res.status).toBe(200);

    const found = res.body.issues.find(
      (i: any) => i.type === "approved_invoice_without_project" && i.entityId === invoiceId,
    );
    expect(found).toBeTruthy();
    expect(found.severity).toBe("high");
  });
});
