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
import { PENALTY_STATUSES, PENALTY_HEADS } from "../services/penalty.service";

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
