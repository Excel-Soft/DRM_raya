/**
 * Phase 7 — Service Bridge Final Decision and Implementation.
 *
 * API-level UAT for the Service -> GM/VAS/BV bridges (per the user-confirmed
 * decision: GM stays link-only, and UAT is API-level since no frontend exists
 * for this feature yet — see SERVICE_BRIDGE_DECISION.md /
 * PHASE7_SERVICE_BRIDGE_UAT.md). Soft-skips if the dev Postgres pool is
 * unreachable, mirroring gm-uat.test.ts / invoice-workflow.test.ts.
 *
 * Config flags are global, shared state (`drm.service_bridge_config`) — this
 * suite snapshots the original values and restores them in afterAll so it
 * never leaves bridges accidentally enabled for other tests or the running
 * dev server.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";
import { getConfig, patchConfig } from "./services/service-bridge-config.service";
import { SERVICE_BRIDGE_DISABLED_MESSAGE } from "../../shared/service-bridge-constants";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Service bridge (GM/VAS/BV) — Phase 7 UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;
  let originalConfig: Record<string, unknown> = {};

  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdServiceCustomerIds: string[] = [];
  const createdGmIds: string[] = [];
  const createdVasReportIds: string[] = [];
  const createdBvReportIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p7_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  async function seedCustomer(): Promise<string> {
    const email = `__p7_cust_${SUFFIX}_${createdCustomerIds.length}@example.invalid`;
    const r = await pool.query(
      `INSERT INTO drm.customers (company_name, account_name, email, phone, region, grade)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`__p7 Co ${SUFFIX}`, "Test Account", email, "0000000000", "Lahore", "A"],
    );
    const id = String(r.rows[0].id);
    createdCustomerIds.push(id);
    return id;
  }

  async function seedServiceCustomer(customerId: string, userId: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.service_customers (customer_id, user_id, service_start_date, expiry_date)
       VALUES ($1, $2, now(), now() + interval '1 year') RETURNING id`,
      [customerId, userId],
    );
    const id = String(r.rows[0].id);
    createdServiceCustomerIds.push(id);
    return id;
  }

  async function seedGmEntry(salesPersonId: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.gm_entries (drm_id, company_name, package_type, entry_type, amount_usd, amount, sales_person_id, created_by)
       VALUES ($1, $2, 'Standard', 'GM', 100, 100, $3, $3) RETURNING id`,
      [`__p7-gm-${SUFFIX}`, `__p7 GM Co ${SUFFIX}`, salesPersonId],
    );
    const id = String(r.rows[0].id);
    createdGmIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let admin: SeededUser;
  let serviceExec: SeededUser;
  let salesExec: SeededUser;
  let customerId: string;

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
    serviceExec = await seedUser("service_executive");
    salesExec = await seedUser("sales_executive");
    customerId = await seedCustomer();

    const { config } = await getConfig();
    originalConfig = { ...config };
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        // Restore the config flags exactly as found — never leave a shared,
        // global config flag flipped on because of this test run.
        await patchConfig(originalConfig, "__p7_test_restore");

        if (createdVasReportIds.length) {
          await pool.query(`DELETE FROM drm.vas_reports WHERE id = ANY($1::uuid[])`, [createdVasReportIds]);
        }
        if (createdBvReportIds.length) {
          await pool.query(`DELETE FROM drm.bv_reports WHERE id = ANY($1::uuid[])`, [createdBvReportIds]);
        }
        if (createdServiceCustomerIds.length) {
          await pool.query(`DELETE FROM drm.service_bridge_links WHERE service_record_id = ANY($1::text[])`, [
            createdServiceCustomerIds,
          ]);
          await pool.query(`DELETE FROM drm.service_customers WHERE id = ANY($1::uuid[])`, [
            createdServiceCustomerIds,
          ]);
        }
        if (createdGmIds.length) {
          await pool.query(`DELETE FROM drm.gm_entries WHERE id = ANY($1::uuid[])`, [createdGmIds]);
        }
        if (createdCustomerIds.length) {
          await pool.query(`DELETE FROM drm.customers WHERE id = ANY($1::uuid[])`, [createdCustomerIds]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[service-bridge.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  describe("Disabled by default — never 501", () => {
    it("returns 403 (never 501) for gm/vas/bv when their flags are off", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig(
        { serviceBridgeGmEnabled: false, serviceBridgeVasEnabled: false, serviceBridgeBvEnabled: false },
        admin.id,
      );
      const scId = await seedServiceCustomer(customerId, serviceExec.id);

      for (const target of ["gm", "vas", "bv"] as const) {
        const res = await request(app)
          .post(`/api/service/${target}`)
          .set(auth(serviceExec.token))
          .send({ serviceCustomerId: scId });
        expect(res.status).toBe(403);
        expect(res.status).not.toBe(501);
        expect(res.body.error).toBe(SERVICE_BRIDGE_DISABLED_MESSAGE);
      }
    });
  });

  describe("Role gate", () => {
    it("rejects a non-Service role (sales_executive) even when the flag is enabled", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig({ serviceBridgeVasEnabled: true }, admin.id);
      const scId = await seedServiceCustomer(customerId, serviceExec.id);

      const res = await request(app)
        .post("/api/service/vas")
        .set(auth(salesExec.token))
        .send({ serviceCustomerId: scId });
      expect(res.status).toBe(403);
    });
  });

  describe("GM bridge — confirmed link-only", () => {
    it("links to an existing GM entry without creating a new one", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig({ serviceBridgeGmEnabled: true }, admin.id);
      const scId = await seedServiceCustomer(customerId, serviceExec.id);
      const existingGmId = await seedGmEntry(serviceExec.id);

      const beforeCount = await pool.query(`SELECT count(*)::int AS c FROM drm.gm_entries`);

      const res = await request(app)
        .post("/api/service/gm")
        .set(auth(serviceExec.token))
        .send({ serviceCustomerId: scId, gmRecordId: existingGmId });
      expect(res.status).toBe(201);
      expect(res.body.link.targetModule).toBe("gm");
      expect(res.body.link.targetRecordId).toBe(existingGmId);

      const afterCount = await pool.query(`SELECT count(*)::int AS c FROM drm.gm_entries`);
      expect(afterCount.rows[0].c).toBe(beforeCount.rows[0].c);

      const auditRes = await pool.query(
        `SELECT * FROM drm.activity_logs WHERE action = 'service_bridge.gm.create' AND resource_id = $1`,
        [res.body.link.id],
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });

    it("records pending_gm_creation intent (still no new GM row) when no gmRecordId is given", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig({ serviceBridgeGmEnabled: true }, admin.id);
      const scId = await seedServiceCustomer(customerId, serviceExec.id);
      const beforeCount = await pool.query(`SELECT count(*)::int AS c FROM drm.gm_entries`);

      const res = await request(app)
        .post("/api/service/gm")
        .set(auth(serviceExec.token))
        .send({ serviceCustomerId: scId });
      expect(res.status).toBe(201);
      expect(res.body.link.targetRecordId).toBeNull();

      const afterCount = await pool.query(`SELECT count(*)::int AS c FROM drm.gm_entries`);
      expect(afterCount.rows[0].c).toBe(beforeCount.rows[0].c);
    });
  });

  describe("VAS bridge — real, end-to-end", () => {
    it("creates a real vas_reports row linked to the service record's customer", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig({ serviceBridgeVasEnabled: true }, admin.id);
      const scId = await seedServiceCustomer(customerId, serviceExec.id);

      const res = await request(app)
        .post("/api/service/vas")
        .set(auth(serviceExec.token))
        .send({ serviceCustomerId: scId });
      expect(res.status).toBe(201);
      expect(res.body.link.targetModule).toBe("vas");
      const reportId = res.body.link.targetRecordId;
      createdVasReportIds.push(reportId);

      const reportRes = await pool.query(`SELECT * FROM drm.vas_reports WHERE id = $1`, [reportId]);
      expect(reportRes.rows.length).toBe(1);
      expect(reportRes.rows[0].customer_id).toBe(customerId);

      const auditRes = await pool.query(
        `SELECT * FROM drm.activity_logs WHERE action = 'service_bridge.vas.create' AND resource_id = $1`,
        [res.body.link.id],
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });
  });

  describe("BV bridge — real, end-to-end", () => {
    it("creates a real bv_reports row linked to the service record's customer", async () => {
      if (!dbAvailable || !app) { expect(true).toBe(true); return; }
      await patchConfig({ serviceBridgeBvEnabled: true }, admin.id);
      const scId = await seedServiceCustomer(customerId, serviceExec.id);

      const res = await request(app)
        .post("/api/service/bv")
        .set(auth(serviceExec.token))
        .send({
          serviceCustomerId: scId,
          title: `__p7 BV Report ${SUFFIX}`,
          reportDate: new Date().toISOString(),
        });
      expect(res.status).toBe(201);
      expect(res.body.link.targetModule).toBe("bv");
      const reportId = res.body.link.targetRecordId;
      createdBvReportIds.push(reportId);

      const reportRes = await pool.query(`SELECT * FROM drm.bv_reports WHERE id = $1`, [reportId]);
      expect(reportRes.rows.length).toBe(1);
      expect(reportRes.rows[0].customer_id).toBe(customerId);

      const auditRes = await pool.query(
        `SELECT * FROM drm.activity_logs WHERE action = 'service_bridge.bv.create' AND resource_id = $1`,
        [res.body.link.id],
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });
  });
});
