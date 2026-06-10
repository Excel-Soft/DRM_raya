import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { requireReportPermission } from "./middleware/report-permission";

const RAW_ATTENDANCE_LIMITS = [10, 25, 50, 100];

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

      const where: string[] = ["g.is_deleted IS NOT TRUE"];
      const params: any[] = [];
      if (start) { params.push(start); where.push(`g.created_at >= $${params.length}`); }
      if (end) { params.push(end); where.push(`g.created_at <= $${params.length}`); }
      if (req.query.userId) { params.push(String(req.query.userId)); where.push(`g.sales_person_id = $${params.length}`); }
      if (req.query.company) { params.push(`%${String(req.query.company)}%`); where.push(`g.company_name ILIKE $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status)); where.push(`g.status = $${params.length}`); }
      const clause = `WHERE ${where.join(" AND ")}`;

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM drm.gm_entries g ${clause}`, params);
      const total = countRes.rows[0]?.total ?? 0;

      const rowsRes = await pool.query(
        `SELECT g.id, g.company_name, g.sales_person_name, g.added_by_name,
                g.entry_type, g.package_type, g.gm_type, g.status,
                g.amount_usd, g.amount_pkr, g.created_at
         FROM drm.gm_entries g
         ${clause}
         ORDER BY g.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ rows: rowsRes.rows, total, page, pageSize });
    } catch (err) {
      console.error("Error in daily-added-gm report:", err);
      res.status(500).json({ error: "Failed to load daily added GM report" });
    }
  });

  // GET /api/reports/department - GM entries by sales-person department.
  app.get("/api/reports/department", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { start, end } = parseDateRange(req);
      const { page, pageSize, offset } = parsePaging(req);

      const where: string[] = ["g.is_deleted IS NOT TRUE"];
      const params: any[] = [];
      if (start) { params.push(start); where.push(`g.created_at >= $${params.length}`); }
      if (end) { params.push(end); where.push(`g.created_at <= $${params.length}`); }
      if (req.query.department) { params.push(String(req.query.department)); where.push(`u.department = $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status)); where.push(`g.status = $${params.length}`); }
      const clause = `WHERE ${where.join(" AND ")}`;

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM drm.gm_entries g
         LEFT JOIN drm.users u ON u.id = g.sales_person_id
         ${clause}`,
        params,
      );
      const total = countRes.rows[0]?.total ?? 0;

      const rowsRes = await pool.query(
        `SELECT g.id, g.company_name, g.package_type, g.status, g.entry_type,
                g.amount_usd, g.amount_pkr, g.payment_status, g.created_at,
                g.approved_at, u.department
         FROM drm.gm_entries g
         LEFT JOIN drm.users u ON u.id = g.sales_person_id
         ${clause}
         ORDER BY g.created_at DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ rows: rowsRes.rows, total, page, pageSize });
    } catch (err) {
      console.error("Error in department report:", err);
      res.status(500).json({ error: "Failed to load department report" });
    }
  });

  // GET /api/reports/event - meetings/events in a date range.
  app.get("/api/reports/event", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { start, end } = parseDateRange(req);
      const { page, pageSize, offset } = parsePaging(req);

      const where: string[] = [];
      const params: any[] = [];
      if (start) { params.push(start); where.push(`m.meeting_date >= $${params.length}`); }
      if (end) { params.push(end); where.push(`m.meeting_date <= $${params.length}`); }
      if (req.query.eventType) { params.push(`%${String(req.query.eventType)}%`); where.push(`m.meeting_type ILIKE $${params.length}`); }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM drm.meetings m ${clause}`, params);
      const total = countRes.rows[0]?.total ?? 0;

      const rowsRes = await pool.query(
        `SELECT m.id, m.meeting_type, m.person_name, m.status,
                m.start_time, m.end_time, m.total_duration_seconds, m.meeting_date,
                c.company_name AS company_name
         FROM drm.meetings m
         LEFT JOIN drm.customers c ON c.id = m.company_id
         ${clause}
         ORDER BY m.meeting_date DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ rows: rowsRes.rows, total, page, pageSize });
    } catch (err) {
      console.error("Error in event report:", err);
      res.status(500).json({ error: "Failed to load event report" });
    }
  });

  // GET /api/reports/reception - reception meetings log.
  // Reception meetings live in drm.meetings (see server/reception-routes.ts which
  // queries the same table). Returns real rows or an empty set — never fabricated.
  // Filters: dateFrom/dateTo (or startDate/endDate), status, userId. Paginated.
  app.get("/api/reports/reception", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { start, end } = parseDateRange(req);
      const { page, pageSize, offset } = parsePaging(req);

      const where: string[] = [];
      const params: any[] = [];
      if (start) { params.push(start); where.push(`m.meeting_date >= $${params.length}`); }
      if (end) { params.push(end); where.push(`m.meeting_date <= $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status)); where.push(`m.status = $${params.length}`); }
      // A reception "user" can be the staff member who logged the meeting (created_by)
      // or the user the meeting was with (user_id).
      if (req.query.userId) {
        params.push(String(req.query.userId));
        where.push(`(m.created_by = $${params.length} OR m.user_id = $${params.length})`);
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM drm.meetings m ${clause}`, params);
      const total = countRes.rows[0]?.total ?? 0;

      const rowsRes = await pool.query(
        `SELECT m.id, m.meeting_type, m.person_name, m.status,
                m.meeting_date, m.scheduled_time, m.start_time, m.end_time,
                m.total_duration_seconds, m.created_at,
                c.company_name AS company_name
         FROM drm.meetings m
         LEFT JOIN drm.customers c ON c.id = m.company_id
         ${clause}
         ORDER BY m.meeting_date DESC
         LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ data: rowsRes.rows, total, page, pageSize });
    } catch (err) {
      console.error("Error in reception report:", err);
      res.status(500).json({ error: "Failed to load reception report" });
    }
  });

  // GET /api/reports/raw-attendance - real, attendance-sourced report.
  // No biometric table exists, so rows come from drm.attendance (source:"attendance").
  // Requires startDate + endDate; filters branch/department/userId/attendanceStatus.
  app.get(
    "/api/reports/raw-attendance",
    requireReportPermission("raw_attendance", "view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { error, clause, params } = buildRawAttendanceFilters(req);
        if (error) return res.status(400).json({ error });

        let page = Number(req.query.page ?? 1);
        if (!Number.isInteger(page) || page < 1) page = 1;
        let limit = Number(req.query.limit ?? 25);
        if (!RAW_ATTENDANCE_LIMITS.includes(limit)) limit = 25;
        const offset = (page - 1) * limit;

        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS total
             FROM drm.attendance a
             LEFT JOIN drm.users u ON u.id::text = a.user_id
             ${clause}`,
          params,
        );
        const total = countRes.rows[0]?.total ?? 0;

        const rowsRes = await pool.query(
          `SELECT a.id, a.user_id, a.date, a.check_in, a.check_out, a.status,
                  a.late_checkin, a.late_checkout, a.is_late, a.working_hours, a.notes,
                  COALESCE(u.full_name, u.name, u.username) AS employee_name,
                  u.branch, u.department
             FROM drm.attendance a
             LEFT JOIN drm.users u ON u.id::text = a.user_id
             ${clause}
             ORDER BY a.date DESC, employee_name ASC
             LIMIT ${limit} OFFSET ${offset}`,
          params,
        );

        res.json({
          rows: rowsRes.rows.map(mapRawAttendanceRow),
          total,
          page,
          limit,
          source: "attendance",
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
        const { error, clause, params } = buildRawAttendanceFilters(req);
        if (error) return res.status(400).json({ error });

        const rowsRes = await pool.query(
          `SELECT a.id, a.user_id, a.date, a.check_in, a.check_out, a.status,
                  a.late_checkin, a.late_checkout, a.is_late, a.working_hours, a.notes,
                  COALESCE(u.full_name, u.name, u.username) AS employee_name,
                  u.branch, u.department
             FROM drm.attendance a
             LEFT JOIN drm.users u ON u.id::text = a.user_id
             ${clause}
             ORDER BY a.date DESC, employee_name ASC
             LIMIT 5000`,
          params,
        );

        const header = [
          "Date", "Employee", "Branch", "Department", "Status",
          "Check In", "Check Out", "Working Minutes", "Is Late", "Source", "Remarks",
        ];
        const lines = [header.join(",")];
        for (const raw of rowsRes.rows) {
          const r = mapRawAttendanceRow(raw);
          lines.push([
            csvCell(r.date),
            csvCell(r.employeeName),
            csvCell(r.branch),
            csvCell(r.department),
            csvCell(r.status),
            csvCell(r.checkIn),
            csvCell(r.checkOut),
            csvCell(r.workingMinutes),
            csvCell(r.isLate),
            csvCell(r.source),
            csvCell(r.remarks),
          ].join(","));
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="raw_attendance.csv"`);
        res.send(lines.join("\n"));
      } catch (err) {
        console.error("Error exporting raw-attendance report:", err);
        res.status(500).json({ error: "Failed to export raw attendance report" });
      }
    },
  );
}
