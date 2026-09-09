/**
 * Patch 2 Stage 1 — report-permission guard unit tests.
 *
 * These exercise the matrix decision logic directly (no DB, no HTTP) by invoking
 * the returned Express middleware with mock req/res, plus one HTTP assertion
 * that the new /api/reports/day-target route sits behind the auth gate.
 *
 * The HTTP test is resilient: if the dev Postgres pool is unreachable it
 * soft-skips rather than failing the build (mirrors stage10-smoke.test.ts).
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pool } from "../db";
import { registerRoutes } from "../routes";
import {
  requireReportPermission,
  resolveReportRoles,
} from "./middleware/report-permission";

function runGuard(reportKey: any, action: any, user: any) {
  const req = { user } as any;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as any;
  const next = vi.fn();
  requireReportPermission(reportKey, action)(req, res, next);
  return { next, status, json };
}

describe("requireReportPermission (matrix decision)", () => {
  it("always allows admin (and super_admin via normalization) on any action", () => {
    for (const role of ["admin", "super_admin", "administrator"]) {
      const { next, status } = runGuard("day_target", "view", { roleId: role });
      expect(next).toHaveBeenCalledTimes(1);
      expect(status).not.toHaveBeenCalled();
    }
  });

  it("always allows super_hod", () => {
    const { next } = runGuard("salary_create", "finalize", { roleId: "super_hod" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows a matrix-listed role (account_manager views day_target)", () => {
    const { next } = runGuard("day_target", "view", { roleId: "account_manager" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("normalizes accounts_office → account_manager", () => {
    const { next } = runGuard("day_target", "view", { roleId: "accounts_office" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("denies an unlisted role with 403 (sales_executive viewing day_target)", () => {
    const { next, status, json } = runGuard("day_target", "view", {
      roleId: "sales_executive",
    });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("honors the active role over the base role", () => {
    const { next } = runGuard("day_target", "view", {
      roleId: "sales_executive",
      activeRoleId: "admin",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when unauthenticated", () => {
    const { next, status, json } = runGuard("day_target", "view", undefined);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json.mock.calls[0][0].error.code).toBe("UNAUTHORIZED");
  });

  it("resolveReportRoles always includes admin + super_hod", () => {
    const roles = resolveReportRoles("penalty_report", "create");
    expect(roles).toContain("admin");
    expect(roles).toContain("super_hod");
    expect(roles).toContain("dd_manager");
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

describe("GET /api/reports/day-target route wiring", () => {
  it("rejects unauthenticated requests with 401 (behind the auth gate)", async () => {
    if (!dbAvailable || !app) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get("/api/reports/day-target");
    expect(res.status).toBe(401);
    // Must not be a 404 — the route must actually exist and be guarded.
    expect(res.status).not.toBe(404);
  });
});
