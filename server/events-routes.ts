/**
 * Events management routes — mounted under /api/events.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public. Every handler enforces
 * `if (!req.user) return 401`.
 *
 * Tables (schema drm), created idempotently via ensureEventsTables():
 *   - events
 *   - event_speakers   (FK events ON DELETE CASCADE)
 *   - event_menu_items (FK events ON DELETE CASCADE)
 *   - event_duties     (FK events ON DELETE CASCADE)
 *
 * Conventions: ids uuid gen_random_uuid(); money numeric(12,2); ts timestamptz
 * default now(); soft-delete deleted_at (excluded from lists); FK actor cols
 * REFERENCES drm.users(id) ON DELETE SET NULL. LIST responses are
 * { data, total, page, pageSize }. Real rows or empty — never fabricated.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { ActivityLogService } from "./services/activity-service";
import { isManagerialRole } from "./utils/role-utils";
import { NotificationService } from "./services/notification-service";
import { requireReportPermission } from "./middleware/report-permission";

// Fire-and-forget duty-assignment notification (uses the shared notification
// abstraction). Never throws into the request path.
function notifyDutyAssignment(userId: string | null | undefined, duty: string | null | undefined): void {
  if (!userId) return;
  void NotificationService.notify({
    userId: String(userId),
    message: `You have been assigned an event duty${duty ? `: ${duty}` : ""}.`,
    type: "INFO",
    targetUrl: "/events-duty-planner",
  }).catch(() => {});
}

const EVENT_STATUSES = ["Draft", "Completed", "Cancelled"] as const;
type EventStatus = (typeof EVENT_STATUSES)[number];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}

function getUserRole(req: Request): string {
  const u = req.user as any;
  return String(u?.roleId ?? u?.role ?? u?.roleName ?? "");
}

// Event records are operational/org data. Reads are open to any authenticated
// user; mutations are restricted to managerial/HOD/admin roles. Returns true if
// the caller may create/update/delete events and their child records.
function canManageEvents(req: Request): boolean {
  return isManagerialRole(getUserRole(req));
}

// Guard for mutation handlers: 401 if unauthenticated, 403 if not authorized.
// Returns true when the request should be rejected (response already sent).
function denyEventMutation(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return true;
  }
  if (!canManageEvents(req)) {
    res.status(403).json({
      error: "Forbidden",
      message: "You are not authorized to manage events",
    });
    return true;
  }
  return false;
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

function isValidDate(value: string): boolean {
  return !!value && !isNaN(new Date(value).getTime());
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeStatus(value: unknown): EventStatus | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  const match = EVENT_STATUSES.find((st) => st.toLowerCase() === s.toLowerCase());
  return match ?? null;
}

// Validate a HH:MM-ish time pair when both are present: start must be < end.
function timesValid(start: unknown, end: unknown): boolean {
  const s = start === undefined || start === null ? "" : String(start).trim();
  const e = end === undefined || end === null ? "" : String(end).trim();
  if (!s || !e) return true; // only enforce ordering when BOTH are present
  return s < e;
}

export async function ensureEventsTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      event_type text,
      event_date date NOT NULL,
      start_time text,
      end_time text,
      venue text,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      attendee_count integer NOT NULL DEFAULT 0,
      map_url text,
      status text NOT NULL DEFAULT 'Draft',
      notes text,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      updated_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_event_date ON drm.events (event_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_status ON drm.events (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_created_at ON drm.events (created_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.event_speakers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES drm.events(id) ON DELETE CASCADE,
      speaker_name text,
      topic text,
      detail text,
      start_time text,
      end_time text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_speakers_event_id ON drm.event_speakers (event_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.event_menu_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES drm.events(id) ON DELETE CASCADE,
      item_name text,
      assigned_user_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      assigned_role text,
      scheduled_date date,
      scheduled_time text,
      status text NOT NULL DEFAULT 'pending',
      notes text,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_menu_items_event_id ON drm.event_menu_items (event_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.event_duties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES drm.events(id) ON DELETE CASCADE,
      duty text,
      assigned_user_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      assigned_role text,
      scheduled_date date,
      scheduled_time text,
      status text NOT NULL DEFAULT 'pending',
      notes text,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_duties_event_id ON drm.event_duties (event_id)`);
}

// Idempotent one-time table-setup guard. ensureEventsTables() uses CREATE TABLE IF
// NOT EXISTS, but the shared report handlers can be reached via the stage3
// /api/reports/event alias (registered before registerEventsRoutes runs, and in
// isolated tests). Calling this from the handlers guarantees the events tables
// exist before the first query.
let eventsTablesReady: Promise<void> | null = null;
function ensureEventsTablesOnce(): Promise<void> {
  if (!eventsTablesReady) eventsTablesReady = ensureEventsTables();
  return eventsTablesReady;
}

function mapEvent(r: any) {
  return {
    id: r.id,
    name: r.name,
    eventType: r.event_type ?? null,
    eventDate: r.event_date ?? null,
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    venue: r.venue ?? null,
    amount: r.amount === null || r.amount === undefined ? 0 : Number(r.amount),
    attendeeCount: r.attendee_count === null || r.attendee_count === undefined ? 0 : Number(r.attendee_count),
    mapUrl: r.map_url ?? null,
    status: r.status,
    notes: r.notes ?? null,
    createdBy: r.created_by ?? null,
    createdByName: r.created_by_name ?? null,
    updatedBy: r.updated_by ?? null,
    updatedByName: r.updated_by_name ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
    speakers: Array.isArray(r.speakers) ? r.speakers : [],
  };
}

function mapSpeaker(r: any) {
  return {
    id: r.id,
    eventId: r.event_id,
    speakerName: r.speaker_name ?? null,
    topic: r.topic ?? null,
    detail: r.detail ?? null,
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

function mapMenuItem(r: any) {
  return {
    id: r.id,
    eventId: r.event_id,
    itemName: r.item_name ?? null,
    assignedUserId: r.assigned_user_id ?? null,
    assignedUserName: r.assigned_user_name ?? null,
    assignedRole: r.assigned_role ?? null,
    scheduledDate: r.scheduled_date ?? null,
    scheduledTime: r.scheduled_time ?? null,
    status: r.status,
    notes: r.notes ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

function mapDuty(r: any) {
  return {
    id: r.id,
    eventId: r.event_id,
    duty: r.duty ?? null,
    assignedUserId: r.assigned_user_id ?? null,
    assignedUserName: r.assigned_user_name ?? null,
    assignedRole: r.assigned_role ?? null,
    scheduledDate: r.scheduled_date ?? null,
    scheduledTime: r.scheduled_time ?? null,
    status: r.status,
    notes: r.notes ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

const SPEAKERS_SUBQUERY = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', s.id,
      'eventId', s.event_id,
      'speakerName', s.speaker_name,
      'topic', s.topic,
      'detail', s.detail,
      'startTime', s.start_time,
      'endTime', s.end_time,
      'createdAt', s.created_at,
      'updatedAt', s.updated_at
    ) ORDER BY s.created_at)
    FROM drm.event_speakers s WHERE s.event_id = e.id
  ), '[]'::json) AS speakers
`;

// Per-event aggregate counts for the report row, from the real child tables.
const EVENT_REPORT_COUNTS = `
  (SELECT count(*)::int FROM drm.event_speakers sc WHERE sc.event_id = e.id) AS speaker_count,
  (SELECT count(*)::int FROM drm.event_duties dc WHERE dc.event_id = e.id) AS duty_count
`;

// SELECT for the events report: the event row, the creator's name, child-table
// counts, and the speakers json array. Reads ONLY drm.events + its child tables.
const EVENT_REPORT_SELECT = `
  SELECT e.*, cu.name AS created_by_name, ${EVENT_REPORT_COUNTS}, ${SPEAKERS_SUBQUERY}
  FROM drm.events e
  LEFT JOIN drm.users cu ON cu.id = e.created_by
`;

// Build the WHERE clause + params shared by the events report list and export.
// Every filter maps to a REAL drm.events column / child table. assignedUserId,
// team and branch are intentionally NOT filtered: drm.events has no such columns,
// so those spec fields are surfaced as null rather than fabricated.
function buildEventReportFilters(req: Request): { error?: string; where: string[]; params: any[] } {
  const where: string[] = ["e.deleted_at IS NULL"];
  const params: any[] = [];
  if (req.query.eventId) {
    params.push(String(req.query.eventId));
    where.push(`e.id::text = $${params.length}`);
  }
  const dateFrom = req.query.dateFrom ?? req.query.startDate;
  const dateTo = req.query.dateTo ?? req.query.endDate;
  if (dateFrom && isValidDate(String(dateFrom))) {
    params.push(String(dateFrom));
    where.push(`e.event_date >= $${params.length}`);
  }
  if (dateTo && isValidDate(String(dateTo))) {
    params.push(String(dateTo));
    where.push(`e.event_date <= $${params.length}`);
  }
  if (req.query.type) {
    params.push(String(req.query.type));
    where.push(`e.event_type = $${params.length}`);
  }
  if (req.query.eventName) {
    params.push(`%${String(req.query.eventName).trim()}%`);
    where.push(`e.name ILIKE $${params.length}`);
  }
  if (req.query.status) {
    const st = normalizeStatus(req.query.status);
    if (!st) return { error: `status must be one of ${EVENT_STATUSES.join(", ")}`, where, params };
    params.push(st);
    where.push(`e.status = $${params.length}`);
  }
  if (req.query.venue) {
    params.push(`%${String(req.query.venue).trim()}%`);
    where.push(`e.venue ILIKE $${params.length}`);
  }
  if (req.query.speaker) {
    params.push(`%${String(req.query.speaker).trim()}%`);
    where.push(
      `EXISTS (SELECT 1 FROM drm.event_speakers s WHERE s.event_id = e.id AND s.speaker_name ILIKE $${params.length})`,
    );
  }
  return { where, params };
}

// Map a joined drm.events row to the Stage 8 event report shape. Existing
// /api/events/report fields (name, speakers, ...) are preserved for backward
// compatibility; the spec fields are added additively. assignedUserName and team
// have no source column on drm.events and are returned null — never fabricated.
function mapEventReportRow(r: any) {
  const ev = mapEvent(r);
  const speakerCount =
    r.speaker_count === null || r.speaker_count === undefined
      ? (Array.isArray(ev.speakers) ? ev.speakers.length : 0)
      : Number(r.speaker_count);
  const dutyCount =
    r.duty_count === null || r.duty_count === undefined ? 0 : Number(r.duty_count);
  return {
    id: ev.id,
    name: ev.name,
    eventName: ev.name,
    eventType: ev.eventType,
    eventDate: ev.eventDate,
    startTime: ev.startTime,
    endTime: ev.endTime,
    venue: ev.venue,
    attendeeCount: ev.attendeeCount,
    amount: ev.amount,
    status: ev.status,
    speakers: ev.speakers,
    speakerCount,
    dutyCount,
    createdByName: ev.createdByName,
    assignedUserName: null,
    team: null,
  };
}

function eventCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Shared handler for the events report. Registered at BOTH /api/events/report
// (legacy/back-compat) and /api/reports/event (Stage 8 spec endpoint, registered in
// stage3-reports-routes.ts BEFORE the /reports/:type catch-all). Reads the real
// drm.events store only — real rows or an honest empty set, never fabricated.
export async function eventsReportHandler(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    await ensureEventsTablesOnce();

    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    // Clamp pageSize to a sane upper bound so a caller cannot request the whole
    // table in one page. Accepts pageSize or the spec's `limit` alias.
    const pageSize = Math.min(
      200,
      Math.max(1, Number(req.query.pageSize ?? req.query.limit ?? 25) || 25),
    );
    const offset = (page - 1) * pageSize;

    const { error, where, params } = buildEventReportFilters(req);
    if (error) return res.status(400).json({ error: "BadRequest", message: error });
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const aggResult = await pool.query(
      `SELECT count(*)::int AS total,
              COALESCE(sum(e.attendee_count), 0)::int AS attendance,
              COALESCE(sum(e.amount), 0)::numeric AS cost
       FROM drm.events e ${whereSql}`,
      params,
    );
    const total = aggResult.rows[0]?.total ?? 0;
    const attendance = aggResult.rows[0]?.attendance ?? 0;
    const cost = Number(aggResult.rows[0]?.cost ?? 0);

    const listParams = params.slice();
    listParams.push(pageSize);
    listParams.push(offset);
    const { rows } = await pool.query(
      `${EVENT_REPORT_SELECT}
       ${whereSql}
       ORDER BY e.event_date DESC, e.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const data = rows.map(mapEventReportRow);
    res.json({ data, total, page, pageSize, totals: { attendance, cost } });
  } catch (err) {
    console.error("[events] report error", err);
    res.status(500).json({ error: "InternalError", message: "Failed to build events report" });
  }
}

// CSV export of the events report honoring the SAME filters and source as the list
// (capped at 5000 rows). Gated separately by the event_report export permission, so
// a viewer who cannot export is rejected before any data leaves the server.
export async function eventsReportExportHandler(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    await ensureEventsTablesOnce();

    const { error, where, params } = buildEventReportFilters(req);
    if (error) return res.status(400).json({ error: "BadRequest", message: error });
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const { rows } = await pool.query(
      `${EVENT_REPORT_SELECT}
       ${whereSql}
       ORDER BY e.event_date DESC, e.created_at DESC
       LIMIT 5000`,
      params,
    );

    const header = [
      "#", "Event Name", "Type", "Event Date", "Start", "End", "Venue",
      "Speakers", "Speaker Count", "Duty Count", "Attendance", "Amount",
      "Status", "Created By",
    ];
    const lines = [header.join(",")];
    rows.map(mapEventReportRow).forEach((r, idx) => {
      const speakerNames = Array.isArray(r.speakers)
        ? r.speakers.map((s: any) => (s.speakerName || "").trim()).filter(Boolean).join("; ")
        : "";
      lines.push(
        [
          idx + 1,
          r.eventName ?? "",
          r.eventType ?? "",
          r.eventDate ?? "",
          r.startTime ?? "",
          r.endTime ?? "",
          r.venue ?? "",
          speakerNames,
          r.speakerCount ?? 0,
          r.dutyCount ?? 0,
          r.attendeeCount ?? 0,
          r.amount ?? 0,
          r.status ?? "",
          r.createdByName ?? "",
        ].map(eventCsvCell).join(","),
      );
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="events_report.csv"`);
    res.send(lines.join("\n"));
  } catch (err) {
    console.error("[events] report export error", err);
    res.status(500).json({ error: "InternalError", message: "Failed to export events report" });
  }
}

async function getEventRaw(
  id: string,
): Promise<{ id: string; deletedAt: any } | null> {
  const { rows } = await pool.query(
    `select id, deleted_at from drm.events where id::text = $1::text limit 1`,
    [id],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, deletedAt: rows[0].deleted_at };
}

export async function registerEventsRoutes(app: Express) {
  await ensureEventsTablesOnce();

  // GET /api/events/report — the canonical events report (reads the real
  // drm.events store). Registered BEFORE /api/events/:id so it is not captured by
  // the :id route. Shares eventsReportHandler with the Stage 8 /api/reports/event
  // endpoint (registered in stage3-reports-routes.ts). Gated by the event_report
  // view permission; the CSV export is gated separately by the export permission.
  app.get(
    "/api/events/report",
    requireReportPermission("event_report", "view"),
    eventsReportHandler,
  );
  app.get(
    "/api/events/report/export",
    requireReportPermission("event_report", "export"),
    eventsReportExportHandler,
  );

  // GET /api/events — paginated, filtered list; each row includes speakers[]
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSize = Math.max(1, Number(req.query.pageSize ?? 25) || 25);
      const offset = (page - 1) * pageSize;

      const where: string[] = ["e.deleted_at IS NULL"];
      const params: any[] = [];

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim()}%`);
        where.push(
          `(e.name ILIKE $${params.length} OR e.venue ILIKE $${params.length} OR e.event_type ILIKE $${params.length} OR e.notes ILIKE $${params.length})`,
        );
      }
      if (req.query.status) {
        const st = normalizeStatus(req.query.status);
        if (st) {
          params.push(st);
          where.push(`e.status = $${params.length}`);
        }
      }
      if (req.query.type) {
        params.push(String(req.query.type));
        where.push(`e.event_type = $${params.length}`);
      }
      if (req.query.venue) {
        params.push(`%${String(req.query.venue).trim()}%`);
        where.push(`e.venue ILIKE $${params.length}`);
      }
      if (req.query.dateFrom && isValidDate(String(req.query.dateFrom))) {
        params.push(String(req.query.dateFrom));
        where.push(`e.event_date >= $${params.length}`);
      }
      if (req.query.dateTo && isValidDate(String(req.query.dateTo))) {
        params.push(String(req.query.dateTo));
        where.push(`e.event_date <= $${params.length}`);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;

      const countResult = await pool.query(
        `SELECT count(*)::int AS total FROM drm.events e ${whereSql}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      const listParams = params.slice();
      listParams.push(pageSize);
      listParams.push(offset);
      const { rows } = await pool.query(
        `SELECT e.*, cu.name AS created_by_name, uu.name AS updated_by_name, ${SPEAKERS_SUBQUERY}
         FROM drm.events e
         LEFT JOIN drm.users cu ON cu.id = e.created_by
         LEFT JOIN drm.users uu ON uu.id = e.updated_by
         ${whereSql}
         ORDER BY e.event_date DESC, e.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );

      res.json({ data: rows.map(mapEvent), total, page, pageSize });
    } catch (err) {
      console.error("[events] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch events" });
    }
  });

  // POST /api/events — create
  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const b = req.body ?? {};

      const name = String(b.name ?? "").trim();
      if (!name) return badRequest(res, "name is required");

      const eventDate = String(b.eventDate ?? b.event_date ?? "").trim();
      if (!isValidDate(eventDate)) return badRequest(res, "event_date is required and must be a valid date");

      const startTime = b.startTime !== undefined ? b.startTime : b.start_time;
      const endTime = b.endTime !== undefined ? b.endTime : b.end_time;
      if (!timesValid(startTime, endTime)) {
        return badRequest(res, "start_time must be before end_time");
      }

      let attendeeCount = 0;
      if (b.attendeeCount !== undefined || b.attendee_count !== undefined) {
        const raw = b.attendeeCount !== undefined ? b.attendeeCount : b.attendee_count;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
          return badRequest(res, "attendee_count must be an integer >= 0");
        }
        attendeeCount = n;
      }

      let amount = 0;
      if (b.amount !== undefined && b.amount !== null && b.amount !== "") {
        const n = Number(b.amount);
        if (isNaN(n) || n < 0) return badRequest(res, "amount must be >= 0");
        amount = n;
      }

      const mapUrl = b.mapUrl !== undefined ? b.mapUrl : b.map_url;
      if (mapUrl !== undefined && mapUrl !== null && String(mapUrl).trim() !== "" && !isHttpUrl(String(mapUrl))) {
        return badRequest(res, "map_url must be a valid http(s) URL");
      }

      let status: EventStatus = "Draft";
      if (b.status !== undefined && b.status !== null && b.status !== "") {
        const st = normalizeStatus(b.status);
        if (!st) return badRequest(res, `status must be one of ${EVENT_STATUSES.join(", ")}`);
        status = st;
      }

      const { rows } = await pool.query(
        `INSERT INTO drm.events
          (name, event_type, event_date, start_time, end_time, venue, amount,
           attendee_count, map_url, status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          name,
          b.eventType !== undefined ? (b.eventType ? String(b.eventType) : null) : (b.event_type ? String(b.event_type) : null),
          eventDate,
          startTime ? String(startTime) : null,
          endTime ? String(endTime) : null,
          b.venue ? String(b.venue) : null,
          amount,
          attendeeCount,
          mapUrl ? String(mapUrl) : null,
          status,
          b.notes ? String(b.notes) : null,
          getUserId(req) ?? null,
        ],
      );

      const created = mapEvent(rows[0]);
      await ActivityLogService.log({
        userId: getUserId(req),
        action: "create",
        resourceType: "event",
        resourceId: String(created.id),
        details: `Created event "${created.name}"`,
      });
      res.status(201).json({ success: true, event: created });
    } catch (err) {
      console.error("[events] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create event" });
    }
  });

  // GET /api/events/:id — event + speakers[] + menuItems[] + duties[]
  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);

      const { rows } = await pool.query(
        `SELECT e.*, cu.name AS created_by_name, uu.name AS updated_by_name
         FROM drm.events e
         LEFT JOIN drm.users cu ON cu.id = e.created_by
         LEFT JOIN drm.users uu ON uu.id = e.updated_by
         WHERE e.id::text = $1::text AND e.deleted_at IS NULL
         LIMIT 1`,
        [id],
      );
      if (!rows[0]) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const [speakers, menuItems, duties] = await Promise.all([
        pool.query(
          `SELECT * FROM drm.event_speakers WHERE event_id::text = $1::text ORDER BY created_at`,
          [id],
        ),
        pool.query(
          `SELECT mi.*, au.name AS assigned_user_name
           FROM drm.event_menu_items mi
           LEFT JOIN drm.users au ON au.id = mi.assigned_user_id
           WHERE mi.event_id::text = $1::text ORDER BY mi.created_at`,
          [id],
        ),
        pool.query(
          `SELECT d.*, au.name AS assigned_user_name
           FROM drm.event_duties d
           LEFT JOIN drm.users au ON au.id = d.assigned_user_id
           WHERE d.event_id::text = $1::text ORDER BY d.created_at`,
          [id],
        ),
      ]);

      const event = mapEvent(rows[0]);
      event.speakers = speakers.rows.map(mapSpeaker);
      res.json({
        ...event,
        menuItems: menuItems.rows.map(mapMenuItem),
        duties: duties.rows.map(mapDuty),
      });
    } catch (err) {
      console.error("[events] get error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch event" });
    }
  });

  // PATCH /api/events/:id — edit
  app.patch("/api/events/:id", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const id = String(req.params.id);
      const raw = await getEventRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const b = req.body ?? {};

      if (b.name !== undefined && !String(b.name).trim()) {
        return badRequest(res, "name cannot be empty");
      }
      const eventDateProvided = b.eventDate !== undefined || b.event_date !== undefined;
      const eventDate = b.eventDate !== undefined ? b.eventDate : b.event_date;
      if (eventDateProvided && !isValidDate(String(eventDate))) {
        return badRequest(res, "event_date must be a valid date");
      }

      const startProvided = b.startTime !== undefined || b.start_time !== undefined;
      const endProvided = b.endTime !== undefined || b.end_time !== undefined;
      const startTime = b.startTime !== undefined ? b.startTime : b.start_time;
      const endTime = b.endTime !== undefined ? b.endTime : b.end_time;
      // Only validate ordering when both end up present in the new state. We
      // conservatively validate the supplied pair when both are provided.
      if (startProvided && endProvided && !timesValid(startTime, endTime)) {
        return badRequest(res, "start_time must be before end_time");
      }

      const attendeeProvided = b.attendeeCount !== undefined || b.attendee_count !== undefined;
      const attendeeRaw = b.attendeeCount !== undefined ? b.attendeeCount : b.attendee_count;
      if (attendeeProvided) {
        const n = Number(attendeeRaw);
        if (!Number.isInteger(n) || n < 0) return badRequest(res, "attendee_count must be an integer >= 0");
      }

      if (b.amount !== undefined && b.amount !== null && b.amount !== "") {
        const n = Number(b.amount);
        if (isNaN(n) || n < 0) return badRequest(res, "amount must be >= 0");
      }

      const mapUrlProvided = b.mapUrl !== undefined || b.map_url !== undefined;
      const mapUrl = b.mapUrl !== undefined ? b.mapUrl : b.map_url;
      if (mapUrlProvided && mapUrl !== null && String(mapUrl).trim() !== "" && !isHttpUrl(String(mapUrl))) {
        return badRequest(res, "map_url must be a valid http(s) URL");
      }

      let statusVal: EventStatus | undefined;
      if (b.status !== undefined && b.status !== null && b.status !== "") {
        const st = normalizeStatus(b.status);
        if (!st) return badRequest(res, `status must be one of ${EVENT_STATUSES.join(", ")}`);
        statusVal = st;
      }

      const sets: string[] = [];
      const params: any[] = [];
      const addSet = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.name !== undefined) addSet("name", String(b.name).trim());
      if (b.eventType !== undefined) addSet("event_type", b.eventType ? String(b.eventType) : null);
      else if (b.event_type !== undefined) addSet("event_type", b.event_type ? String(b.event_type) : null);
      if (eventDateProvided) addSet("event_date", String(eventDate));
      if (startProvided) addSet("start_time", startTime ? String(startTime) : null);
      if (endProvided) addSet("end_time", endTime ? String(endTime) : null);
      if (b.venue !== undefined) addSet("venue", b.venue ? String(b.venue) : null);
      if (b.amount !== undefined) addSet("amount", b.amount === null || b.amount === "" ? 0 : Number(b.amount));
      if (attendeeProvided) addSet("attendee_count", Number(attendeeRaw));
      if (mapUrlProvided) addSet("map_url", mapUrl ? String(mapUrl) : null);
      if (statusVal !== undefined) addSet("status", statusVal);
      if (b.notes !== undefined) addSet("notes", b.notes ? String(b.notes) : null);

      if (sets.length === 0) {
        return badRequest(res, "No fields to update");
      }
      addSet("updated_by", getUserId(req) ?? null);
      sets.push("updated_at = now()");
      params.push(id);

      const { rows } = await pool.query(
        `UPDATE drm.events SET ${sets.join(", ")} WHERE id::text = $${params.length}::text RETURNING *`,
        params,
      );

      const updated = mapEvent(rows[0]);
      await ActivityLogService.log({
        userId: getUserId(req),
        action: "update",
        resourceType: "event",
        resourceId: String(updated.id),
        details: `Updated event "${updated.name}"`,
      });
      res.json({ success: true, event: updated });
    } catch (err) {
      console.error("[events] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update event" });
    }
  });

  // DELETE /api/events/:id — soft delete
  app.delete("/api/events/:id", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const id = String(req.params.id);
      const raw = await getEventRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      await pool.query(
        `UPDATE drm.events SET deleted_at = now(), updated_at = now(), updated_by = $1 WHERE id::text = $2::text`,
        [getUserId(req) ?? null, id],
      );
      await ActivityLogService.log({
        userId: getUserId(req),
        action: "delete",
        resourceType: "event",
        resourceId: id,
        details: "Soft-deleted event",
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[events] delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete event" });
    }
  });

  // ---- Speakers --------------------------------------------------------------

  // POST /api/events/:id/speakers
  app.post("/api/events/:id/speakers", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const raw = await getEventRaw(eventId);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const b = req.body ?? {};
      if (!timesValid(b.startTime ?? b.start_time, b.endTime ?? b.end_time)) {
        return badRequest(res, "start_time must be before end_time");
      }

      const { rows } = await pool.query(
        `INSERT INTO drm.event_speakers
          (event_id, speaker_name, topic, detail, start_time, end_time)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          eventId,
          (b.speakerName ?? b.speaker_name) ? String(b.speakerName ?? b.speaker_name) : null,
          b.topic ? String(b.topic) : null,
          b.detail ? String(b.detail) : null,
          (b.startTime ?? b.start_time) ? String(b.startTime ?? b.start_time) : null,
          (b.endTime ?? b.end_time) ? String(b.endTime ?? b.end_time) : null,
        ],
      );
      res.status(201).json({ success: true, speaker: mapSpeaker(rows[0]) });
    } catch (err) {
      console.error("[events] speaker create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to add speaker" });
    }
  });

  // PATCH /api/events/:id/speakers/:speakerId
  app.patch("/api/events/:id/speakers/:speakerId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const speakerId = String(req.params.speakerId);
      const raw = await getEventRaw(eventId);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const b = req.body ?? {};
      if (!timesValid(b.startTime ?? b.start_time, b.endTime ?? b.end_time)) {
        return badRequest(res, "start_time must be before end_time");
      }

      const sets: string[] = [];
      const params: any[] = [];
      const addSet = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.speakerName !== undefined) addSet("speaker_name", b.speakerName ? String(b.speakerName) : null);
      else if (b.speaker_name !== undefined) addSet("speaker_name", b.speaker_name ? String(b.speaker_name) : null);
      if (b.topic !== undefined) addSet("topic", b.topic ? String(b.topic) : null);
      if (b.detail !== undefined) addSet("detail", b.detail ? String(b.detail) : null);
      if (b.startTime !== undefined) addSet("start_time", b.startTime ? String(b.startTime) : null);
      else if (b.start_time !== undefined) addSet("start_time", b.start_time ? String(b.start_time) : null);
      if (b.endTime !== undefined) addSet("end_time", b.endTime ? String(b.endTime) : null);
      else if (b.end_time !== undefined) addSet("end_time", b.end_time ? String(b.end_time) : null);

      if (sets.length === 0) return badRequest(res, "No fields to update");
      sets.push("updated_at = now()");
      params.push(speakerId);
      params.push(eventId);

      const { rows } = await pool.query(
        `UPDATE drm.event_speakers SET ${sets.join(", ")}
         WHERE id::text = $${params.length - 1}::text AND event_id::text = $${params.length}::text
         RETURNING *`,
        params,
      );
      if (!rows[0]) return res.status(404).json({ error: "NotFound", message: "Speaker not found" });
      res.json({ success: true, speaker: mapSpeaker(rows[0]) });
    } catch (err) {
      console.error("[events] speaker update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update speaker" });
    }
  });

  // DELETE /api/events/:id/speakers/:speakerId
  app.delete("/api/events/:id/speakers/:speakerId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const speakerId = String(req.params.speakerId);
      const result = await pool.query(
        `DELETE FROM drm.event_speakers WHERE id::text = $1::text AND event_id::text = $2::text`,
        [speakerId, eventId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "NotFound", message: "Speaker not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[events] speaker delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete speaker" });
    }
  });

  // ---- Menu items ------------------------------------------------------------

  // GET /api/events/:id/menu-items
  app.get("/api/events/:id/menu-items", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const eventId = String(req.params.id);
      const { rows } = await pool.query(
        `SELECT mi.*, au.name AS assigned_user_name
         FROM drm.event_menu_items mi
         LEFT JOIN drm.users au ON au.id = mi.assigned_user_id
         WHERE mi.event_id::text = $1::text ORDER BY mi.created_at`,
        [eventId],
      );
      res.json({ data: rows.map(mapMenuItem), total: rows.length, page: 1, pageSize: rows.length });
    } catch (err) {
      console.error("[events] menu-items list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch menu items" });
    }
  });

  // POST /api/events/:id/menu-items
  app.post("/api/events/:id/menu-items", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const raw = await getEventRaw(eventId);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const b = req.body ?? {};
      const scheduledDate = b.scheduledDate ?? b.scheduled_date;
      if (scheduledDate !== undefined && scheduledDate !== null && String(scheduledDate).trim() !== "" && !isValidDate(String(scheduledDate))) {
        return badRequest(res, "scheduled_date must be a valid date");
      }

      const { rows } = await pool.query(
        `INSERT INTO drm.event_menu_items
          (event_id, item_name, assigned_user_id, assigned_role, scheduled_date,
           scheduled_time, status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          eventId,
          (b.itemName ?? b.item_name) ? String(b.itemName ?? b.item_name) : null,
          (b.assignedUserId ?? b.assigned_user_id) ? String(b.assignedUserId ?? b.assigned_user_id) : null,
          (b.assignedRole ?? b.assigned_role) ? String(b.assignedRole ?? b.assigned_role) : null,
          scheduledDate ? String(scheduledDate) : null,
          (b.scheduledTime ?? b.scheduled_time) ? String(b.scheduledTime ?? b.scheduled_time) : null,
          b.status ? String(b.status) : "pending",
          b.notes ? String(b.notes) : null,
          getUserId(req) ?? null,
        ],
      );
      res.status(201).json({ success: true, menuItem: mapMenuItem(rows[0]) });
    } catch (err) {
      console.error("[events] menu-item create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to add menu item" });
    }
  });

  // PATCH /api/events/:id/menu-items/:itemId
  app.patch("/api/events/:id/menu-items/:itemId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const itemId = String(req.params.itemId);

      const b = req.body ?? {};
      const scheduledDateProvided = b.scheduledDate !== undefined || b.scheduled_date !== undefined;
      const scheduledDate = b.scheduledDate !== undefined ? b.scheduledDate : b.scheduled_date;
      if (scheduledDateProvided && scheduledDate !== null && String(scheduledDate).trim() !== "" && !isValidDate(String(scheduledDate))) {
        return badRequest(res, "scheduled_date must be a valid date");
      }

      const sets: string[] = [];
      const params: any[] = [];
      const addSet = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.itemName !== undefined) addSet("item_name", b.itemName ? String(b.itemName) : null);
      else if (b.item_name !== undefined) addSet("item_name", b.item_name ? String(b.item_name) : null);
      if (b.assignedUserId !== undefined) addSet("assigned_user_id", b.assignedUserId ? String(b.assignedUserId) : null);
      else if (b.assigned_user_id !== undefined) addSet("assigned_user_id", b.assigned_user_id ? String(b.assigned_user_id) : null);
      if (b.assignedRole !== undefined) addSet("assigned_role", b.assignedRole ? String(b.assignedRole) : null);
      else if (b.assigned_role !== undefined) addSet("assigned_role", b.assigned_role ? String(b.assigned_role) : null);
      if (scheduledDateProvided) addSet("scheduled_date", scheduledDate ? String(scheduledDate) : null);
      if (b.scheduledTime !== undefined) addSet("scheduled_time", b.scheduledTime ? String(b.scheduledTime) : null);
      else if (b.scheduled_time !== undefined) addSet("scheduled_time", b.scheduled_time ? String(b.scheduled_time) : null);
      if (b.status !== undefined) addSet("status", b.status ? String(b.status) : "pending");
      if (b.notes !== undefined) addSet("notes", b.notes ? String(b.notes) : null);

      if (sets.length === 0) return badRequest(res, "No fields to update");
      sets.push("updated_at = now()");
      params.push(itemId);
      params.push(eventId);

      const { rows } = await pool.query(
        `UPDATE drm.event_menu_items SET ${sets.join(", ")}
         WHERE id::text = $${params.length - 1}::text AND event_id::text = $${params.length}::text
         RETURNING *`,
        params,
      );
      if (!rows[0]) return res.status(404).json({ error: "NotFound", message: "Menu item not found" });
      res.json({ success: true, menuItem: mapMenuItem(rows[0]) });
    } catch (err) {
      console.error("[events] menu-item update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update menu item" });
    }
  });

  // DELETE /api/events/:id/menu-items/:itemId
  app.delete("/api/events/:id/menu-items/:itemId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const itemId = String(req.params.itemId);
      const result = await pool.query(
        `DELETE FROM drm.event_menu_items WHERE id::text = $1::text AND event_id::text = $2::text`,
        [itemId, eventId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "NotFound", message: "Menu item not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[events] menu-item delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete menu item" });
    }
  });

  // ---- Duties ----------------------------------------------------------------

  // GET /api/events/:id/duties
  app.get("/api/events/:id/duties", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const eventId = String(req.params.id);
      const { rows } = await pool.query(
        `SELECT d.*, au.name AS assigned_user_name
         FROM drm.event_duties d
         LEFT JOIN drm.users au ON au.id = d.assigned_user_id
         WHERE d.event_id::text = $1::text ORDER BY d.created_at`,
        [eventId],
      );
      res.json({ data: rows.map(mapDuty), total: rows.length, page: 1, pageSize: rows.length });
    } catch (err) {
      console.error("[events] duties list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch duties" });
    }
  });

  // POST /api/events/:id/duties
  app.post("/api/events/:id/duties", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const raw = await getEventRaw(eventId);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Event not found" });

      const b = req.body ?? {};
      const scheduledDate = b.scheduledDate ?? b.scheduled_date;
      if (scheduledDate !== undefined && scheduledDate !== null && String(scheduledDate).trim() !== "" && !isValidDate(String(scheduledDate))) {
        return badRequest(res, "scheduled_date must be a valid date");
      }

      const { rows } = await pool.query(
        `INSERT INTO drm.event_duties
          (event_id, duty, assigned_user_id, assigned_role, scheduled_date,
           scheduled_time, status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          eventId,
          b.duty ? String(b.duty) : null,
          (b.assignedUserId ?? b.assigned_user_id) ? String(b.assignedUserId ?? b.assigned_user_id) : null,
          (b.assignedRole ?? b.assigned_role) ? String(b.assignedRole ?? b.assigned_role) : null,
          scheduledDate ? String(scheduledDate) : null,
          (b.scheduledTime ?? b.scheduled_time) ? String(b.scheduledTime ?? b.scheduled_time) : null,
          b.status ? String(b.status) : "pending",
          b.notes ? String(b.notes) : null,
          getUserId(req) ?? null,
        ],
      );
      notifyDutyAssignment(rows[0]?.assigned_user_id, rows[0]?.duty);
      res.status(201).json({ success: true, duty: mapDuty(rows[0]) });
    } catch (err) {
      console.error("[events] duty create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to add duty" });
    }
  });

  // PATCH /api/events/:id/duties/:dutyId
  app.patch("/api/events/:id/duties/:dutyId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const dutyId = String(req.params.dutyId);

      const b = req.body ?? {};
      const scheduledDateProvided = b.scheduledDate !== undefined || b.scheduled_date !== undefined;
      const scheduledDate = b.scheduledDate !== undefined ? b.scheduledDate : b.scheduled_date;
      if (scheduledDateProvided && scheduledDate !== null && String(scheduledDate).trim() !== "" && !isValidDate(String(scheduledDate))) {
        return badRequest(res, "scheduled_date must be a valid date");
      }

      const sets: string[] = [];
      const params: any[] = [];
      const addSet = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.duty !== undefined) addSet("duty", b.duty ? String(b.duty) : null);
      if (b.assignedUserId !== undefined) addSet("assigned_user_id", b.assignedUserId ? String(b.assignedUserId) : null);
      else if (b.assigned_user_id !== undefined) addSet("assigned_user_id", b.assigned_user_id ? String(b.assigned_user_id) : null);
      if (b.assignedRole !== undefined) addSet("assigned_role", b.assignedRole ? String(b.assignedRole) : null);
      else if (b.assigned_role !== undefined) addSet("assigned_role", b.assigned_role ? String(b.assigned_role) : null);
      if (scheduledDateProvided) addSet("scheduled_date", scheduledDate ? String(scheduledDate) : null);
      if (b.scheduledTime !== undefined) addSet("scheduled_time", b.scheduledTime ? String(b.scheduledTime) : null);
      else if (b.scheduled_time !== undefined) addSet("scheduled_time", b.scheduled_time ? String(b.scheduled_time) : null);
      if (b.status !== undefined) addSet("status", b.status ? String(b.status) : "pending");
      if (b.notes !== undefined) addSet("notes", b.notes ? String(b.notes) : null);

      if (sets.length === 0) return badRequest(res, "No fields to update");

      const assigneeProvided = b.assignedUserId !== undefined || b.assigned_user_id !== undefined;
      let prevAssignee: string | null = null;
      if (assigneeProvided) {
        const prev = await pool.query(
          `SELECT assigned_user_id FROM drm.event_duties WHERE id::text = $1::text AND event_id::text = $2::text`,
          [dutyId, eventId],
        );
        prevAssignee = prev.rows[0]?.assigned_user_id ?? null;
      }

      sets.push("updated_at = now()");
      params.push(dutyId);
      params.push(eventId);

      const { rows } = await pool.query(
        `UPDATE drm.event_duties SET ${sets.join(", ")}
         WHERE id::text = $${params.length - 1}::text AND event_id::text = $${params.length}::text
         RETURNING *`,
        params,
      );
      if (!rows[0]) return res.status(404).json({ error: "NotFound", message: "Duty not found" });
      const newAssignee = rows[0]?.assigned_user_id ?? null;
      if (assigneeProvided && newAssignee && newAssignee !== prevAssignee) {
        notifyDutyAssignment(newAssignee, rows[0]?.duty);
      }
      res.json({ success: true, duty: mapDuty(rows[0]) });
    } catch (err) {
      console.error("[events] duty update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update duty" });
    }
  });

  // DELETE /api/events/:id/duties/:dutyId
  app.delete("/api/events/:id/duties/:dutyId", async (req: Request, res: Response) => {
    try {
      if (denyEventMutation(req, res)) return;
      const eventId = String(req.params.id);
      const dutyId = String(req.params.dutyId);
      const result = await pool.query(
        `DELETE FROM drm.event_duties WHERE id::text = $1::text AND event_id::text = $2::text`,
        [dutyId, eventId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "NotFound", message: "Duty not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[events] duty delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete duty" });
    }
  });
}
