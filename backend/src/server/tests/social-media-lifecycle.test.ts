/**
 * Phase 11 — Support and Social Media Final Scope Closure.
 *
 * API-level UAT proving Social Media's internal/manual publishing (per
 * SOCIAL_MEDIA_EXTERNAL_PROVIDER_DECISION.md, reconfirmed this phase) is
 * genuinely honest and persistent: posts survive a fresh read (no in-memory
 * state), the full approve/reject/schedule/publish lifecycle transitions
 * correctly, publishing never claims external delivery, and the dashboard
 * summary reflects live data rather than fixtures. Soft-skips if the dev
 * Postgres pool is unreachable, mirroring service-bridge.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

import { pool } from "../db";
import { registerRoutes } from "../routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe("Social Media — Phase 11 lifecycle/persistence/metrics UAT", () => {
  let app: Express | null = null;
  let dbAvailable = false;

  const createdUserIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdPostIds: string[] = [];

  interface SeededUser {
    id: string;
    token: string;
  }

  async function seedUser(role: string): Promise<SeededUser> {
    const username = `__p11sm_${role}_${SUFFIX}_${createdUserIds.length}`;
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

  async function seedSocialAccount(createdBy: string): Promise<string> {
    const r = await pool.query(
      `INSERT INTO drm.social_accounts (owner_name, platform, account_name, status, created_by)
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      ["Test Owner", "facebook", `__p11sm_account_${SUFFIX}`, createdBy],
    );
    const id = String(r.rows[0].id);
    createdAccountIds.push(id);
    return id;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let admin: SeededUser;
  let accountId: string;

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
    accountId = await seedSocialAccount(admin.id);
  });

  afterAll(async () => {
    try {
      if (dbAvailable) {
        if (createdPostIds.length) {
          await pool.query(`DELETE FROM drm.social_media_posts WHERE id = ANY($1::uuid[])`, [
            createdPostIds,
          ]);
        }
        if (createdAccountIds.length) {
          await pool.query(`DELETE FROM drm.social_accounts WHERE id = ANY($1::uuid[])`, [
            createdAccountIds,
          ]);
        }
        if (createdUserIds.length) {
          await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
        }
      }
    } catch (err) {
      console.warn("[social-media-lifecycle.test] cleanup failed:", err);
    }
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
  });

  it("persists a created post — a fresh GET returns the same DB-backed content, not in-memory state", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const createRes = await request(app)
      .post("/api/social-media/posts")
      .set(auth(admin.token))
      .send({
        platform: "facebook",
        socialAccountId: accountId,
        content: `__p11sm content ${SUFFIX}`,
        title: `__p11sm title ${SUFFIX}`,
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    createdPostIds.push(id);
    expect(createRes.body.approvalStatus ?? createRes.body.approval_status).toBe("DRAFT");

    const fetchRes = await request(app)
      .get(`/api/social-media/posts/${id}`)
      .set(auth(admin.token));
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.content).toBe(`__p11sm content ${SUFFIX}`);

    const dbRow = await pool.query(`SELECT content FROM drm.social_media_posts WHERE id = $1`, [id]);
    expect(dbRow.rows.length).toBe(1);
    expect(dbRow.rows[0].content).toBe(`__p11sm content ${SUFFIX}`);
  });

  it("drives a post through submit-approval -> approve -> schedule -> publish, and dashboard metrics move with it", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const summaryBefore = await request(app)
      .get(`/api/social-media/dashboard/summary?createdBy=${admin.id}`)
      .set(auth(admin.token));
    expect(summaryBefore.status).toBe(200);
    const totalBefore = summaryBefore.body.total;
    const publishedBefore = summaryBefore.body.publishing.PUBLISHED;

    const createRes = await request(app)
      .post("/api/social-media/posts")
      .set(auth(admin.token))
      .send({
        platform: "instagram",
        socialAccountId: accountId,
        content: `__p11sm lifecycle ${SUFFIX}`,
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    createdPostIds.push(id);

    const submitRes = await request(app)
      .post(`/api/social-media/posts/${id}/submit-approval`)
      .set(auth(admin.token))
      .send({});
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.approvalStatus ?? submitRes.body.approval_status).toBe("PENDING");

    const approveRes = await request(app)
      .post(`/api/social-media/posts/${id}/approve`)
      .set(auth(admin.token))
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.approvalStatus ?? approveRes.body.approval_status).toBe("APPROVED");
    expect(approveRes.body.publishingStatus ?? approveRes.body.publishing_status).toBe("READY");

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const scheduleRes = await request(app)
      .post(`/api/social-media/posts/${id}/schedule`)
      .set(auth(admin.token))
      .send({ scheduledAt: futureDate });
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body.publishingStatus ?? scheduleRes.body.publishing_status).toBe("SCHEDULED");

    const publishRes = await request(app)
      .post(`/api/social-media/posts/${id}/publish`)
      .set(auth(admin.token))
      .send({ confirmManual: true });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.publishingStatus ?? publishRes.body.publishing_status).toBe("PUBLISHED");

    // Honesty: publishing must never claim real external delivery.
    expect(publishRes.body.publishMode).toBe("MANUAL_INTERNAL");
    expect(String(publishRes.body.publishNote)).toMatch(/not posted to any external platform/i);

    const dbRow = await pool.query(
      `SELECT publishing_status, external_ref FROM drm.social_media_posts WHERE id = $1`,
      [id],
    );
    expect(dbRow.rows[0].publishing_status).toBe("PUBLISHED");
    expect(dbRow.rows[0].external_ref).toBeNull();

    const summaryAfter = await request(app)
      .get(`/api/social-media/dashboard/summary?createdBy=${admin.id}`)
      .set(auth(admin.token));
    expect(summaryAfter.status).toBe(200);
    expect(summaryAfter.body.total).toBe(totalBefore + 1);
    expect(summaryAfter.body.publishing.PUBLISHED).toBe(publishedBefore + 1);
  });

  it("rejects publishing without explicit confirmation (never a silent/implicit publish)", async () => {
    if (!dbAvailable || !app) { expect(true).toBe(true); return; }

    const createRes = await request(app)
      .post("/api/social-media/posts")
      .set(auth(admin.token))
      .send({
        platform: "linkedin",
        socialAccountId: accountId,
        content: `__p11sm noconfirm ${SUFFIX}`,
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    createdPostIds.push(id);

    const publishRes = await request(app)
      .post(`/api/social-media/posts/${id}/publish`)
      .set(auth(admin.token))
      .send({});
    expect(publishRes.status).toBe(400);

    const dbRow = await pool.query(
      `SELECT publishing_status FROM drm.social_media_posts WHERE id = $1`,
      [id],
    );
    expect(dbRow.rows[0].publishing_status).not.toBe("PUBLISHED");
  });
});
