import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { requireReportPermission } from "./middleware/report-permission";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { eventsReportHandler, eventsReportExportHandler } from "./events-routes";
import { ActivityLogService } from "./services/activity-service";
import { buildExportFilename } from "../utils/export-filename";
import {
  listDepartmentFilters,
  listDepartmentProjectReport,
  getDepartmentCommission,
  createDepartmentCommission,
  COMPLETION_STATUS_MODES,
} from "./services/department-report.service";
import { fetchLegacyDailyGmRecords, legacyDailyGmAvailable } from "../utils/daily-gm-record-legacy";

const RAW_ATTENDANCE_LIMITS = [10, 25, 50, 100];

// Real persisted meeting_status enum values (shared/schema.ts meetingStatusEnum).
// The reception report whitelists these so an unknown value yields a 400 instead
// of a raw 22P02 enum error (status is compared as text for the same reason).
const RECEPTION_STATUSES = ["expected", "in_progress", "ended"] as const;

// Reception row-level scope. Mirrors resolveDayTargetScope (reports-routes.ts):
//   - global roles (admin/super_hod/hod/account_manager/reception_manager) see all,
//   - a non-managerial caller (reception / reception_executive) sees only their own
//     reception rows (created_by OR user_id = self),
//   - any other manager is bounded to their department/team via getDepartmentFilterUserIds.
// A `userId` query param only ever NARROWS within the caller's scope; an id outside
// the scope resolves to a zero-UUID sentinel so the result is empty (never widened).
const RECEPTION_GLOBAL_ROLES = [
  "admin",
  "super_admin",
  "super_hod",
  "hod",
  "account_manager",
  "reception_manager",
];

// The reception report accepts the receptionist filter under either `userId`
// (legacy/UI) or `receptionistId` (Stage 8 spec). Returns the raw value or null
// for "all"/empty.
function rawReceptionUserId(req: Request): string | null {
  const v = req.query.userId ?? req.query.receptionistId;
  if (typeof v !== "string" || v === "" || v === "all") return null;
  return String(v);
}

async function resolveReceptionScope(req: Request): Promise<string[] | null> {
  const user = req.user as any;
  const role = normalizeRole(user.activeRoleId ?? user.roleId ?? user.role);
  const queryUserId = rawReceptionUserId(req);

  let allowed: string[] | null;
  if (RECEPTION_GLOBAL_ROLES.includes(role)) {
    allowed = null; // all reception records
  } else if (!isManagerialRole(role)) {
    allowed = [String(user.userId)]; // reception executive: own records only
  } else {
    allowed = await getDepartmentFilterUserIds(req); // other managers: their team (null => global)
  }

  if (queryUserId) {
    if (allowed === null) return [queryUserId];
    return allowed.includes(queryUserId)
      ? [queryUserId]
      : ["00000000-0000-0000-0000-000000000000"]; // out of scope → empty result
  }
  return allowed;
}

// The reception report accepts an optional `userId` to narrow within scope. Reject
// a malformed value with a 400 (honest input rejection) rather than letting it
// reach ANY($n::uuid[]) and surface as a raw 22P02 → 500.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function receptionUserIdError(req: Request): string | null {
  const raw = rawReceptionUserId(req);
  if (raw === null) return null;
  return UUID_RE.test(raw) ? null : "userId must be a valid UUID";
}

/**
 * Shared WHERE clause for the reception report (list + CSV export), so both honor
 * identical filters AND identical row-scope. Returns an `error` string for a 400
 * on an unknown status. `m.status` is compared as text to avoid a raw 22P02.
 */
function buildReceptionFilters(
  req: Request,
  scope: string[] | null,
): { error?: string; clause: string; params: any[] } {
  const { start, end } = parseDateRange(req);
  const where: string[] = [];
  const params: any[] = [];

  if (start) { params.push(start); where.push(`m.meeting_date >= $${params.length}`); }
  if (end) { params.push(end); where.push(`m.meeting_date <= $${params.length}`); }

  // month=YYYY-MM is a convenience date-range filter over meeting_date. Reject a
  // malformed value with a 400 rather than silently ignoring it.
  if (req.query.month) {
    const m = String(req.query.month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) {
      return { error: "month must be in YYYY-MM format", clause: "", params: [] };
    }
    const [y, mo] = m.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
    params.push(monthStart); where.push(`m.meeting_date >= $${params.length}`);
    params.push(monthEnd); where.push(`m.meeting_date <= $${params.length}`);
  }

  if (req.query.status) {
    const status = String(req.query.status);
    if (!RECEPTION_STATUSES.includes(status as any)) {
      return {
        error: `status must be one of ${RECEPTION_STATUSES.join(", ")}`,
        clause: "",
        params: [],
      };
    }
    params.push(status);
    where.push(`m.status::text = $${params.length}`);
  }

  if (req.query.company) {
    params.push(`%${String(req.query.company).trim()}%`);
    where.push(`c.company_name ILIKE $${params.length}`);
  }
  if (req.query.customer) {
    params.push(`%${String(req.query.customer).trim()}%`);
    where.push(`m.person_name ILIKE $${params.length}`);
  }
  // branch is not stored on a meeting; it comes from the receptionist (the row's
  // created_by user, joined as `ru`). Case-insensitive substring match, matching
  // the company/customer free-text filter behavior.
  if (req.query.branch) {
    params.push(`%${String(req.query.branch).trim()}%`);
    where.push(`ru.branch ILIKE $${params.length}`);
  }

  // Row-level scope (own / team / all). null === unrestricted.
  if (scope !== null) {
    params.push(scope);
    where.push(
      `(m.created_by = ANY($${params.length}::uuid[]) OR m.user_id = ANY($${params.length}::uuid[]))`,
    );
  }

  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

/**
 * Builds the shared WHERE clause for the raw-attendance report (used by both the
 * paginated list and the CSV export so they honor identical filters). Returns an
 * `error` string for a 400 when the required date range is missing/invalid.
 * `a.status` is compared as text to avoid a raw 22P02 on an unknown status value.
 */
function buildRawAttendanceFilters(req: Request): {
  error?: string;
  clause: string;
  params: any[];
} {
  const { start, end } = parseDateRange(req);
  if (!start || !end) return { error: "startDate and endDate are required", clause: "", params: [] };
  if (start > end) return { error: "startDate must be on or before endDate", clause: "", params: [] };

  const where: string[] = ["a.date >= $1", "a.date <= $2"];
  const params: any[] = [start, end];
  if (req.query.branch) { params.push(String(req.query.branch)); where.push(`u.branch = $${params.length}`); }
  if (req.query.department) { params.push(String(req.query.department)); where.push(`u.department = $${params.length}`); }
  if (req.query.userId) { params.push(String(req.query.userId)); where.push(`a.user_id = $${params.length}`); }
  if (req.query.attendanceStatus) { params.push(String(req.query.attendanceStatus)); where.push(`a.status::text = $${params.length}`); }
  return { clause: `WHERE ${where.join(" AND ")}`, params };
}

/**
 * Maps a raw drm.attendance row to the report row shape. Metrics with no source
 * column (lateMinutes/earlyOutMinutes/overtimeMinutes/leaveType/penaltyAmount)
 * are returned as null rather than fabricated; source is always "attendance".
 */
function mapRawAttendanceRow(r: any) {
  const workingMinutes =
    r.working_hours != null
      ? Math.round(Number(r.working_hours) * 60)
      : r.check_in && r.check_out
        ? Math.max(0, Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000))
        : null;
  return {
    id: r.id,
    employeeId: r.user_id,
    employeeName: r.employee_name ?? null,
    attendanceId: r.id,
    branch: r.branch ?? null,
    department: r.department ?? null,
    date: r.date,
    checkIn: r.check_in,
    checkOut: r.check_out,
    status: r.status,
    lateMinutes: null,
    earlyOutMinutes: null,
    workingMinutes,
    overtimeMinutes: null,
    leaveType: null,
    penaltyAmount: null,
    isLate: r.is_late ?? false,
    lateCheckin: r.late_checkin ?? false,
    lateCheckout: r.late_checkout ?? false,
    source: "attendance",
    remarks: r.notes ?? null,
  };
}

/**
 * Old DRM "Raw Attendance" = biometric machine punches (webxl_raw_attendence,
 * copied to drm.attendance_raw_punches). A punch only carries the device user
 * id (old webxl_user.att_id), which is reused across branches/people, so the
 * employee is resolved as: same att_id, branch matching the office, the person
 * who has an attendance row that day, active (role != 54), newest id.
 * att_timestamp holds Pakistan wall-clock stored as Europe/Berlin.
 */
function buildRawPunchQuery(req: Request): { error?: string; sql: string; params: any[] } {
  const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
  const start = String(req.query.startDate ?? "");
  const end = String(req.query.endDate ?? "");
  if (!ymdRe.test(start) || !ymdRe.test(end)) return { error: "startDate and endDate are required", sql: "", params: [] };
  if (start > end) return { error: "startDate must be on or before endDate", sql: "", params: [] };
  const office = req.query.branch ? String(req.query.branch) : null;
  const userId = req.query.userId ? String(req.query.userId) : null;
  const sql = `
    WITH p AS (
      SELECT r.id, r.user_id AS direct_user, r.legacy_uid, r.office, r.device_ip, r.state, r.punch_type,
             r.att_timestamp AT TIME ZONE 'Europe/Berlin' AS pk_ts,
             r.received_at AT TIME ZONE 'Europe/Berlin' AS pk_recv
        FROM drm.attendance_raw_punches r
       WHERE r.att_timestamp >= ($1::date)::timestamp AT TIME ZONE 'Europe/Berlin'
         AND r.att_timestamp < ($2::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin'
         AND ($3::text IS NULL OR r.office = $3)
    ),
    cand AS MATERIALIZED (
      SELECT u._legacy_pk AS lid, u.att_id, u.name, u.branch, u."roleId" AS role_id, mu.modern_id
        FROM legacy_archive.webxl_user u
        LEFT JOIN migration_meta.migration_legacy_ids mu
          ON mu.modern_table = 'users' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = u._legacy_pk
       WHERE COALESCE(u.att_id, '') <> '' AND u.att_id IN (SELECT DISTINCT legacy_uid FROM p)
    ),
    ad AS MATERIALIZED (
      SELECT DISTINCT a.user_id::text AS uid, a.date::date AS d
        FROM drm.attendance a
       WHERE a.date >= $1::date AND a.date < $2::date + 1
         AND a.user_id::text IN (SELECT modern_id FROM cand WHERE modern_id IS NOT NULL)
    ),
    res AS (
      SELECT DISTINCT ON (p.id) p.*, c.name AS legacy_name,
             COALESCE(p.direct_user::text, c.modern_id) AS emp_id
        FROM p
        LEFT JOIN cand c ON c.att_id = p.legacy_uid
        LEFT JOIN ad ON ad.uid = c.modern_id AND ad.d = p.pk_ts::date
       ORDER BY p.id,
                (c.branch = CASE WHEN p.office ILIKE 'Sialkot%' THEN 'Sialkot' ELSE 'Lahore' END) DESC NULLS LAST,
                (ad.uid IS NOT NULL) DESC,
                (c.role_id = '54') ASC NULLS LAST, c.lid::bigint DESC NULLS LAST
    )
    SELECT res.id, res.legacy_uid, res.office, res.device_ip, res.state, res.punch_type, res.emp_id,
           COALESCE(u.full_name, u.name, res.legacy_name) AS employee_name,
           to_char(res.pk_ts, 'YYYY-MM-DD') AS punch_date,
           to_char(res.pk_ts, 'HH12:MI:SS AM') AS punch_time,
           to_char(res.pk_recv, 'YYYY-MM-DD HH12:MI AM') AS received_at,
           COUNT(*) OVER () AS total
      FROM res
      LEFT JOIN drm.users u ON u.id::text = res.emp_id
     WHERE ($4::text IS NULL OR res.emp_id = $4)
     ORDER BY res.pk_ts DESC, employee_name ASC`;
  return { sql, params: [start, end, office, userId] };
}

function mapRawPunchRow(r: any) {
  return {
    id: r.id,
    employeeId: r.emp_id ?? null,
    employeeName: r.employee_name ?? null,
    deviceUserId: r.legacy_uid ?? null,
    office: r.office ?? null,
    deviceIp: r.device_ip ?? null,
    state: r.state ?? null,
    type: r.punch_type ?? null,
    date: r.punch_date ?? null,
    time: r.punch_time ?? null,
    receivedAt: r.received_at ?? null,
  };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parsePaging(req: Request) {
  let page = Number(req.query.page ?? 1);
  let pageSize = Number(req.query.pageSize ?? 50);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = 50;
  if (pageSize > 200) pageSize = 200;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseDateRange(req: Request) {
  // Accept both startDate/endDate and dateFrom/dateTo for flexibility.
  const startStr = (req.query.startDate ?? req.query.dateFrom) as string | undefined;
  const endStr = (req.query.endDate ?? req.query.dateTo) as string | undefined;
  let start: Date | null = null;
  let end: Date | null = null;
  if (startStr) {
    const d = new Date(startStr);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); start = d; }
  }
  if (endStr) {
    const d = new Date(endStr);
    if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); end = d; }
  }
  return { start, end };
}

export function registerStage3ReportsRoutes(app: Express) {
  // GET /api/reports/daily-added-gm - GM/BV entries added in a date range.
  app.get("/api/reports/daily-added-gm", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { start, end } = parseDateRange(req);
      const { page, pageSize, offset } = parsePaging(req);

      // Data-scope fix: `userId` was previously an optional filter only — any
      // authenticated role (of any kind) could omit it to see every sales
      // person's GM entries org-wide, or pass ANY other user's id. Apply the
      // same isPrivileged/department scoping already established for the
      // sibling report routes in reports-routes.ts: non-managerial callers are
      // restricted to their own entries; managers get their department's
      // allowed-user set; admin/hod-tier callers keep full org-wide access
      // (getDepartmentFilterUserIds already returns null for that tier).
      const role = normalizeRole((req.user as any).activeRoleId || (req.user as any).roleId || "");
      const isPrivileged = isManagerialRole(role);
      let scopedUserIds: string[] | null = null;
      if (!isPrivileged) {
        scopedUserIds = [req.user.userId];
      } else {
        scopedUserIds = await getDepartmentFilterUserIds(req);
      }

      const where: string[] = ["g.is_deleted IS NOT TRUE"];
      const params: any[] = [];
      if (start) { params.push(start); where.push(`g.created_at >= $${params.length}`); }
      if (end) { params.push(end); where.push(`g.created_at <= $${params.length}`); }
      if (scopedUserIds) {
        params.push(scopedUserIds);
        where.push(`g.sales_person_id = ANY($${params.length}::text[])`);
      } else if (req.query.userId) {
        // Only an org-wide-scoped caller (scopedUserIds === null) may filter to
        // an arbitrary other user's id.
        params.push(String(req.query.userId));
        where.push(`g.sales_person_id = $${params.length}`);
      }
      if (req.query.company) { params.push(`%${String(req.query.company)}%`); where.push(`g.company_name ILIKE $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status)); where.push(`g.status = $${params.length}`); }
      const useLegacy = await legacyDailyGmAvailable(pool);

      if (useLegacy) {
        let scopedLegacyUserIds: string[] | null = null;
        if (scopedUserIds?.length) {
          const mapRes = await pool.query(
            `SELECT DISTINCT w.user_id
             FROM drm.users u
             JOIN legacy_archive.webxl_user w
               ON lower(btrim(w.email)) = lower(btrim(u.email))
             WHERE u.id::text = ANY($1::text[]) AND w.user_id IS NOT NULL`,
            [scopedUserIds],
          );
          scopedLegacyUserIds = mapRes.rows.map((r) => String(r.user_id));
          if (!scopedLegacyUserIds.length) {
            return res.json({ rows: [], total: 0, page, pageSize, source: "legacy" });
          }
        }

        const legacy = await fetchLegacyDailyGmRecords(pool, {
          start,
          end,
          page,
          pageSize,
          scopedLegacyUserIds,
        });
        return res.json({ ...legacy, page, pageSize, source: "legacy" });
      }

      const clause = `WHERE ${where.join(" AND ")}`;

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM drm.gm_entries g ${clause}`, params);
      const total = countRes.rows[0]?.total ?? 0;

      const rowsRes = await pool.query(
        `SELECT g.id, g.drm_id, g.company_name,
                COALESCE(NULLIF(btrim(g.sales_person_name), ''), sp.full_name, sp.name, ab.full_name, ab.name) AS sales_person_name,
                COALESCE(NULLIF(btrim(g.added_by_name), ''), ab.full_name, ab.name) AS added_by_name,
                g.entry_type, g.package_type, g.gm_type, g.status,
                g.amount_usd, g.amount_pkr, g.created_at
         FROM drm.gm_entries g
         LEFT JOIN drm.users sp ON sp.id::text = g.sales_person_id::text
         LEFT JOIN drm.users ab ON ab.id::text = g.created_by::text
         ${clause}
         ORDER BY g.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ rows: rowsRes.rows, total, page, pageSize, source: "modern" });
    } catch (err) {
      console.error("Error in daily-added-gm report:", err);
      res.status(500).json({ error: "Failed to load daily added GM report" });
    }
  });

  // GET /api/reports/department/filters - real department types + cities for
  // the two dropdowns (previously hardcoded, mismatched the actual data).
  app.get("/api/reports/department/filters", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const role = normalizeRole((req.user as any).activeRoleId || (req.user as any).roleId || "");
      if (!isManagerialRole(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view the department report" });
      }
      const filters = await listDepartmentFilters();
      res.json(filters);
    } catch (err) {
      console.error("Error in department report filters:", err);
      res.status(500).json({ error: "Failed to load department report filters" });
    }
  });

  // GET /api/reports/department - department-level project delivery report.
  app.get("/api/reports/department", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      // Role gate: this report's whole purpose is cross-department comparison,
      // so it is intentionally NOT self/own-department-scoped (unlike
      // daily-added-gm above) — it is a managerial oversight view, consistent
      // with project-report-routes.ts's identical design.
      const role = normalizeRole((req.user as any).activeRoleId || (req.user as any).roleId || "");
      if (!isManagerialRole(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to view the department report" });
      }
      const departmentType = req.query.department ? String(req.query.department) : "";
      const status = req.query.status ? String(req.query.status) : "";
      const city = req.query.city ? String(req.query.city) : "All";
      const startDate = req.query.startDate ? String(req.query.startDate) : "";
      const endDate = req.query.endDate ? String(req.query.endDate) : "";
      if (!departmentType || !status || !startDate || !endDate) {
        return res.status(400).json({ error: "BadRequest", message: "department, status, startDate and endDate are required" });
      }
      const { page, pageSize } = parsePaging(req);

      const { rows, total, amountTotal, companyCount } = await listDepartmentProjectReport({ departmentType, city, status, startDate, endDate, page, pageSize });

      let commission: {
        companyCount: number;
        totalAmount: string;
        managerAmount: string;
        assistantAmount: string;
        alreadyCreated: boolean;
      } | null = null;
      if (COMPLETION_STATUS_MODES.includes(status)) {
        const month = new Date(`${startDate}T00:00:00.000Z`).getUTCMonth() + 1;
        const year = new Date(`${startDate}T00:00:00.000Z`).getUTCFullYear();
        const existing = await getDepartmentCommission(departmentType, month, year);
        commission = existing
          ? {
              companyCount: existing.companyCount,
              totalAmount: existing.totalAmount,
              managerAmount: existing.managerAmount,
              assistantAmount: existing.assistantAmount,
              alreadyCreated: true,
            }
          : {
              companyCount,
              totalAmount: String(companyCount * 500),
              managerAmount: String(companyCount * 300),
              assistantAmount: String(companyCount * 200),
              alreadyCreated: false,
            };
      }

      res.json({ rows, total, page, pageSize, commission, amountTotal });
    } catch (err: any) {
      if (err?.statusCode === 400) return res.status(400).json({ error: "BadRequest", message: err.message });
      console.error("Error in department report:", err);
      res.status(500).json({ error: "Failed to load department report" });
    }
  });

  // POST /api/reports/department/verify-commission - create the department
  // team commission ledger row for the currently-viewed completion filter.
  app.post("/api/reports/department/verify-commission", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const role = normalizeRole((req.user as any).activeRoleId || (req.user as any).roleId || "");
      if (!isManagerialRole(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to verify this commission" });
      }
      const departmentType = req.body?.department ? String(req.body.department) : "";
      const status = req.body?.status ? String(req.body.status) : "";
      const startDate = req.body?.startDate ? String(req.body.startDate) : "";
      const endDate = req.body?.endDate ? String(req.body.endDate) : "";
      if (!departmentType || !status || !startDate || !endDate) {
        return res.status(400).json({ error: "BadRequest", message: "department, status, startDate and endDate are required" });
      }
      const myId = (req.user as any).userId || (req.user as any).id;
      const created = await createDepartmentCommission({ departmentType, status, startDate, endDate, createdByUserId: String(myId) });
      void ActivityLogService.log({
        userId: String(myId),
        action: "department_report.verify_commission",
        resourceType: "department_team_commission",
        resourceId: String(created.id),
        details: JSON.stringify({ departmentType, status, startDate, endDate, totalAmount: created.totalAmount }),
      });
      res.json({ success: true, commission: created });
    } catch (err: any) {
      if (err?.statusCode === 400) return res.status(400).json({ error: "BadRequest", message: err.message });
      console.error("Error verifying department commission:", err);
      res.status(500).json({ error: "Failed to verify department commission" });
    }
  });

  // GET /api/reports/event — Stage 8 canonical events report. Delegates to the
  // shared eventsReportHandler (server/events-routes.ts), which reads the REAL
  // drm.events store (also served at /api/events/report). Registered HERE, before
  // the /reports/:type catch-all in reports-routes.ts, so this path resolves to the
  // real events handler instead of the generic catch-all. This replaces the former
  // meetings-based feed (wrong source). Gated by the event_report view permission;
  // the CSV export is gated separately by the export permission.
  app.get(
    "/api/reports/event",
    requireReportPermission("event_report", "view"),
    eventsReportHandler,
  );
  app.get(
    "/api/reports/event/export",
    requireReportPermission("event_report", "export"),
    eventsReportExportHandler,
  );

  // GET /api/reports/reception - reception meetings log.
  // Reception meetings live in drm.meetings (see server/reception-routes.ts which
  // queries the same table). Returns real rows or an empty set — never fabricated.
  // Filters: dateFrom/dateTo (or startDate/endDate), status (expected/in_progress/
  // ended), company, customer, userId. Row-scoped (see resolveReceptionScope) and
  // gated by the reception_report view permission. Paginated.
  app.get(
    "/api/reports/reception",
    requireReportPermission("reception_report", "view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const userIdError = receptionUserIdError(req);
        if (userIdError) return res.status(400).json({ error: userIdError });
        const { page, pageSize, offset } = parsePaging(req);
        const scope = await resolveReceptionScope(req);
        const { error, clause, params } = buildReceptionFilters(req, scope);
        if (error) return res.status(400).json({ error });

        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS total
           FROM drm.meetings m
           LEFT JOIN drm.customers c ON c.id = m.company_id
           LEFT JOIN drm.users ru ON ru.id = m.created_by
           ${clause}`,
          params,
        );
        const total = countRes.rows[0]?.total ?? 0;

        const listParams = params.slice();
        listParams.push(pageSize, offset);
        const rowsRes = await pool.query(
          `SELECT m.id, m.meeting_type, m.person_name, m.status,
                  m.meeting_date, m.scheduled_time, m.start_time, m.end_time,
                  m.total_duration_seconds, m.created_at,
                  m.created_by AS receptionist_id, ru.name AS receptionist_name,
                  c.company_name AS company_name
           FROM drm.meetings m
           LEFT JOIN drm.customers c ON c.id = m.company_id
           LEFT JOIN drm.users ru ON ru.id = m.created_by
           ${clause}
           ORDER BY m.meeting_date DESC
           LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
          listParams,
        );
        res.json({ data: rowsRes.rows, total, page, pageSize });
      } catch (err) {
        console.error("Error in reception report:", err);
        res.status(500).json({ error: "Failed to load reception report" });
      }
    },
  );

  // GET /api/reports/reception/export - CSV of the reception report honoring the
  // SAME filters and row-scope as the list (up to 5000 rows). Requires the
  // reception_report export permission.
  app.get(
    "/api/reports/reception/export",
    requireReportPermission("reception_report", "export"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const userIdError = receptionUserIdError(req);
        if (userIdError) return res.status(400).json({ error: userIdError });
        const scope = await resolveReceptionScope(req);
        const { error, clause, params } = buildReceptionFilters(req, scope);
        if (error) return res.status(400).json({ error });

        const rowsRes = await pool.query(
          `SELECT m.id, m.meeting_type, m.person_name, m.status,
                  m.meeting_date, m.scheduled_time, m.start_time, m.end_time,
                  m.total_duration_seconds, m.created_at,
                  m.created_by AS receptionist_id, ru.name AS receptionist_name,
                  c.company_name AS company_name
           FROM drm.meetings m
           LEFT JOIN drm.customers c ON c.id = m.company_id
           LEFT JOIN drm.users ru ON ru.id = m.created_by
           ${clause}
           ORDER BY m.meeting_date DESC
           LIMIT 5000`,
          params,
        );

        const header = [
          "Date", "Company", "Person", "Receptionist", "Meeting Type",
          "Scheduled Time", "Start", "End", "Duration (s)", "Status", "Created At",
        ];
        const lines = [header.join(",")];
        for (const r of rowsRes.rows) {
          lines.push([
            csvCell(r.meeting_date),
            csvCell(r.company_name),
            csvCell(r.person_name),
            csvCell(r.receptionist_name),
            csvCell(r.meeting_type),
            csvCell(r.scheduled_time),
            csvCell(r.start_time),
            csvCell(r.end_time),
            csvCell(r.total_duration_seconds),
            csvCell(r.status),
            csvCell(r.created_at),
          ].join(","));
        }

        await ActivityLogService.log({
          userId: req.user.userId,
          action: "reception_report.export",
          resourceType: "report",
          resourceId: "reception_report",
          details: JSON.stringify({ format: "csv", rows: rowsRes.rows.length }),
        });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${buildExportFilename("reception_report", {
            from: req.query.startDate ?? req.query.dateFrom ?? req.query.month,
            to: req.query.endDate ?? req.query.dateTo,
            user: req.query.userId ?? req.query.receptionistId,
            branch: req.query.branch,
          })}"`,
        );
        res.send(lines.join("\n"));
      } catch (err) {
        console.error("Error exporting reception report:", err);
        res.status(500).json({ error: "Failed to export reception report" });
      }
    },
  );

  // GET /api/reports/reception/team-summary - the real receptionreport.php
  // "All Team" mode: per-receptionist totals (meetings, time, GM generated
  // by companies they met), not a per-meeting list. Same row-scope as the
  // main reception report. GM linkage is via gm_entries.customer_id against
  // the set of companies this receptionist met in-range (confirmed live —
  // same column already used by department-report.service.ts's gm_match CTE).
  app.get(
    "/api/reports/reception/team-summary",
    requireReportPermission("reception_report", "view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { start, end } = parseDateRange(req);
        if (!start || !end) return res.status(400).json({ error: "startDate and endDate are required" });

        const scope = await resolveReceptionScope(req);
        const where: string[] = ["m.status::text = 'ended'", "m.meeting_date >= $1", "m.meeting_date <= $2", "m.created_by IS NOT NULL"];
        const params: any[] = [start, end];
        if (scope !== null) {
          params.push(scope);
          where.push(`m.created_by = ANY($${params.length}::uuid[])`);
        }

        const { rows } = await pool.query(
          `WITH scoped_meetings AS (
             SELECT m.id, m.created_by, m.company_id, m.total_duration_seconds
             FROM drm.meetings m
             WHERE ${where.join(" AND ")}
           )
           SELECT sm.created_by AS receptionist_id, ru.name AS receptionist_name,
             count(*)::int AS total_meetings,
             COALESCE(sum(sm.total_duration_seconds), 0)::int AS total_duration_seconds,
             (SELECT count(*)::int FROM drm.gm_entries g
              WHERE g.customer_id = ANY(
                ARRAY(SELECT DISTINCT sm2.company_id FROM scoped_meetings sm2 WHERE sm2.created_by = sm.created_by AND sm2.company_id IS NOT NULL)
              )
              AND g.created_at >= $1 AND g.created_at <= $2
             ) AS total_gm
           FROM scoped_meetings sm
           LEFT JOIN drm.users ru ON ru.id = sm.created_by
           GROUP BY sm.created_by, ru.name
           ORDER BY total_meetings DESC`,
          params,
        );
        res.json({ data: rows, startDate: req.query.startDate, endDate: req.query.endDate });
      } catch (err) {
        console.error("Error in reception team summary:", err);
        res.status(500).json({ error: "Failed to load reception team summary" });
      }
    },
  );

  // GET /api/reports/raw-attendance - real, attendance-sourced report.
  // No biometric table exists, so rows come from drm.attendance (source:"attendance").
  // Requires startDate + endDate; filters branch/department/userId/attendanceStatus.
  app.get(
    "/api/reports/raw-attendance",
    requireReportPermission("raw_attendance", "view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { error, sql, params } = buildRawPunchQuery(req);
        if (error) return res.status(400).json({ error });

        let page = Number(req.query.page ?? 1);
        if (!Number.isInteger(page) || page < 1) page = 1;
        let limit = Number(req.query.limit ?? 25);
        if (!RAW_ATTENDANCE_LIMITS.includes(limit)) limit = 25;
        const offset = (page - 1) * limit;

        const rowsRes = await pool.query(`${sql} LIMIT ${limit} OFFSET ${offset}`, params);
        let total = Number(rowsRes.rows[0]?.total ?? 0);
        if (rowsRes.rows.length === 0 && page > 1) {
          const c = await pool.query(`SELECT COUNT(*)::int AS n FROM (${sql}) x`, params);
          total = c.rows[0]?.n ?? 0;
        }
        const offices = await pool.query(
          `SELECT DISTINCT office FROM drm.attendance_raw_punches WHERE office IS NOT NULL ORDER BY 1`,
        );

        res.json({
          rows: rowsRes.rows.map(mapRawPunchRow),
          total,
          page,
          limit,
          offices: offices.rows.map((o: any) => o.office),
          source: "raw_punches",
        });
      } catch (err) {
        console.error("Error in raw-attendance report:", err);
        res.status(500).json({ error: "Failed to load raw attendance report" });
      }
    },
  );

  // GET /api/reports/raw-attendance/export - CSV honoring the same filters.
  app.get(
    "/api/reports/raw-attendance/export",
    requireReportPermission("raw_attendance", "export"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { error, sql, params } = buildRawPunchQuery(req);
        if (error) return res.status(400).json({ error });

        const rowsRes = await pool.query(`${sql} LIMIT 20000`, params);
        const header = ["Date", "Time", "Employee", "Device User ID", "Office", "Device IP", "State", "Type", "Received At"];
        const lines = [header.join(",")];
        for (const raw of rowsRes.rows) {
          const r = mapRawPunchRow(raw);
          lines.push([
            csvCell(r.date), csvCell(r.time), csvCell(r.employeeName), csvCell(r.deviceUserId),
            csvCell(r.office), csvCell(r.deviceIp), csvCell(r.state), csvCell(r.type), csvCell(r.receivedAt),
          ].join(","));
        }

        await ActivityLogService.log({
          userId: req.user.userId,
          action: "raw_attendance.export",
          resourceType: "report",
          resourceId: "raw_attendance",
          details: JSON.stringify({ format: "csv", rows: rowsRes.rows.length }),
        });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${buildExportFilename("raw_attendance", {
            from: req.query.startDate,
            to: req.query.endDate,
            user: req.query.userId,
            branch: req.query.branch,
          })}"`,
        );
        res.send(lines.join("\n"));
      } catch (err) {
        console.error("Error exporting raw-attendance report:", err);
        res.status(500).json({ error: "Failed to export raw attendance report" });
      }
    },
  );
}
