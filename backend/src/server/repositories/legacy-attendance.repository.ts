import { pool } from "../db";

async function resolveLegacyUserId(modernUserId: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT legacy_id::text AS legacy_id
       FROM migration_meta.migration_legacy_ids
      WHERE entity_type = 'user'
        AND legacy_table = 'webxl_user'
        AND modern_id = $1
      LIMIT 1`,
    [modernUserId],
  );
  return res.rows[0]?.legacy_id ?? null;
}

async function resolveDisplayName(modernUserId: string): Promise<string> {
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(trim(u.full_name), ''), NULLIF(trim(w.name), ''), u.username) AS display_name
       FROM drm.users u
       LEFT JOIN migration_meta.migration_legacy_ids m
         ON m.modern_id = u.id::text AND m.entity_type = 'user' AND m.legacy_table = 'webxl_user'
       LEFT JOIN legacy_archive.webxl_user w ON w.user_id::text = m.legacy_id
      WHERE u.id = $1
      LIMIT 1`,
    [modernUserId],
  );
  return res.rows[0]?.display_name ?? "User";
}

function parseLegacyDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function combineDateAndTime(dateStr: string, timeStr: string | null | undefined): Date | null {
  const base = parseLegacyDate(dateStr);
  if (!base || !timeStr) return base;
  const t = String(timeStr).trim();
  if (!t) return base;
  const [h, m] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(h)) return base;
  const out = new Date(base);
  out.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  return out;
}

function mapLateAbsentToStatus(lateAbsent: string | null | undefined, timeIn: string | null): string {
  const la = String(lateAbsent ?? "").trim();
  const lower = la.toLowerCase();
  if (lower === "true" || lower === "absent" || (!timeIn && la === "")) {
    return "Absent";
  }
  if (la.includes(":")) return "Late";
  if (timeIn) return "Present";
  return "Absent";
}

export type LegacyDailyRecord = {
  id: string;
  date: Date;
  dateText: string;
  timeIn: Date | null;
  timeOut: Date | null;
  timeInText: string | null;
  timeOutText: string | null;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  lateAbsentLabel: string;
};

function mapLegacyAttendanceRow(row: any): LegacyDailyRecord {
  const dateText = String(row.date ?? "").trim();
  const date = parseLegacyDate(dateText)!;
  const timeInRaw = String(row.timeIn ?? row.timein ?? "").trim();
  const timeOutRaw = String(row.timeOut ?? row.timeout ?? "").trim();
  const timeIn = timeInRaw ? combineDateAndTime(dateText, timeInRaw) : null;
  const timeOut = timeOutRaw ? combineDateAndTime(dateText, timeOutRaw) : null;
  const status = mapLateAbsentToStatus(row.late_absent, timeInRaw || null);
  const la = String(row.late_absent ?? "").trim();
  let lateMinutes = 0;
  if (la.includes(":")) {
    const [h, m] = la.split(":").map((x: string) => Number(x));
    if (Number.isFinite(h)) lateMinutes = h * 60 + (Number.isFinite(m) ? m : 0);
  }
  return {
    id: String(row.id ?? row._legacy_pk),
    date,
    dateText,
    timeIn,
    timeOut,
    timeInText: timeInRaw || null,
    timeOutText: timeOutRaw || null,
    status,
    isLate: status === "Late",
    lateMinutes,
    lateAbsentLabel: la || status,
  };
}

export async function getLegacyDailyRecords(
  modernUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<LegacyDailyRecord[]> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  if (!legacyUserId) return [];

  const res = await pool.query(
    `SELECT _legacy_pk AS id,
            date,
            "timeIn",
            "timeOut",
            late_absent
       FROM legacy_archive.webxl_attendance
      WHERE user_id = $1
        AND NULLIF(trim(date), '') IS NOT NULL
        AND to_date(trim(date), 'YYYY-MM-DD') >= $2::date
        AND to_date(trim(date), 'YYYY-MM-DD') <= $3::date
      ORDER BY to_date(trim(date), 'YYYY-MM-DD') DESC`,
    [legacyUserId, startDate, endDate],
  );

  return res.rows.map(mapLegacyAttendanceRow);
}

export async function getLegacyDailyRecordsPaginated(
  modernUserId: string,
  options: {
    startDate?: Date | null;
    endDate?: Date | null;
    page?: number;
    pageSize?: number;
  },
): Promise<{
  records: LegacyDailyRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  if (!legacyUserId) {
    return { records: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const params: unknown[] = [legacyUserId];
  let where = `user_id = $1 AND NULLIF(trim(date), '') IS NOT NULL`;
  if (options.startDate && options.endDate) {
    params.push(options.startDate, options.endDate);
    where += ` AND to_date(trim(date), 'YYYY-MM-DD') >= $2::date
               AND to_date(trim(date), 'YYYY-MM-DD') <= $3::date`;
  }

  const countRes = await pool.query(
    `SELECT count(*)::int AS c FROM legacy_archive.webxl_attendance WHERE ${where}`,
    params,
  );
  const total = countRes.rows[0]?.c ?? 0;
  const offset = (page - 1) * pageSize;
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  params.push(pageSize, offset);

  const res = await pool.query(
    `SELECT _legacy_pk AS id,
            date,
            "timeIn",
            "timeOut",
            late_absent
       FROM legacy_archive.webxl_attendance
      WHERE ${where}
      ORDER BY to_date(trim(date), 'YYYY-MM-DD') DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  return {
    records: res.rows.map(mapLegacyAttendanceRow),
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

export type LegacyMonthlySummaryRow = {
  totalDays: number;
  workingDays: number;
  present: number;
  late: number;
  halfDay: number;
  leave: number;
  absent: number;
  userName: string;
  month?: number;
  year?: number;
};

export async function getLegacyMonthlySummaries(
  modernUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<LegacyMonthlySummaryRow[]> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  const userName = await resolveDisplayName(modernUserId);
  if (!legacyUserId) return [];

  const res = await pool.query(
    `SELECT month, year, leaves, "halfLeave", "lateHour", "lateMin"
       FROM legacy_archive.webxl_attendance_month
      WHERE user_id = $1
        AND make_date(
              GREATEST(1, LEAST(12, COALESCE(NULLIF(trim(year), '')::int, 2000))),
              GREATEST(1, LEAST(12, COALESCE(NULLIF(trim(month), '')::int, 1))),
              1
            ) <= $3::date
        AND (make_date(
              GREATEST(1, LEAST(12, COALESCE(NULLIF(trim(year), '')::int, 2000))),
              GREATEST(1, LEAST(12, COALESCE(NULLIF(trim(month), '')::int, 1))),
              1
            ) + interval '1 month' - interval '1 day')::date >= $2::date
      ORDER BY year DESC, month DESC`,
    [legacyUserId, startDate, endDate],
  );

  if (res.rows.length === 0) {
    return [await aggregateLegacyDailySummary(modernUserId, startDate, endDate, userName)];
  }

  const rows: LegacyMonthlySummaryRow[] = [];
  for (const row of res.rows) {
    const month = Number(row.month) || 1;
    const year = Number(row.year) || startDate.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const rangeStart = monthStart < startDate ? startDate : monthStart;
    const rangeEnd = monthEnd > endDate ? endDate : monthEnd;
    const daily = await getLegacyDailyRecords(modernUserId, rangeStart, rangeEnd);
    const agg = summarizeDaily(daily, rangeStart, rangeEnd);
    agg.leave = Number(row.leaves) || agg.leave;
    agg.halfDay = Number(row.halfleave ?? row.halfLeave) || agg.halfDay;
    const legacyLateCount =
      Number(row.latehour ?? row.lateHour) > 0
        ? Number(row.latehour ?? row.lateHour)
        : 0;
    if (legacyLateCount > 0) agg.late = Math.max(agg.late, legacyLateCount);
    agg.userName = userName;
    agg.month = month;
    agg.year = year;
    rows.push(agg);
  }
  return rows;
}

function summarizeDaily(
  records: LegacyDailyRecord[],
  startDate: Date,
  endDate: Date,
): LegacyMonthlySummaryRow {
  const summary = {
    totalDays: 0,
    workingDays: 0,
    present: 0,
    late: 0,
    halfDay: 0,
    leave: 0,
    absent: 0,
    userName: "",
  };

  const daysDiff =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  summary.totalDays = daysDiff;

  for (const r of records) {
    switch (r.status) {
      case "Present":
        summary.present++;
        summary.workingDays++;
        break;
      case "Late":
        summary.late++;
        summary.workingDays++;
        break;
      case "HalfDay":
        summary.halfDay++;
        summary.workingDays += 0.5;
        break;
      case "Leave":
        summary.leave++;
        break;
      case "Absent":
        summary.absent++;
        break;
    }
  }

  const recorded = new Set(records.map((r) => r.date.toDateString()));
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (cur.getDay() !== 0 && !recorded.has(cur.toDateString())) {
      summary.absent++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return summary;
}

async function aggregateLegacyDailySummary(
  modernUserId: string,
  startDate: Date,
  endDate: Date,
  userName: string,
): Promise<LegacyMonthlySummaryRow> {
  const daily = await getLegacyDailyRecords(modernUserId, startDate, endDate);
  const agg = summarizeDaily(daily, startDate, endDate);
  agg.userName = userName;
  return agg;
}

export type LegacySalarySlip = {
  userName: string;
  grossSalary: number;
  totalWorkingDays: number;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  daysOnLeave: number;
  totalLateMinutes: number;
  lateMinutes: number;
  totalCutting: number;
  totalSalary: number;
  penalty: number;
  periodLabel: string;
  paymentStatus: string;
  createDate: string | null;
};

export async function getLegacySalarySlips(
  modernUserId: string,
  startDate: Date,
  endDate: Date,
): Promise<LegacySalarySlip[]> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  const userName = await resolveDisplayName(modernUserId);
  if (!legacyUserId) return [];

  const res = await pool.query(
    `SELECT *
       FROM legacy_archive.webxl_tem_salary_ship
      WHERE user_id = $1
        AND NULLIF(trim(create_date), '') IS NOT NULL
        AND (
          CASE
            WHEN create_date ~ '^[0-9]{4}-' THEN create_date::timestamp
            ELSE NULL
          END
        ) BETWEEN $2::timestamp AND ($3::timestamp + interval '1 day')
      ORDER BY create_date DESC NULLS LAST`,
    [legacyUserId, startDate, endDate],
  );

  return res.rows.map((row: any) => {
    const present = Number(row.present) || 0;
    const leaveDays = Number(row.leave) || 0;
    const gross = Number(row.grosssalary ?? row.grossSalary) || 0;
    const cutting = Number(row.tcutting) || Number(row.basiccutting ?? row.basicCutting) || 0;
    const total = Number(row.totalsalary ?? row.totalSalary) || 0;
    const lateMin = Number(row.cuttingmin ?? row.cuttingMin) || 0;
    const absent = Math.max(0, 30 - present - leaveDays);
    return {
      userName,
      grossSalary: gross,
      totalWorkingDays: 30,
      daysPresent: present,
      daysLate: 0,
      daysAbsent: absent,
      daysOnLeave: leaveDays,
      totalLateMinutes: lateMin,
      lateMinutes: lateMin,
      totalCutting: cutting,
      totalSalary: total,
      penalty: Number(row.penalty) || 0,
      periodLabel: row.create_date ? String(row.create_date).slice(0, 10) : "",
      paymentStatus: String(row.user_salary_status ?? row.userSalaryStatus ?? "").trim() || "pending",
      createDate: row.create_date ?? null,
    };
  });
}

export async function getLegacySalarySlipsRecent(
  modernUserId: string,
  limit = 500,
): Promise<LegacySalarySlip[]> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  const userName = await resolveDisplayName(modernUserId);
  if (!legacyUserId) return [];

  const res = await pool.query(
    `SELECT *
       FROM legacy_archive.webxl_tem_salary_ship
      WHERE user_id = $1
      ORDER BY create_date DESC NULLS LAST
      LIMIT $2`,
    [legacyUserId, limit],
  );

  return res.rows.map((row: any) => {
    const present = Number(row.present) || 0;
    const leaveDays = Number(row.leave) || 0;
    const gross = Number(row.grosssalary ?? row.grossSalary) || 0;
    const cutting = Number(row.tcutting) || Number(row.basiccutting ?? row.basicCutting) || 0;
    const total = Number(row.totalsalary ?? row.totalSalary) || 0;
    const lateMin = Number(row.cuttingmin ?? row.cuttingMin) || 0;
    const absent = Math.max(0, 30 - present - leaveDays);
    return {
      userName,
      grossSalary: gross,
      totalWorkingDays: 30,
      daysPresent: present,
      daysLate: 0,
      daysAbsent: absent,
      daysOnLeave: leaveDays,
      totalLateMinutes: lateMin,
      lateMinutes: lateMin,
      totalCutting: cutting,
      totalSalary: total,
      penalty: Number(row.penalty) || 0,
      periodLabel: row.create_date ? String(row.create_date).slice(0, 10) : "",
      paymentStatus: String(row.user_salary_status ?? row.userSalaryStatus ?? "").trim() || "pending",
      createDate: row.create_date ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Old DRM "Attendence System" page (func.php `user_id_attendence_view`).
//
// Columns per row, exactly as the PHP builds them:
//   Name        = webxl_user.name                       (username())
//   Net Salary  = webxl_user.netSalary, raw text        (getUserData())
//   Drm Time    = first webxl_log_history row of that user whose DATE(log_date)
//                 is the attendance date (no ORDER BY in the PHP -> table order,
//                 i.e. lowest id), formatted date('h:i A')   (DrmLoginTimeAccDate())
//   Time In / Time Out / Late / Absent / Date = the webxl_attendance text as stored
//   Cutting Min RS = "m x round(perMin,2) = round(m x perMin,2)",
//                 perMin = netSalary / 30 / 8 / 60.
//     Single user: m = late_absent "H:M" -> H*60+M, unless it is 'True', '0:0',
//                 empty or does not split into exactly two parts on ':'.
//     All Female / All Male: m is ALWAYS 0 (the PHP has that parsing commented out).
//   The govt-leave loop (AllGovtLeaves) can never add minutes: it only runs when
//   late_absent equals a holiday name and then requires late_absent != that same
//   name, so it is a no-op and is not queried here. For the same reason
//   ramzan()/ramzanCutting() always return nothing (blank footer cells).
// Rows: date DESC, id DESC; All Female/Male = every webxl_user of that gender
// whose roleId is not 54 (MySQL numeric compare: "54," counts as 54; NULL roleId
// is excluded by `!=`), users in table (user_id) order.
// ---------------------------------------------------------------------------

export type OldAttendanceViewRow = LegacyDailyRecord & {
  source: "legacy" | "modern";
  /** drm.attendance id (modern rows only) — usable as attendanceId for edit requests. */
  attendanceId: string | null;
  legacyUserId: string | null;
  /** Modern drm.users id of the row's employee (null when the old user is not mapped). */
  userId: string | null;
  name: string | null;
  netSalary: string | null;
  drmTime: string | null;
  cuttingMinutes: number;
  perMinRate: number;
  cuttingAmount: number;
  cuttingLabel: string;
  /** true when the row shows an in-app correction (see OLD_VIEW_EDIT_MARKER). */
  edited?: boolean;
};

export type OldAttendanceViewTotals = {
  totalLateMinutes: number;
  totalLateLabel: string;
  totalCuttingAmount: number;
};

export type OldAttendanceViewResult = {
  records: OldAttendanceViewRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  source: "legacy" | "modern";
  mode: "user" | "gender";
  /** Footer of the single-user view (null for All Female / All Male: blank in the old page). */
  totals: OldAttendanceViewTotals | null;
};

/** PHP 8 string -> number for arithmetic (numeric / leading-numeric; otherwise 0). */
function phpNumber(value: unknown): number {
  const s = String(value ?? "");
  const m = s.match(/^[ \t\n\r\v\f]*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/** PHP round(): half away from zero, with PHP's pre-rounding of float noise. */
function phpRound(value: number, precision = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** precision;
  const scaled = Number((Math.abs(value) * f).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / f;
}

/** Single-user branch: minutes taken from late_absent. */
function oldLateMinutes(lateAbsent: string | null | undefined): number {
  const late = lateAbsent ?? "";
  // PHP: $late != 'True' && $late != '0:0' && !empty($late)   ("0" is empty in PHP)
  if (late === "True" || late === "0:0" || late === "" || late === "0") return 0;
  const parts = late.split(":");
  if (parts.length !== 2) return 0;
  return phpNumber(parts[0]) * 60 + phpNumber(parts[1]);
}

/** formatMinutesToHoursMinutes() from the PHP footer. */
function formatMinutesToHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 minutes";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.trunc(totalMinutes) % 60;
  if (hours > 0 && minutes > 0) return `${hours} hours ${minutes} minutes`;
  if (hours > 0) return `${hours} hours`;
  return `${minutes} minutes`;
}

function cuttingFor(netSalaryText: string | null, minutes: number) {
  const perMin = phpNumber(netSalaryText) / 30 / 8 / 60;
  const perMinRate = phpRound(perMin, 2);
  const cuttingAmount = phpRound(minutes * perMin, 2);
  return {
    cuttingMinutes: minutes,
    perMinRate,
    cuttingAmount,
    cuttingLabel: `${minutes} x ${perMinRate} = ${cuttingAmount}`,
  };
}

/** date('h:i A') of a 'YYYY-MM-DD HH:MM[:SS]' text. */
function formatDrmTime(logDate: string | null | undefined): string | null {
  const m = String(logDate ?? "").match(/\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h24 = Number(m[1]);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${m[2]} ${h24 < 12 ? "AM" : "PM"}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First DRM login per (old user, day) for the given rows. Key: `${userId}|${date}`. */
async function loadDrmTimes(
  pairs: Array<{ legacyUserId: string | null; date: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const valid = pairs.filter((p) => p.legacyUserId && /^\d{4}-\d{2}-\d{2}$/.test(p.date));
  if (valid.length === 0) return out;
  const userIds = Array.from(new Set(valid.map((p) => p.legacyUserId!)));
  const dates = valid.map((p) => p.date).sort();
  const res = await pool.query(
    `SELECT DISTINCT ON (user_id, left(log_date, 10))
            user_id, left(log_date, 10) AS d, log_date
       FROM legacy_archive.webxl_log_history
      WHERE user_id = ANY($1::text[])
        AND log_date >= $2
        AND log_date < $3
      ORDER BY user_id, left(log_date, 10),
               CASE WHEN id ~ '^[0-9]+$' THEN id::numeric END, _archive_row_id`,
    [userIds, dates[0], addDaysIso(dates[dates.length - 1], 1)],
  );
  for (const r of res.rows) {
    const t = formatDrmTime(r.log_date);
    if (t) out.set(`${r.user_id}|${r.d}`, t);
  }
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function legacyViewRow(row: any, genderMode: boolean): OldAttendanceViewRow {
  const base = mapLegacyAttendanceRow(row);
  const late = row.late_absent == null ? "" : String(row.late_absent);
  const minutes = genderMode ? 0 : oldLateMinutes(late);
  return {
    ...base,
    id: String(row.id ?? row._legacy_pk),
    dateText: row.date == null ? "" : String(row.date),
    timeInText: row.timeIn == null ? "" : String(row.timeIn),
    timeOutText: row.timeOut == null ? "" : String(row.timeOut),
    lateAbsentLabel: late,
    source: "legacy",
    attendanceId: null,
    legacyUserId: row.user_id == null ? null : String(row.user_id),
    userId: row.modern_id ?? null,
    name: row.name ?? null,
    netSalary: row.net_salary ?? null,
    drmTime: null,
    ...cuttingFor(row.net_salary ?? null, minutes),
  };
}

// ---- In-app corrections of old rows (overlay) ------------------------------
// The old rows live read-only in legacy_archive.webxl_attendance. A correction
// saved from this page (PATCH /api/attendance/old-view/:userId/:date, or an
// approved "old_view" edit request) is written to the employee's drm.attendance
// row for that date, and its notes get the marker `old_view_edit=<ISO time> by
// <user id>` plus the old texts `late_absent=`, `time_in=`, `time_out=`
// (Excel-imported rows keep their JSON notes and get the same keys there:
// "old_view_edit", "lateAbsent", "timeInRaw", "timeOutRaw").
// Any drm.attendance row whose notes contain OLD_VIEW_EDIT_MARKER replaces the
// old row of that user/date in this view (cutting and totals recomputed).
export const OLD_VIEW_EDIT_MARKER = "old_view_edit";

export type DrmOldText = { timeIn: string; timeOut: string; lateAbsent: string; edited: boolean };

/** Old-page texts of a drm.attendance row (marker / import JSON / copied-row notes). */
export function drmRowOldText(r: {
  notes?: string | null;
  status?: string | null;
  late_minutes?: number | string | null;
  check_in_hm?: string | null;
  check_out_hm?: string | null;
}): DrmOldText {
  const raw = r.notes == null ? "" : String(r.notes);
  const edited = raw.includes(OLD_VIEW_EDIT_MARKER);
  let json: any = null;
  if (raw.trim().startsWith("{")) {
    try { json = JSON.parse(raw); } catch { json = null; }
  }
  if (json && typeof json === "object" && (json.importSource || json[OLD_VIEW_EDIT_MARKER])) {
    return {
      timeIn: String(json.timeInRaw ?? ""),
      timeOut: String(json.timeOutRaw ?? ""),
      lateAbsent: json.lateAbsent != null ? String(json.lateAbsent) : r.status === "Absent" ? "True" : "0:0",
      edited,
    };
  }
  const kv = (key: string) => {
    const m = raw.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`));
    return m ? m[1].trim() : null;
  };
  const lm = Number(r.late_minutes) || 0;
  const absent = r.status === "Absent";
  const late =
    kv("late_absent") ??
    (absent
      ? "True"
      : r.status === "Leave" || r.status === "HalfDay"
        ? String(r.status)
        : `${Math.floor(lm / 60)}:${lm % 60}`);
  // Copied old absent rows carry 00:00 timestamps where the old page showed nothing.
  const hm = (v: string | null | undefined) => (absent && v === "00:00" ? "" : (v ?? ""));
  return {
    timeIn: kv("time_in") ?? hm(r.check_in_hm),
    timeOut: kv("time_out") ?? hm(r.check_out_hm),
    lateAbsent: late,
    edited,
  };
}

type EditedDrmRow = { attendanceId: string; date: string; text: DrmOldText };

/** In-app corrected rows (marker in notes) per `${modernUserId}|${YYYY-MM-DD}`. */
async function loadEditedDrmRows(
  modernUserIds: string[],
  startDate: string | null,
  endDate: string | null,
): Promise<Map<string, EditedDrmRow>> {
  const out = new Map<string, EditedDrmRow>();
  const ids = modernUserIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (ids.length === 0) return out;
  const params: unknown[] = [ids];
  let where = "";
  if (startDate && endDate) {
    params.push(startDate, endDate);
    where = `AND a.date >= $2::date AND a.date < ($3::date + 1)`;
  }
  const res = await pool.query(
    `SELECT a.id::text AS id, a.user_id::text AS user_id, to_char(a.date, 'YYYY-MM-DD') AS d,
            a.status::text AS status, a.late_minutes, a.notes,
            to_char(a.check_in, 'HH24:MI') AS check_in_hm, to_char(a.check_out, 'HH24:MI') AS check_out_hm
       FROM drm.attendance a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.notes LIKE '%${OLD_VIEW_EDIT_MARKER}%'
        ${where}
      ORDER BY a.updated_at, a.id`,
    params,
  );
  for (const r of res.rows) {
    out.set(`${r.user_id}|${r.d}`, { attendanceId: r.id, date: r.d, text: drmRowOldText(r) });
  }
  return out;
}

function applyEditedRow(row: OldAttendanceViewRow, e: EditedDrmRow, genderMode: boolean) {
  const late = e.text.lateAbsent;
  const status = mapLateAbsentToStatus(late, e.text.timeIn || null);
  row.timeInText = e.text.timeIn;
  row.timeOutText = e.text.timeOut;
  row.lateAbsentLabel = late;
  row.timeIn = e.text.timeIn ? combineDateAndTime(row.dateText, e.text.timeIn) : null;
  row.timeOut = e.text.timeOut ? combineDateAndTime(row.dateText, e.text.timeOut) : null;
  row.status = status;
  row.isLate = status === "Late";
  row.lateMinutes = oldLateMinutes(late);
  row.attendanceId = e.attendanceId;
  row.edited = true;
  Object.assign(row, cuttingFor(row.netSalary, genderMode ? 0 : oldLateMinutes(late)));
}

/**
 * Old "Attendence System" view. `target` = modern user uuid, or 'Female' / 'Male'.
 * Dates are 'YYYY-MM-DD' (inclusive, compared as the old DRM text dates).
 */
export async function getOldAttendanceView(
  target: string,
  options: { startDate?: string | null; endDate?: string | null; page?: number; pageSize?: number },
): Promise<OldAttendanceViewResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const hasRange =
    !!options.startDate && !!options.endDate &&
    ISO_DATE.test(options.startDate) && ISO_DATE.test(options.endDate);
  const genderMode = target === "Female" || target === "Male";
  const empty = (source: "legacy" | "modern"): OldAttendanceViewResult => ({
    records: [], total: 0, page, pageSize, totalPages: 0, source,
    mode: genderMode ? "gender" : "user", totals: genderMode ? null : {
      totalLateMinutes: 0, totalLateLabel: formatMinutesToHoursMinutes(0), totalCuttingAmount: 0,
    },
  });

  if (genderMode) {
    const params: unknown[] = [target];
    let dateWhere = "";
    if (hasRange) {
      params.push(options.startDate, options.endDate);
      dateWhere = `AND a.date >= $2 AND a.date <= $3`;
    }
    const usersCte = `
      WITH us AS (
        SELECT w.user_id, w.name, w."netSalary" AS net_salary, m.modern_id,
               row_number() OVER (
                 ORDER BY CASE WHEN w.user_id ~ '^[0-9]+$' THEN w.user_id::numeric END, w.user_id
               ) AS uord
          FROM legacy_archive.webxl_user w
          LEFT JOIN migration_meta.migration_legacy_ids m
            ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = w.user_id
         WHERE lower(rtrim(w.gender)) = lower($1)
           AND w."roleId" IS NOT NULL
           AND COALESCE(substring(w."roleId" FROM '^\\s*([+-]?[0-9]+(?:\\.[0-9]+)?)')::numeric, 0) <> 54
      )`;
    const limIdx = params.length + 1;
    // One scan: the page plus the full row count (count(*) OVER ()).
    const res = await pool.query(
      `${usersCte}
       SELECT a._legacy_pk, a.id, a.user_id, a.date, a."timeIn", a."timeOut", a.late_absent,
              us.name, us.net_salary, us.modern_id, count(*) OVER ()::int AS full_count
         FROM legacy_archive.webxl_attendance a
         JOIN us ON us.user_id = a.user_id
        WHERE true ${dateWhere}
        ORDER BY us.uord, a.date DESC,
                 CASE WHEN a.id ~ '^[0-9]+$' THEN a.id::numeric END DESC, a._archive_row_id DESC
        LIMIT $${limIdx} OFFSET $${limIdx + 1}`,
      [...params, pageSize, offset],
    );
    let total = res.rows[0]?.full_count ?? 0;
    if (res.rows.length === 0 && offset > 0) {
      // Page past the end: still report the real total.
      const c = await pool.query(
        `${usersCte}
         SELECT count(*)::int AS c FROM legacy_archive.webxl_attendance a
           JOIN us ON us.user_id = a.user_id WHERE true ${dateWhere}`,
        params,
      );
      total = c.rows[0]?.c ?? 0;
    }
    if (total === 0) return empty("legacy");
    const records = res.rows.map((r: any) => legacyViewRow(r, true));
    if (records.length > 0) {
      const pageDates = records.map((r) => r.dateText).filter((d) => ISO_DATE.test(d)).sort();
      const edits = await loadEditedDrmRows(
        Array.from(new Set(records.map((r) => r.userId).filter((x): x is string => !!x))),
        pageDates[0] ?? null,
        pageDates[pageDates.length - 1] ?? null,
      );
      for (const r of records) {
        const e = edits.get(`${r.userId}|${r.dateText}`);
        if (e) applyEditedRow(r, e, true);
      }
    }
    const drm = await loadDrmTimes(records.map((r) => ({ legacyUserId: r.legacyUserId, date: r.dateText })));
    for (const r of records) r.drmTime = drm.get(`${r.legacyUserId}|${r.dateText}`) ?? null;
    return {
      records, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
      source: "legacy", mode: "gender", totals: null,
    };
  }

  // ---- single user -------------------------------------------------------
  const modernUserId = target;
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  if (legacyUserId) {
    const params: unknown[] = [legacyUserId];
    let dateWhere = "";
    if (hasRange) {
      params.push(options.startDate, options.endDate);
      dateWhere = `AND a.date >= $2 AND a.date <= $3`;
    }
    // Whole range in one scan (an employee has at most ~1 row a day): the footer
    // totals cover the whole range, the table shows one page of it.
    const allRes = await pool.query(
      `SELECT a._legacy_pk, a.id, a.user_id, a.date, a."timeIn", a."timeOut", a.late_absent
         FROM legacy_archive.webxl_attendance a
        WHERE a.user_id = $1 ${dateWhere}
        ORDER BY a.date DESC,
                 CASE WHEN a.id ~ '^[0-9]+$' THEN a.id::numeric END DESC, a._archive_row_id DESC`,
      params,
    );
    if (allRes.rows.length > 0) {
      const userRes = await pool.query(
        `SELECT name, "netSalary" AS net_salary FROM legacy_archive.webxl_user WHERE user_id = $1 LIMIT 1`,
        [legacyUserId],
      );
      const u = userRes.rows[0] ?? {};
      const net = u.net_salary ?? null;
      const allRecords: OldAttendanceViewRow[] = allRes.rows.map((r: any) =>
        legacyViewRow({ ...r, name: u.name ?? null, net_salary: net, modern_id: modernUserId }, false),
      );
      // Overlay in-app corrections; a corrected day without an old row is added.
      const edits = await loadEditedDrmRows(
        [modernUserId],
        hasRange ? options.startDate! : null,
        hasRange ? options.endDate! : null,
      );
      if (edits.size > 0) {
        const seen = new Set<string>();
        for (const r of allRecords) {
          const e = edits.get(`${modernUserId}|${r.dateText}`);
          if (e) applyEditedRow(r, e, false);
          seen.add(r.dateText);
        }
        for (const e of Array.from(edits.values())) {
          if (seen.has(e.date)) continue;
          const extra = legacyViewRow(
            { id: e.attendanceId, user_id: legacyUserId, date: e.date, timeIn: "", timeOut: "", late_absent: "",
              name: u.name ?? null, net_salary: net, modern_id: modernUserId },
            false,
          );
          extra.source = "modern";
          applyEditedRow(extra, e, false);
          allRecords.push(extra);
        }
        // Newest date first (stable: same-day old rows keep their id order).
        allRecords.sort((a, b) => (a.dateText < b.dateText ? 1 : a.dateText > b.dateText ? -1 : 0));
      }
      const total = allRecords.length;
      let totalLateMinutes = 0;
      let totalCuttingAmount = 0;
      for (const r of allRecords) {
        totalLateMinutes += r.cuttingMinutes;
        totalCuttingAmount += r.cuttingAmount;
      }
      const records = allRecords.slice(offset, offset + pageSize);
      const drm = await loadDrmTimes(records.map((r) => ({ legacyUserId, date: r.dateText })));
      for (const r of records) r.drmTime = drm.get(`${legacyUserId}|${r.dateText}`) ?? null;
      return {
        records, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
        source: "legacy", mode: "user",
        totals: {
          totalLateMinutes,
          totalLateLabel: formatMinutesToHoursMinutes(totalLateMinutes),
          totalCuttingAmount: phpRound(totalCuttingAmount, 2),
        },
      };
    }
  }

  // ---- new-app rows (drm.attendance) for a user/range without old rows ----
  const mParams: unknown[] = [modernUserId];
  let mWhere = "";
  if (hasRange) {
    mParams.push(options.startDate, options.endDate);
    mWhere = `AND a.date >= $2::date AND a.date < ($3::date + 1)`;
  } else {
    // Same default window the endpoint used before: the last 15 days.
    mWhere = `AND a.date >= (current_date - 15) AND a.date < (current_date + 1)`;
  }
  const mAll = await pool.query(
    `SELECT a.id::text AS id, to_char(a.date, 'YYYY-MM-DD') AS date_text, a.date,
            a.check_in, a.check_out, to_char(a.check_in, 'HH24:MI') AS check_in_hm,
            to_char(a.check_out, 'HH24:MI') AS check_out_hm,
            a.status::text AS status, a.is_late, a.late_minutes, a.notes
       FROM drm.attendance a
      WHERE a.user_id = $1 ${mWhere}
      ORDER BY a.date DESC, a.created_at DESC`,
    mParams,
  );
  if (mAll.rows.length === 0) return empty("modern");
  const uRes = await pool.query(
    `SELECT COALESCE(NULLIF(trim(w.name), ''), NULLIF(trim(u.full_name), ''), u.username) AS name,
            COALESCE(NULLIF(trim(w."netSalary"), ''), NULLIF(trim(u.basic_salary), '')) AS net_salary
       FROM drm.users u
       LEFT JOIN legacy_archive.webxl_user w ON w.user_id = $2
      WHERE u.id = $1`,
    [modernUserId, legacyUserId ?? ""],
  );
  const mu = uRes.rows[0] ?? {};
  const allRows: OldAttendanceViewRow[] = mAll.rows.map((r: any) => {
    // Old-page texts: in-app correction marker, Excel-import JSON, or the
    // "late_absent=" text of rows copied from the old DRM (see drmRowOldText).
    const text = drmRowOldText(r);
    const timeInText = text.timeIn;
    const timeOutText = text.timeOut;
    const late = text.lateAbsent;
    const minutes = oldLateMinutes(late);
    const status = mapLateAbsentToStatus(late, timeInText || null);
    return {
      id: r.id,
      date: r.date instanceof Date ? r.date : new Date(r.date),
      dateText: r.date_text,
      timeIn: r.check_in ?? null,
      timeOut: r.check_out ?? null,
      timeInText,
      timeOutText,
      status: r.status ?? status,
      isLate: !!r.is_late || minutes > 0,
      lateMinutes: minutes,
      lateAbsentLabel: late,
      source: "modern",
      attendanceId: r.id,
      legacyUserId,
      userId: modernUserId,
      name: mu.name ?? null,
      netSalary: mu.net_salary ?? null,
      drmTime: null,
      ...cuttingFor(mu.net_salary ?? null, minutes),
      edited: text.edited,
    };
  });
  let totalLateMinutes = 0;
  let totalCuttingAmount = 0;
  for (const r of allRows) {
    totalLateMinutes += r.cuttingMinutes;
    totalCuttingAmount += r.cuttingAmount;
  }
  const records = allRows.slice(offset, offset + pageSize);
  if (legacyUserId) {
    const drm = await loadDrmTimes(records.map((r) => ({ legacyUserId, date: r.dateText })));
    for (const r of records) r.drmTime = drm.get(`${legacyUserId}|${r.dateText}`) ?? null;
  }
  const total = allRows.length;
  return {
    records, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
    source: "modern", mode: "user",
    totals: {
      totalLateMinutes,
      totalLateLabel: formatMinutesToHoursMinutes(totalLateMinutes),
      totalCuttingAmount: phpRound(totalCuttingAmount, 2),
    },
  };
}

/**
 * Old func.php action 'get_user_salary': the users listed (comma separated old
 * user ids) in webxl_user.salary_distribution of the selected user.
 */
export async function getSalaryDistribution(modernUserId: string): Promise<{
  status: "success" | "error";
  message?: string;
  total_users: number;
  salary_users: Array<{ user_id: string; name: string | null; modern_id: string | null }>;
}> {
  const legacyUserId = await resolveLegacyUserId(modernUserId);
  if (!legacyUserId) {
    return { status: "error", message: "User not found", total_users: 0, salary_users: [] };
  }
  const uRes = await pool.query(
    `SELECT salary_distribution FROM legacy_archive.webxl_user WHERE user_id = $1 LIMIT 1`,
    [legacyUserId],
  );
  if (uRes.rows.length === 0) {
    return { status: "error", message: "User not found", total_users: 0, salary_users: [] };
  }
  const raw = uRes.rows[0].salary_distribution;
  // PHP empty(): null, "" and "0" count as empty.
  if (raw == null || raw === "" || raw === "0") {
    return {
      status: "error",
      message: "No salary distribution found for this user",
      total_users: 0,
      salary_users: [],
    };
  }
  const ids = String(raw).split(",").map((x) => x.trim());
  const res = await pool.query(
    `SELECT w.user_id, w.name, m.modern_id
       FROM legacy_archive.webxl_user w
       LEFT JOIN migration_meta.migration_legacy_ids m
         ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = w.user_id
      WHERE w.user_id = ANY($1::text[])
      ORDER BY CASE WHEN w.user_id ~ '^[0-9]+$' THEN w.user_id::numeric END, w.user_id`,
    [ids],
  );
  const salary_users = res.rows.map((r: any) => ({
    user_id: String(r.user_id),
    name: r.name ?? null,
    modern_id: r.modern_id ?? null,
  }));
  return { status: "success", total_users: salary_users.length, salary_users };
}

export const legacyAttendanceRepository = {
  resolveLegacyUserId,
  resolveDisplayName,
  getLegacyDailyRecords,
  getLegacyDailyRecordsPaginated,
  getLegacyMonthlySummaries,
  getLegacySalarySlips,
  getLegacySalarySlipsRecent,
  getOldAttendanceView,
  getSalaryDistribution,
};
