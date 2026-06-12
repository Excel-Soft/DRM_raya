/**
 * Patch 2 Stage 8 — Event & Reception report integration tests (DB-backed).
 *
 * Exercises the real wiring through registerRoutes() (same entrypoint as
 * server/index.ts), against the real drm.events / drm.meetings tables:
 *   - the auth gate (401) and report-permission gate (403) on every endpoint,
 *   - the events report returns real persisted rows (never fabricated),
 *   - honest validation: an unknown status → 400 (not a silent all-rows result),
 *   - reception row-scope: a reception executive sees only their own rows and a
 *     userId outside their scope yields an empty result,
 *   - the reception CSV export honors the same filters + scope and is gated by the
 *     export permission.
 *
 * Resilient: if the dev Postgres pool is unreachable the suite soft-skips rather
 * than failing the build (mirrors the other *-routes.test.ts suites). Seeded rows
 * and users are cleaned up afterwards.
 */
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { authService } from "./auth.service";

const SUFFIX = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const OWN_MARKER = `__s8_own_${SUFFIX}`;
const OTHER_MARKER = `__s8_other_${SUFFIX}`;
const EVENT_MARKER = `__s8_event_${SUFFIX}`;

let app: Express | null = null;
let dbAvailable = false;

const createdUserIds: string[] = [];
const createdMeetingIds: string[] = [];
const createdEventIds: string[] = [];

interface SeededUser {
  id: string;
  token: string;
  email: string;
}

async function seedUser(role: string): Promise<SeededUser> {
  const username = `__s8_${role}_${SUFFIX}_${createdUserIds.length}`;
  const email = `${username}@example.invalid`;
  const r = await pool.query(
    `INSERT INTO drm.users (username, email, role_id, role, is_active)
     VALUES ($1, $2, $3, $3, true) RETURNING id`,
    [username, email, role],
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

async function seedMeeting(opts: {
  personName: string;
  meetingType: string;
  status: string;
  createdBy: string;
}): Promise<string> {
  const r = await pool.query(
    `INSERT INTO drm.meetings (person_name, meeting_type, status, created_by, meeting_date)
     VALUES ($1, $2, $3::drm.meeting_status, $4, now()) RETURNING id`,
    [opts.personName, opts.meetingType, opts.status, opts.createdBy],
  );
  const id = String(r.rows[0].id);
  createdMeetingIds.push(id);
  return id;
}

async function seedEvent(opts: {
  name: string;
  eventType: string;
  status: string;
  createdBy: string;
}): Promise<string> {
  const r = await pool.query(
    `INSERT INTO drm.events (name, event_type, event_date, status, created_by)
     VALUES ($1, $2, CURRENT_DATE, $3, $4) RETURNING id`,
    [opts.name, opts.eventType, opts.status, opts.createdBy],
  );
  const id = String(r.rows[0].id);
  createdEventIds.push(id);
  return id;
}

let adminUser: SeededUser;
let execUser: SeededUser; // reception_executive
let otherUser: SeededUser; // sales_executive (no report permission)

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

  adminUser = await seedUser("admin");
  execUser = await seedUser("reception_executive");
  otherUser = await seedUser("sales_executive");

  // Reception rows: one owned by the executive, one owned by another user.
  await seedMeeting({ personName: OWN_MARKER, meetingType: "Walk-in", status: "expected", createdBy: execUser.id });
  await seedMeeting({ personName: OTHER_MARKER, meetingType: "Call", status: "ended", createdBy: otherUser.id });

  // A real event row so the eventName/status filters are deterministic.
  await seedEvent({ name: EVENT_MARKER, eventType: "Conference", status: "Draft", createdBy: adminUser.id });
});

afterAll(async () => {
  try {
    if (dbAvailable) {
      if (createdMeetingIds.length) {
        await pool.query(`DELETE FROM drm.meetings WHERE id = ANY($1::uuid[])`, [createdMeetingIds]);
      }
      if (createdEventIds.length) {
        await pool.query(`DELETE FROM drm.events WHERE id = ANY($1::uuid[])`, [createdEventIds]);
      }
      if (createdUserIds.length) {
        await pool.query(`DELETE FROM drm.users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
    }
  } catch (err) {
    console.warn("[stage8.test] cleanup failed:", err);
  }
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Stage 8 — auth gate", () => {
  it("rejects unauthenticated requests on every report endpoint (401)", async () => {
    if (!dbAvailable || !app) return;
    for (const path of [
      "/api/events/report",
      "/api/reports/reception",
      "/api/reports/reception/export",
    ]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    }
  });
});

describe("Stage 8 — report-permission gate (403)", () => {
  it("denies a role without view permission (sales_executive)", async () => {
    if (!dbAvailable || !app) return;
    const ev = await request(app).get("/api/events/report").set(auth(otherUser.token));
    expect(ev.status).toBe(403);
    const rc = await request(app).get("/api/reports/reception").set(auth(otherUser.token));
    expect(rc.status).toBe(403);
  });

  it("denies reception export to a role without export permission (reception_executive)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/reports/reception/export").set(auth(execUser.token));
    expect(res.status).toBe(403);
  });
});

describe("Stage 8 — events report (real drm.events)", () => {
  it("returns real persisted rows for an authorized role", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/events/report").set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    for (const row of res.body.data) {
      expect(typeof row.id).toBe("string");
      expect(row.id.length).toBeGreaterThan(0);
    }
  });

  it("filters by eventName (ILIKE) and returns only matching rows", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get(`/api/events/report?eventName=${EVENT_MARKER}`)
      .set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe(EVENT_MARKER);
  });

  it("rejects an unknown status with 400 (no silent all-rows fallback)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/events/report?status=definitely-not-a-status")
      .set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });

  it("accepts a valid status and returns only those rows", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/events/report?status=Draft").set(auth(adminUser.token));
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.status).toBe("Draft");
    }
  });
});

describe("Stage 8 — reception report scope + filters", () => {
  it("an admin sees all reception rows (both seeded rows present)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/reports/reception?pageSize=200").set(auth(adminUser.token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: any) => r.person_name);
    expect(names).toContain(OWN_MARKER);
    expect(names).toContain(OTHER_MARKER);
  });

  it("rejects an unknown status with 400", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/reports/reception?status=scheduled").set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });

  it("filters by a real status value", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/reports/reception?status=expected&pageSize=200")
      .set(auth(adminUser.token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: any) => r.person_name);
    expect(names).toContain(OWN_MARKER);
    expect(names).not.toContain(OTHER_MARKER); // OTHER_MARKER is 'ended'
  });

  it("a reception executive sees only their own rows", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app).get("/api/reports/reception?pageSize=200").set(auth(execUser.token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: any) => r.person_name);
    expect(names).toContain(OWN_MARKER);
    expect(names).not.toContain(OTHER_MARKER);
  });

  it("a reception executive cannot widen scope via a userId outside their scope", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get(`/api/reports/reception?userId=${otherUser.id}&pageSize=200`)
      .set(auth(execUser.token));
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: any) => r.person_name);
    expect(names).not.toContain(OTHER_MARKER);
    expect(names).not.toContain(OWN_MARKER);
  });

  it("rejects a malformed userId with 400 (honest input rejection, not a 500)", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/reports/reception?userId=not-a-uuid")
      .set(auth(adminUser.token));
    expect(res.status).toBe(400);
  });
});

describe("Stage 8 — reception CSV export honors filters + scope", () => {
  it("an admin exports a CSV honoring the status filter", async () => {
    if (!dbAvailable || !app) return;
    const res = await request(app)
      .get("/api/reports/reception/export?status=expected")
      .set(auth(adminUser.token));
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/csv");
    expect(res.text).toContain("Company");
    expect(res.text).toContain(OWN_MARKER);
    expect(res.text).not.toContain(OTHER_MARKER);
  });
});
