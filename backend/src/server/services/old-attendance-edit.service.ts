// Old DRM "Attendence System" pencil / modal save (func.php `cuttingUseridNoDaily`),
// reproduced on the new tables. The old handler, in one transaction:
//   1. UPDATE webxl_attendance SET timeIn, timeOut, late_absent for the edited row;
//   2. applied the same three values to every user in the employee's
//      webxl_user.salary_distribution (comma separated old ids) that has a row on
//      that date (UPDATE ... WHERE user_id AND date — never inserted);
//   3. for the employee and each of those users recalculated the month from the
//      daily rows:  leaves = count(late_absent = 'True'),
//      late minutes = sum(H*60+M) of late_absent matching ^[0-9]+:[0-9]+$,
//      lateHour = minutes div 60, lateMin = minutes mod 60, halfLeave = NULL,
//      and upserted webxl_attendance_month and webxl_attendance_month_history.
// Here the old rows are read-only (legacy_archive), so the corrected values go to
// the employee's drm.attendance row of that date (created when missing for the
// edited employee), tagged with the overlay marker (OLD_VIEW_EDIT_MARKER) that
// GET /api/attendance reads, and the month is recalculated into
// drm.attendance_month / drm.attendance_month_history from the effective daily
// rows (old rows with in-app corrections overlaid).
import type { PoolClient } from "pg";
import { drmRowOldText, OLD_VIEW_EDIT_MARKER } from "../repositories/legacy-attendance.repository";

export const OLD_VIEW_TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
export const OLD_VIEW_LATE_RE = /^(\d{1,3}):([0-5]?\d)$/;
const LOCK_STATUSES = ["FINALIZED", "APPROVED", "LOCKED"];

export class OldViewError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export type OldViewValues = { timeIn: string; timeOut: string; lateAbsent: string };

/** Validates the modal's three text fields (HH:MM or empty; late = H:M or True). */
export function validateOldViewValues(input: any): OldViewValues {
  const timeIn = String(input?.timeIn ?? "").trim();
  const timeOut = String(input?.timeOut ?? "").trim();
  let lateAbsent = String(input?.lateAbsent ?? "").trim();
  if (timeIn && !OLD_VIEW_TIME_RE.test(timeIn)) throw new OldViewError(400, "Time In must be HH:MM (e.g. 09:47) or empty");
  if (timeOut && !OLD_VIEW_TIME_RE.test(timeOut)) throw new OldViewError(400, "Time Out must be HH:MM (e.g. 18:14) or empty");
  if (lateAbsent.toLowerCase() === "true") lateAbsent = "True";
  if (lateAbsent !== "True" && !OLD_VIEW_LATE_RE.test(lateAbsent)) {
    throw new OldViewError(400, "Late / Absent must be H:M (e.g. 0:37) or True (absent)");
  }
  return { timeIn, timeOut, lateAbsent };
}

export function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
}

function lateMinutesOf(late: string): number {
  const m = late.match(/^(\d+):(\d+)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Notes with the old texts + marker (keeps other notes content). */
function markedNotes(existing: string | null, v: OldViewValues, actorUserId: string, at: string, branch?: string | null): string {
  const raw = existing ?? "";
  if (raw.trim().startsWith("{")) {
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === "object") {
        json.timeInRaw = v.timeIn;
        json.timeOutRaw = v.timeOut;
        json.lateAbsent = v.lateAbsent;
        json[OLD_VIEW_EDIT_MARKER] = `${at} by ${actorUserId}`;
        return JSON.stringify(json);
      }
    } catch { /* fall through to text notes */ }
  }
  const drop = new Set(["late_absent", "time_in", "time_out", OLD_VIEW_EDIT_MARKER]);
  const kept = raw
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x && !drop.has(x.split("=")[0].trim()));
  if (kept.length === 0 && branch) kept.push(`branch=${branch}`);
  kept.push(
    `late_absent=${v.lateAbsent}`,
    `time_in=${v.timeIn}`,
    `time_out=${v.timeOut}`,
    `${OLD_VIEW_EDIT_MARKER}=${at} by ${actorUserId}`,
  );
  return kept.join("; ");
}

async function legacyIdOf(client: PoolClient, modernUserId: string): Promise<string | null> {
  const r = await client.query(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids
      WHERE entity_type = 'user' AND legacy_table = 'webxl_user' AND modern_id = $1 LIMIT 1`,
    [modernUserId],
  );
  return r.rows[0]?.legacy_id ?? null;
}

async function isMonthLocked(client: PoolClient, userId: string, date: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM drm.salary_run_items ri JOIN drm.salary_runs r ON r.id = ri.run_id
      WHERE ri.user_id = $1
        AND r.period_month = EXTRACT(MONTH FROM $2::date)::int
        AND r.period_year = EXTRACT(YEAR FROM $2::date)::int
        AND r.status = ANY($3::text[])
      LIMIT 1`,
    [userId, date, LOCK_STATUSES],
  );
  return r.rows.length > 0;
}

type MonthValues = { late_hour: number; late_min: number; half_leave: number; leaves: number } | null;

/**
 * Month totals from the effective daily rows, like the old aggregate:
 * per date the in-app corrected drm row wins, else the old rows of that date;
 * months without any old rows use the drm.attendance rows (Excel imports).
 */
export async function computeOldMonth(
  client: PoolClient,
  modernUserId: string,
  legacyUserId: string | null,
  year: number,
  month: number,
): Promise<{ leaves: number; lateMinutes: number; branch: string | null }> {
  const mm = String(month).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const legacy = legacyUserId
    ? (await client.query(
        `SELECT date, late_absent, branch FROM legacy_archive.webxl_attendance
          WHERE user_id = $1 AND date LIKE $2`,
        [legacyUserId, `${year}-${mm}-%`],
      )).rows
    : [];
  const drm = (await client.query(
    `SELECT to_char(a.date, 'YYYY-MM-DD') AS d, a.status::text AS status, a.late_minutes, a.notes,
            to_char(a.check_in, 'HH24:MI') AS check_in_hm, to_char(a.check_out, 'HH24:MI') AS check_out_hm
       FROM drm.attendance a
      WHERE a.user_id = $1 AND a.date >= $2::date AND a.date < ($2::date + interval '1 month')`,
    [modernUserId, first],
  )).rows;

  const lates: string[] = [];
  const marked = new Map<string, string>();
  for (const r of drm) {
    const t = drmRowOldText(r);
    if (t.edited) marked.set(r.d, t.lateAbsent);
  }
  if (legacy.length > 0) {
    for (const r of legacy) {
      if (marked.has(String(r.date))) continue;
      lates.push(r.late_absent == null ? "" : String(r.late_absent));
    }
    lates.push(...Array.from(marked.values()));
  } else {
    for (const r of drm) lates.push(drmRowOldText(r).lateAbsent);
  }
  let leaves = 0;
  let lateMinutes = 0;
  for (const l of lates) {
    // MySQL: late_absent='True' (case-insensitive, trailing spaces ignored)
    if (l.replace(/ +$/, "").toLowerCase() === "true") leaves++;
    else if (/^[0-9]+:[0-9]+$/.test(l)) lateMinutes += lateMinutesOf(l);
  }
  const branch = legacy.find((r) => r.branch)?.branch ?? null;
  return { leaves, lateMinutes, branch };
}

async function upsertMonth(
  client: PoolClient,
  userId: string,
  year: number,
  month: number,
  totals: { leaves: number; lateMinutes: number; branch: string | null },
): Promise<{ before: MonthValues; historyBefore: MonthValues; after: MonthValues }> {
  const before = (await client.query(
    `SELECT late_hour, late_min, half_leave, leaves FROM drm.attendance_month
      WHERE user_id = $1 AND month = $2 AND year = $3 FOR UPDATE`,
    [userId, month, year],
  )).rows[0] ?? null;
  const historyBefore = (await client.query(
    `SELECT late_hour, late_min, half_leave, leaves FROM drm.attendance_month_history
      WHERE user_id = $1 AND month = $2 AND year = $3 FOR UPDATE`,
    [userId, month, year],
  )).rows[0] ?? null;
  const lateHour = Math.floor(totals.lateMinutes / 60);
  const lateMin = totals.lateMinutes % 60;
  const branch =
    totals.branch ??
    (await client.query(`SELECT branch FROM drm.users WHERE id = $1`, [userId])).rows[0]?.branch ??
    null;
  // Old: halfLeave = NULL on every recalculation (column is NOT NULL here -> 0).
  await client.query(
    `INSERT INTO drm.attendance_month (user_id, late_hour, late_min, half_leave, leaves, branch, month, year)
     VALUES ($1, $2, $3, 0, $4, $5, $6, $7)
     ON CONFLICT (user_id, month, year) DO UPDATE
       SET late_hour = EXCLUDED.late_hour, late_min = EXCLUDED.late_min,
           half_leave = 0, leaves = EXCLUDED.leaves, updated_at = now()`,
    [userId, lateHour, lateMin, totals.leaves, branch, month, year],
  );
  await client.query(
    `INSERT INTO drm.attendance_month_history (user_id, late_hour, late_min, half_leave, leaves, month, year)
     VALUES ($1, $2, $3, 0, $4, $5, $6)
     ON CONFLICT (user_id, month, year) DO UPDATE
       SET late_hour = EXCLUDED.late_hour, late_min = EXCLUDED.late_min,
           half_leave = 0, leaves = EXCLUDED.leaves, updated_at = now()`,
    [userId, lateHour, lateMin, totals.leaves, month, year],
  );
  return {
    before,
    historyBefore,
    after: { late_hour: lateHour, late_min: lateMin, half_leave: 0, leaves: totals.leaves },
  };
}

export type OldViewSaveResult = {
  userId: string;
  legacyUserId: string | null;
  attendanceIds: string[];
  created: boolean;
  before: Array<Record<string, unknown>>;
  after: OldViewValues;
  month: { year: number; month: number; before: MonthValues; historyBefore: MonthValues; after: MonthValues };
};

/** Save one day like the old modal. Must run inside the caller's transaction. */
export async function saveOldViewAttendance(
  client: PoolClient,
  params: {
    modernUserId: string;
    date: string;
    values: OldViewValues;
    actorUserId: string;
    /** true = salary-locked months may be changed (admin override). */
    allowLocked: boolean;
  },
): Promise<OldViewSaveResult[]> {
  const { modernUserId, date, values, actorUserId } = params;
  if (!isIsoDate(date)) throw new OldViewError(400, "Invalid date (YYYY-MM-DD)");
  const exists = await client.query(`SELECT 1 FROM drm.users WHERE id = $1`, [modernUserId]);
  if (exists.rows.length === 0) throw new OldViewError(404, "Employee not found");
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const at = new Date().toISOString();

  // Employee + salary_distribution users (old ids -> new users).
  const mainLegacy = await legacyIdOf(client, modernUserId);
  const targets: Array<{ userId: string; legacyUserId: string | null; main: boolean }> = [
    { userId: modernUserId, legacyUserId: mainLegacy, main: true },
  ];
  if (mainLegacy) {
    const sd = await client.query(
      `SELECT salary_distribution FROM legacy_archive.webxl_user WHERE user_id = $1 LIMIT 1`,
      [mainLegacy],
    );
    const raw = sd.rows[0]?.salary_distribution;
    if (raw != null && raw !== "" && raw !== "0") {
      const ids = String(raw).split(",").map((x) => x.trim()).filter((x) => x && x !== mainLegacy);
      if (ids.length) {
        const m = await client.query(
          `SELECT legacy_id, modern_id FROM migration_meta.migration_legacy_ids
            WHERE entity_type = 'user' AND legacy_table = 'webxl_user' AND legacy_id = ANY($1::text[])`,
          [Array.from(new Set(ids))],
        );
        for (const r of m.rows) {
          if (r.modern_id !== modernUserId && !targets.some((t) => t.userId === r.modern_id)) {
            targets.push({ userId: r.modern_id, legacyUserId: r.legacy_id, main: false });
          }
        }
      }
    }
  }

  const results: OldViewSaveResult[] = [];
  for (const t of targets) {
    const rows = (await client.query(
      `SELECT id::text AS id, check_in, check_out, status::text AS status, is_late, late_checkin,
              late_minutes, notes, updated_at
         FROM drm.attendance
        WHERE user_id = $1 AND date::date = $2::date
        ORDER BY created_at, id
        FOR UPDATE`,
      [t.userId, date],
    )).rows;
    const legacyDay = t.legacyUserId
      ? (await client.query(
          `SELECT branch FROM legacy_archive.webxl_attendance WHERE user_id = $1 AND date = $2 LIMIT 1`,
          [t.legacyUserId, date],
        )).rows
      : [];
    // Old: distribution users are only updated when they have a row that day.
    if (!t.main && rows.length === 0 && legacyDay.length === 0) continue;
    if (!params.allowLocked && (await isMonthLocked(client, t.userId, date))) {
      throw new OldViewError(
        423,
        "The salary for that month is finalized/locked. An admin override reason is required to apply this change.",
        { salaryLocked: true, requiresOverride: true },
      );
    }

    const minutes = values.lateAbsent === "True" ? 0 : lateMinutesOf(values.lateAbsent);
    const status = values.lateAbsent === "True" ? "Absent" : minutes > 0 ? "Late" : "Present";
    const checkIn = values.timeIn ? `${date} ${values.timeIn.padStart(5, "0")}:00` : null;
    const checkOut = values.timeOut ? `${date} ${values.timeOut.padStart(5, "0")}:00` : null;
    const ids: string[] = [];
    let created = false;
    if (rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO drm.attendance
           (user_id, date, check_in, check_out, status, late_checkin, late_checkout, is_late, late_minutes, notes)
         VALUES ($1, $2::date::timestamp, $3::timestamp, $4::timestamp, $5::drm.attendance_status,
                 $6, false, $6, $7, $8)
         RETURNING id::text AS id`,
        [t.userId, date, checkIn, checkOut, status, minutes > 0, minutes,
         markedNotes(null, values, actorUserId, at, legacyDay[0]?.branch ?? null)],
      );
      ids.push(ins.rows[0].id);
      created = true;
    } else {
      for (const r of rows) {
        await client.query(
          `UPDATE drm.attendance
              SET check_in = $2::timestamp, check_out = $3::timestamp, status = $4::drm.attendance_status,
                  is_late = $5, late_checkin = $5, late_minutes = $6, notes = $7, updated_at = now()
            WHERE id = $1`,
          [r.id, checkIn, checkOut, status, minutes > 0, minutes, markedNotes(r.notes, values, actorUserId, at)],
        );
        ids.push(r.id);
      }
    }

    const totals = await computeOldMonth(client, t.userId, t.legacyUserId, year, month);
    const m = await upsertMonth(client, t.userId, year, month, totals);
    results.push({
      userId: t.userId,
      legacyUserId: t.legacyUserId,
      attendanceIds: ids,
      created,
      before: rows.map((r: any) => ({
        id: r.id, check_in: r.check_in, check_out: r.check_out, status: r.status,
        is_late: r.is_late, late_checkin: r.late_checkin, late_minutes: r.late_minutes, notes: r.notes,
      })),
      after: values,
      month: { year, month, ...m },
    });
  }
  return results;
}
