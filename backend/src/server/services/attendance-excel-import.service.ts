import * as XLSX from "xlsx";
import { pool } from "../db";
import { attendanceRepository } from "../repositories/attendance.repository";

export type AttendanceImportPreviewRow = {
  attId: string;
  name: string;
  timeIn: string;
  timeOut: string;
  lateDuration: string;
  meeting: string;
  date: string;
  status: "imported" | "skipped" | "absent" | "error";
  message?: string;
};

const DEFAULT_SHIFT_IN = "09:00";
const DEFAULT_SHIFT_OUT = "18:00";

let schemaEnsured = false;

export async function ensureAttendanceImportSchema(): Promise<void> {
  if (schemaEnsured) return;
  await pool.query(`
    create table if not exists drm.attendance_month (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references drm.users(id) on delete cascade,
      late_hour integer not null default 0,
      late_min integer not null default 0,
      leaves integer not null default 0,
      branch text,
      month integer not null,
      year integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, month, year)
    );
    create table if not exists drm.attendance_month_history (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references drm.users(id) on delete cascade,
      late_hour integer not null default 0,
      late_min integer not null default 0,
      leaves integer not null default 0,
      month integer not null,
      year integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, month, year)
    );
    alter table drm.users add column if not exists salary_distribution text;
    alter table drm.users add column if not exists shift_time_in text;
    alter table drm.users add column if not exists shift_time_out text;
  `);
  schemaEnsured = true;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function excelCellToDateString(val: unknown): string {
  if (val == null || val === "") return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  if (typeof val === "number" && XLSX.SSF?.parse_date_code) {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  const parsed = new Date(String(val));
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  const m = String(val).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  const ts = Date.parse(String(val));
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return "";
}

function excelCellToTimeString(val: unknown): string {
  if (val == null || val === "") return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${pad2(val.getHours())}:${pad2(val.getMinutes())}`;
  }
  if (typeof val === "number" && val < 1 && val >= 0) {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${pad2(Number(m[1]))}:${m[2]}`;
  return s;
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function diffMinutes(from: string, to: string): { h: number; i: number } {
  const a = parseTimeToMinutes(from);
  const b = parseTimeToMinutes(to);
  if (a == null || b == null) return { h: 0, i: 0 };
  const diff = Math.max(0, b - a);
  return { h: Math.floor(diff / 60), i: diff % 60 };
}

function dateAtKarachi(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const t = excelCellToTimeString(timeStr);
  if (!t) return null;
  return new Date(`${dateStr}T${t}:00+05:00`);
}

function dateOnlyKarachi(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:00`);
}

async function getUserByAttendanceMachineId(attId: string) {
  const { rows } = await pool.query(
    `SELECT id::text AS id, coalesce(full_name, name, email) AS name, branch,
            coalesce(nullif(trim(shift_time_in), ''), $2) AS "shiftIn",
            coalesce(nullif(trim(shift_time_out), ''), $3) AS "shiftOut",
            salary_distribution AS "salaryDistribution"
       FROM drm.users
      WHERE trim(coalesce(attendance_id, '')) = trim($1)
      LIMIT 1`,
    [String(attId), DEFAULT_SHIFT_IN, DEFAULT_SHIFT_OUT],
  );
  return rows[0] as
    | {
        id: string;
        name: string;
        branch: string | null;
        shiftIn: string;
        shiftOut: string;
        salaryDistribution: string | null;
      }
    | undefined;
}

async function attendanceExists(userId: string, dateStr: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM drm.attendance WHERE user_id = $1 AND date::date = $2::date LIMIT 1`,
    [userId, dateStr],
  );
  return !!rows[0];
}

async function linkedSalaryDistributionUserIds(raw: string | null | undefined): Promise<string[]> {
  if (!raw?.trim()) return [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id::text AS id FROM drm.users
      WHERE id::text = ANY($1::text[])
         OR trim(coalesce(attendance_id, '')) = ANY($1::text[])`,
    [parts],
  );
  return rows.map((r) => r.id).filter((id) => id);
}

async function upsertMonthlyLate(params: {
  userIds: string[];
  branch: string | null;
  month: number;
  year: number;
  lateH: number;
  lateI: number;
}): Promise<void> {
  for (const userId of params.userIds) {
    const existing = await pool.query(
      `SELECT late_hour, late_min FROM drm.attendance_month
        WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, params.month, params.year],
    );
    if (existing.rows[0]) {
      const newHour = Number(existing.rows[0].late_hour) + params.lateH;
      const newMin = Number(existing.rows[0].late_min) + params.lateI;
      await pool.query(
        `UPDATE drm.attendance_month SET late_hour = $1, late_min = $2, branch = coalesce($3, branch), updated_at = now()
          WHERE user_id = $4 AND month = $5 AND year = $6`,
        [newHour, newMin, params.branch, userId, params.month, params.year],
      );
      await pool.query(
        `UPDATE drm.attendance_month_history SET late_hour = $1, late_min = $2, updated_at = now()
          WHERE user_id = $3 AND month = $4 AND year = $5`,
        [newHour, newMin, userId, params.month, params.year],
      );
    } else {
      await pool.query(
        `INSERT INTO drm.attendance_month (user_id, late_hour, late_min, branch, month, year)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, params.lateH, params.lateI, params.branch, params.month, params.year],
      );
      await pool.query(
        `INSERT INTO drm.attendance_month_history (user_id, late_hour, late_min, month, year)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, params.lateH, params.lateI, params.month, params.year],
      );
    }
  }
}

async function upsertMonthlyLeave(params: {
  userIds: string[];
  branch: string | null;
  month: number;
  year: number;
  day: number;
}): Promise<void> {
  for (const userId of params.userIds) {
    const existing = await pool.query(
      `SELECT leaves FROM drm.attendance_month WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, params.month, params.year],
    );
    const incrementLeave = params.day === 5 || params.day === 8 ? 0 : 1;
    if (existing.rows[0]) {
      const newLeaves = Number(existing.rows[0].leaves) + incrementLeave;
      await pool.query(
        `UPDATE drm.attendance_month SET leaves = $1, branch = coalesce($2, branch), updated_at = now()
          WHERE user_id = $3 AND month = $4 AND year = $5`,
        [newLeaves, params.branch, userId, params.month, params.year],
      );
      await pool.query(
        `UPDATE drm.attendance_month_history SET leaves = $1, updated_at = now()
          WHERE user_id = $2 AND month = $3 AND year = $4`,
        [newLeaves, userId, params.month, params.year],
      );
    } else {
      await pool.query(
        `INSERT INTO drm.attendance_month (user_id, leaves, branch, month, year)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, incrementLeave || 0, params.branch, params.month, params.year],
      );
      await pool.query(
        `INSERT INTO drm.attendance_month_history (user_id, leaves, month, year)
         VALUES ($1, $2, $3, $4)`,
        [userId, incrementLeave || 0, params.month, params.year],
      );
    }
  }
}

async function insertDailyAttendance(params: {
  userId: string;
  dateStr: string;
  timeIn: string;
  timeOut: string;
  lateLabel: string;
  meeting: string;
  absent: boolean;
}): Promise<void> {
  const checkIn = params.absent ? null : dateAtKarachi(params.dateStr, params.timeIn);
  const checkOut = params.absent ? null : dateAtKarachi(params.dateStr, params.timeOut);
  const notes = JSON.stringify({
    importSource: "attentiondoc_excel",
    lateAbsent: params.absent ? "True" : params.lateLabel,
    meeting: params.meeting,
    timeInRaw: params.timeIn,
    timeOutRaw: params.timeOut,
  });
  await attendanceRepository.create({
    userId: params.userId,
    date: dateOnlyKarachi(params.dateStr),
    timeIn: checkIn,
    timeOut: checkOut,
    status: params.absent ? "Absent" : "Present",
    notes,
  });
}

export async function getAttendanceLastImportDate(): Promise<string | null> {
  await ensureAttendanceImportSchema();
  const { rows } = await pool.query(
    `SELECT to_char(max(date)::date, 'YYYY-MM-DD') AS last FROM drm.attendance`,
  );
  return rows[0]?.last || null;
}

export async function processAttendanceExcelBuffer(buffer: Buffer): Promise<{
  rows: AttendanceImportPreviewRow[];
  imported: number;
  skipped: number;
  errors: number;
  lastDate: string | null;
}> {
  await ensureAttendanceImportSchema();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error("Excel file has no worksheets");
  }

  const preview: AttendanceImportPreviewRow[] = [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let row = 2; row <= range.e.r + 1; row++) {
    const rawAttId = String(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })]?.v ?? "").trim();
    if (!rawAttId) continue;

    const nameCell = String(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 1 })]?.v ?? "").trim();
    const dateStr = excelCellToDateString(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 2 })]?.v);
    let timeIn = excelCellToTimeString(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 3 })]?.v);
    let timeOut = excelCellToTimeString(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 4 })]?.v);
    const absentRaw = String(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 7 })]?.v ?? "").trim();
    const multies = String(sheet[XLSX.utils.encode_cell({ r: row - 1, c: 11 })]?.v ?? "").trim();
    const multiesParts = multies.split(/\s+/).filter(Boolean);
    const firstMulti = multiesParts[0] || "";
    const lastMulti = multiesParts[multiesParts.length - 1] || "";

    if (!dateStr) {
      errors++;
      preview.push({
        attId: rawAttId,
        name: nameCell,
        timeIn,
        timeOut,
        lateDuration: "",
        meeting: "no",
        date: "",
        status: "error",
        message: "Invalid date",
      });
      continue;
    }

    const user = await getUserByAttendanceMachineId(rawAttId);
    if (!user) {
      errors++;
      preview.push({
        attId: rawAttId,
        name: nameCell,
        timeIn,
        timeOut,
        lateDuration: "",
        meeting: "no",
        date: dateStr,
        status: "error",
        message: "No user for attendance ID",
      });
      continue;
    }

    const month = Number(dateStr.slice(5, 7));
    const year = Number(dateStr.slice(0, 4));
    const day = Number(dateStr.slice(8, 10));

    if (await attendanceExists(user.id, dateStr)) {
      skipped++;
      preview.push({
        attId: rawAttId,
        name: user.name,
        timeIn,
        timeOut,
        lateDuration: "-",
        meeting: "no",
        date: dateStr,
        status: "skipped",
        message: "Already recorded",
      });
      continue;
    }

    const linkedIds = await linkedSalaryDistributionUserIds(user.salaryDistribution);
    const affectedUserIds = [user.id, ...linkedIds.filter((id) => id !== user.id)];

    const isAbsent = absentRaw === "True" || absentRaw === "true" || absentRaw === "1";

    if (isAbsent) {
      for (const uid of affectedUserIds) {
        await insertDailyAttendance({
          userId: uid,
          dateStr,
          timeIn: "",
          timeOut: "",
          lateLabel: "True",
          meeting: "no",
          absent: true,
        });
      }
      await upsertMonthlyLeave({
        userIds: affectedUserIds,
        branch: user.branch,
        month,
        year,
        day,
      });
      imported++;
      preview.push({
        attId: rawAttId,
        name: user.name,
        timeIn: "",
        timeOut: "",
        lateDuration: "Absent",
        meeting: "no",
        date: dateStr,
        status: "absent",
      });
      continue;
    }

    const userTimeIn = user.shiftIn;
    const userTimeOut = user.shiftOut;

    const tIn = parseTimeToMinutes(timeIn);
    const tOut = parseTimeToMinutes(timeOut);
    const uIn = parseTimeToMinutes(userTimeIn);
    const uOut = parseTimeToMinutes(userTimeOut);

    let sinceStart = { h: 0, i: 0 };
    let sinceEnd = { h: 0, i: 0 };
    if (tIn != null && uIn != null) {
      sinceStart = tIn > uIn ? diffMinutes(userTimeIn, timeIn) : { h: 0, i: 0 };
    }
    if (tOut != null && uOut != null) {
      sinceEnd = tOut < uOut ? diffMinutes(timeOut, userTimeOut) : { h: 0, i: 0 };
    }

    let lateH = sinceStart.h + sinceEnd.h;
    let lateI = sinceStart.i + sinceEnd.i;
    let meeting = "no";

    if (!timeOut && timeIn) {
      if (multiesParts.length > 1) {
        if (parseTimeToMinutes(lastMulti) != null && parseTimeToMinutes(userTimeOut) != null && parseTimeToMinutes(lastMulti)! < parseTimeToMinutes(userTimeOut)!) {
          sinceEnd = diffMinutes(lastMulti, userTimeOut);
        } else {
          sinceEnd = { h: 0, i: 0 };
        }
        lateH = sinceStart.h + sinceEnd.h;
        lateI = sinceStart.i + sinceEnd.i;
        timeOut = lastMulti;
      } else {
        lateH = 8;
        lateI = 0;
      }
    }

    if (timeOut && !timeIn) {
      if (multiesParts.length > 1) {
        if (parseTimeToMinutes(firstMulti) != null && parseTimeToMinutes(userTimeIn) != null && parseTimeToMinutes(firstMulti)! > parseTimeToMinutes(userTimeIn)!) {
          sinceStart = diffMinutes(userTimeIn, firstMulti);
        } else {
          sinceStart = { h: 0, i: 0 };
        }
        lateH = sinceStart.h;
        lateI = sinceStart.i;
        timeIn = firstMulti;
      } else {
        lateH = 8;
        lateI = 0;
      }
    }

    const lateLabel = `${lateH}:${lateI}`;

    for (const uid of affectedUserIds) {
      await insertDailyAttendance({
        userId: uid,
        dateStr,
        timeIn,
        timeOut,
        lateLabel,
        meeting,
        absent: false,
      });
    }

    await upsertMonthlyLate({
      userIds: affectedUserIds,
      branch: user.branch,
      month,
      year,
      lateH,
      lateI,
    });

    imported++;
    preview.push({
      attId: rawAttId,
      name: user.name,
      timeIn,
      timeOut,
      lateDuration: lateLabel,
      meeting,
      date: dateStr,
      status: "imported",
    });
  }

  const lastDate = await getAttendanceLastImportDate();
  return { rows: preview, imported, skipped, errors, lastDate };
}
