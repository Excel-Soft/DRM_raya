/**
 * Reports module VAS Report — save-then-list workflow.
 *
 * Covers the fix for: reports created via the "+ New VAS Report" form
 * (POST /api/vas-reports -> vas_reports table) never appearing in the
 * Reports module's own listing (GET /api/reports/vas), because the listing
 * previously read from the unrelated office_vas/invoice tables instead.
 *
 * Exercises the real save path (vasReportsRepository.create, the same
 * function the HTTP route uses) and the real, fixed listing builder
 * (getVasReport), without going through the HTTP/auth layer — auth token
 * issuance in this checkout depends on a stubbed auth service unrelated to
 * this fix (see backend/src/server/tests/auth.service.ts), so HTTP-level
 * assertions here would be a false signal. Soft-skips if the dev Postgres
 * pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../db";
import { vasReportsRepository } from "../repositories/generic-report.repository";
import { getVasReport } from "../routes/reports-routes";

describe("Reports module VAS Report — save-then-list workflow", () => {
  let dbAvailable = false;
  let userId = "";
  const createdVasReportIds: string[] = [];

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1");
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
    if (!dbAvailable) return;

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const username = `__vas_report_test_${suffix}`;
    const email = `${username}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
       VALUES ($1, $2, $3, $3, $4, true, $5, $6) RETURNING id`,
      [username, email, "sales_executive", "Lahore Gulburg", `Full Name ${username}`, "test_hash"],
    );
    userId = String(r.rows[0].id);
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdVasReportIds.length) {
          await pool.query(`DELETE FROM drm.vas_reports WHERE id = ANY($1::varchar[])`, [createdVasReportIds]);
        }
        if (userId) {
          await pool.query(`DELETE FROM drm.users WHERE id = $1`, [userId]);
        }
      }
    } catch (err) {
      console.warn("[vas-report-listing.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("a report created via the Reports module's save path appears in its own listing with the exact stored values", async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const created = await vasReportsRepository.create(userId, {
      title: "Integration test VAS report",
      status: "Draft",
      reportDate: new Date(),
      totalTasks: 7,
      valueSold: 12345.67,
      successRate: 80,
      followUpsDone: 3,
      missedLeads: 1,
      summary: "test summary",
      notes: "test notes",
    } as any);
    createdVasReportIds.push((created as any).id);

    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 1);

    const report = await getVasReport([userId], from, to);
    const match = report.details.find((d: any) => d.id === (created as any).id);

    expect(match).toBeTruthy();
    expect(match.title).toBe("Integration test VAS report");
    expect(match.status).toBe("Draft");
    expect(Number(match.totalTasks)).toBe(7);
    expect(Number(match.valueSold)).toBeCloseTo(12345.67, 2);
    expect(Number(match.successRate)).toBe(80);
    expect(Number(match.followUpsDone)).toBe(3);
    expect(Number(match.missedLeads)).toBe(1);

    // Must not fabricate fields vas_reports never stored.
    expect(match.companyName).toBeUndefined();
    expect(match.amount).toBeUndefined();
    expect(match.method).toBeUndefined();
    expect(match.commissionPercent).toBeUndefined();
    expect(match.reward).toBeUndefined();
    expect(match.finalCommission).toBeUndefined();

    expect(report.metrics.valueOfServiceSold).toBeGreaterThanOrEqual(12345.67);
  });

  it("a report outside the requested date range is excluded from the listing", async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 5);

    const created = await vasReportsRepository.create(userId, {
      title: "Old out-of-range VAS report",
      status: "Draft",
      reportDate: oldDate,
      totalTasks: 1,
      valueSold: 1,
      successRate: 0,
      followUpsDone: 0,
      missedLeads: 0,
    } as any);
    createdVasReportIds.push((created as any).id);

    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 1);

    const report = await getVasReport([userId], from, to);
    const match = report.details.find((d: any) => d.id === (created as any).id);
    expect(match).toBeUndefined();
  });
});
