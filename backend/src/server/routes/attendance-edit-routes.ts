import type { Express, Request, Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { isManagerialRole, normalizeRole } from "../utils/role-utils";
import { requireReportPermission } from "../middleware/report-permission";
import { requireActionPermission } from "../middleware/action-permission";
import { recordAuditLog } from "../services/activity-service";
import { attendanceRepository } from "../repositories/attendance.repository";

const ALLOWED_FIELDS = new Set(["status", "check_in", "check_out", "notes", "working_hours"]);
const VALID_STATUSES = ["Present", "Absent", "Late", "HalfDay", "Leave"];
// Salary-run states that "freeze" a month: once payroll is computed/approved/locked,
// retroactive attendance edits for that employee/month must not silently change pay.
const LOCK_STATUSES = ["FINALIZED", "APPROVED", "LOCKED"];

interface HttpError extends Error {
  status: number;
}
function httpError(status: number, message: string): HttpError {
  const e = new Error(message) as HttpError;
  e.status = status;
  return e;
}

function callerRole(req: Request): string {
  const u = req.user as any;
  return String(u?.activeRoleId ?? u?.roleId ?? u?.role ?? "");
}
function isAdmin(req: Request): boolean {
  return normalizeRole(callerRole(req)) === "admin";
}

function parseTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) throw httpError(400, "Invalid timestamp value for check_in/check_out");
  return d;
}

/**
 * A month is locked for an employee when they are a line item on a salary run
 * (period month/year) whose status is FINALIZED/APPROVED/LOCKED. salary_run_items
 * membership is the authoritative "this employee's month was paid out" signal
 * (runs are only optionally branch/department scoped). Month/year are extracted
 * from the timestamp in-DB to avoid TZ drift.
 */
async function isMonthLocked(
  client: PoolClient,
  userId: string,
  attendanceDate: Date | string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1
       FROM drm.salary_run_items ri
       JOIN drm.salary_runs r ON r.id = ri.run_id
      WHERE ri.user_id = $1
        AND r.period_month = EXTRACT(MONTH FROM $2::timestamp)::int
        AND r.period_year = EXTRACT(YEAR FROM $2::timestamp)::int
        AND r.status = ANY($3::text[])
      LIMIT 1`,
    [userId, attendanceDate, LOCK_STATUSES],
  );
  return res.rows.length > 0;
}

/**
 * Applies a single field edit to the underlying drm.attendance row inside the
 * caller's transaction. NEVER creates an attendance row (the summaries treat a
 * missing row as Absent, so fabricating rows would corrupt salary/absence math).
 * Returns the located attendance id plus the before/after values for auditing.
 */
async function applyEditToAttendance(
  client: PoolClient,
  edit: { attendance_id: string | null; user_id: string; attendance_date: Date | string; field: string; after_value: unknown },
): Promise<{ attendanceId: string; before: unknown; after: unknown }> {
  const field = String(edit.field);
  if (!ALLOWED_FIELDS.has(field)) throw httpError(400, `Unsupported field "${field}"`);

  // Locate the row: by linked attendance_id when present, else by employee+date.
  let row: any;
  if (edit.attendance_id) {
    const r = await client.query(
      `SELECT id, user_id, date, check_in, check_out, status, working_hours, notes
         FROM drm.attendance WHERE id = $1 FOR UPDATE`,
      [edit.attendance_id],
    );
    if (r.rows.length === 0) throw httpError(409, "Linked attendance record no longer exists");
    row = r.rows[0];
    // Bind the located row to the request's employee AND date. Defense-in-depth
    // against a crafted/legacy request whose attendance_id points at a DIFFERENT
    // employee, or at a different (possibly salary-locked) month, than the one the
    // salary-lock check was evaluated against (isMonthLocked uses edit.user_id +
    // edit.attendance_date). The comparison is done in SQL (date::date) to be
    // timezone-safe.
    const bind = await client.query(
      `SELECT 1 FROM drm.attendance
        WHERE id = $1 AND user_id = $2 AND date::date = $3::date`,
      [edit.attendance_id, edit.user_id, edit.attendance_date],
    );
    if (bind.rows.length === 0) {
      throw httpError(409, "Linked attendance record no longer matches the request's employee/date");
    }
  } else {
    const r = await client.query(
      `SELECT id, user_id, date, check_in, check_out, status, working_hours, notes
         FROM drm.attendance
        WHERE user_id = $1 AND date::date = $2::date
        ORDER BY date DESC
        LIMIT 2 FOR UPDATE`,
      [edit.user_id, edit.attendance_date],
    );
    if (r.rows.length === 0) {
      throw httpError(409, "No attendance record exists for this employee on that date to apply the change to");
    }
    if (r.rows.length > 1) {
      throw httpError(409, "Multiple attendance records match this employee/date; resolve manually");
    }
    row = r.rows[0];
  }

  if (field === "status") {
    const after = String(edit.after_value ?? "");
    if (!VALID_STATUSES.includes(after)) {
      throw httpError(400, `status must be one of ${VALID_STATUSES.join(", ")}`);
    }
    const before = row.status;
    await client.query(`UPDATE drm.attendance SET status = $1, updated_at = now() WHERE id = $2`, [after, row.id]);
    return { attendanceId: row.id, before, after };
  }

  if (field === "check_in" || field === "check_out") {
    const after = parseTimestamp(edit.after_value);
    const newCheckIn = field === "check_in" ? after : row.check_in;
    const newCheckOut = field === "check_out" ? after : row.check_out;
    const flags = attendanceRepository.recomputeLateFlags(newCheckIn, newCheckOut);
    const before = row[field];
    // `field` is constrained to two literals above, so interpolating it is safe.
    await client.query(
      `UPDATE drm.attendance
          SET ${field} = $1, late_checkin = $2, late_checkout = $3, is_late = $4, updated_at = now()
        WHERE id = $5`,
      [after, flags.lateCheckin, flags.lateCheckout, flags.isLate, row.id],
    );
    return { attendanceId: row.id, before, after };
  }

  if (field === "working_hours") {
    const num = Number(edit.after_value);
    if (edit.after_value === null || edit.after_value === undefined || String(edit.after_value).trim() === "" || !isFinite(num) || num < 0) {
      throw httpError(400, "working_hours must be a non-negative number");
    }
    const before = row.working_hours;
    await client.query(`UPDATE drm.attendance SET working_hours = $1, updated_at = now() WHERE id = $2`, [num, row.id]);
    return { attendanceId: row.id, before, after: num };
  }

  // notes
  const after = edit.after_value === undefined ? null : (edit.after_value as string | null);
  const before = row.notes;
  await client.query(`UPDATE drm.attendance SET notes = $1, updated_at = now() WHERE id = $2`, [after, row.id]);
  return { attendanceId: row.id, before, after };
}

// ---------------------------------------------------------------------------
// Handlers (registered under both /api/attendance/edits and the spec alias
// /api/attendance/edit-requests).
// ---------------------------------------------------------------------------

async function listEdits(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const managerial = isManagerialRole(req.user.roleId);
    const where: string[] = [];
    const params: any[] = [];

    if (!managerial) {
      params.push(req.user.userId);
      where.push(`e.requested_by_user_id = $${params.length}`);
    } else if (req.query.userId) {
      params.push(String(req.query.userId));
      where.push(`e.user_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(String(req.query.status));
      where.push(`e.status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT e.*,
              emp.full_name AS employee_name,
              req.full_name AS requested_by_name,
              rev.full_name AS reviewed_by_name
       FROM drm.attendance_edit_requests e
       LEFT JOIN drm.users emp ON emp.id = e.user_id
       LEFT JOIN drm.users req ON req.id = e.requested_by_user_id
       LEFT JOIN drm.users rev ON rev.id = e.reviewed_by_user_id
       ${clause}
       ORDER BY e.created_at DESC`,
      params,
    );
    res.json({ edits: result.rows });
  } catch (err) {
    console.error("Error listing attendance edits:", err);
    res.status(500).json({ error: "Failed to list attendance edit requests" });
  }
}

async function createEdit(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const { attendanceId, userId, attendanceDate, field, beforeValue, afterValue, reason } = req.body || {};

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!attendanceDate || isNaN(new Date(attendanceDate).getTime())) {
      return res.status(400).json({ error: "A valid attendanceDate is required" });
    }
    if (!field || !ALLOWED_FIELDS.has(String(field))) {
      return res.status(400).json({ error: `field must be one of ${Array.from(ALLOWED_FIELDS).join(", ")}` });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "A reason is required" });
    }
    if (String(field) === "status" && afterValue != null && !VALID_STATUSES.includes(String(afterValue))) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    // Resolve the target employee + date. When an attendanceId is supplied the
    // request MUST be bound to that row's REAL employee/date — never the
    // client-supplied values — so a crafted request cannot display one employee
    // while pointing at a different (possibly salary-locked) employee's row.
    let targetUserId = String(userId);
    let targetDate = new Date(attendanceDate);
    if (attendanceId) {
      const att = await pool.query(
        `SELECT id, user_id, date FROM drm.attendance WHERE id = $1`,
        [attendanceId],
      );
      if (att.rows.length === 0) {
        return res.status(400).json({ error: "attendanceId does not reference an existing attendance record" });
      }
      targetUserId = String(att.rows[0].user_id);
      targetDate = new Date(att.rows[0].date);
    }

    // Authorization: non-managerial callers may only request edits to their OWN
    // attendance. Managerial roles may request on behalf of employees.
    const managerial = isManagerialRole(req.user.roleId);
    if (!managerial && targetUserId !== String(req.user.userId)) {
      return res.status(403).json({ error: "You can only request edits to your own attendance." });
    }

    const result = await pool.query(
      `INSERT INTO drm.attendance_edit_requests
         (attendance_id, user_id, attendance_date, field, before_value, after_value, reason, status, requested_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8)
       RETURNING *`,
      [
        attendanceId || null,
        targetUserId,
        targetDate,
        String(field),
        beforeValue ?? null,
        afterValue ?? null,
        String(reason).trim(),
        req.user.userId,
      ],
    );
    const edit = result.rows[0];

    await recordAuditLog({
      actorUserId: req.user.userId,
      action: "attendance.edit_request.create",
      module: "attendance",
      entityType: "AttendanceEditRequest",
      entityId: edit.id,
      nextStatus: "Pending",
      after: { field: edit.field, beforeValue: edit.before_value, afterValue: edit.after_value, userId: edit.user_id },
      reason: edit.reason,
      req,
    });

    res.status(201).json({ edit });
  } catch (err) {
    console.error("Error creating attendance edit:", err);
    res.status(500).json({ error: "Failed to create attendance edit request" });
  }
}

async function approveEdit(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT * FROM drm.attendance_edit_requests WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Edit request not found" });
    }
    const edit = existing.rows[0];
    if (edit.status !== "Pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Request already ${edit.status}` });
    }

    // Validate the status enum app-side BEFORE the UPDATE (the column is a real
    // pg enum; an invalid value would otherwise throw a raw 22P02).
    if (String(edit.field) === "status" && !VALID_STATUSES.includes(String(edit.after_value ?? ""))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    // Salary-lock guard: block if the employee's month is finalized/approved/locked,
    // unless an admin supplies an explicit override reason.
    const locked = await isMonthLocked(client, edit.user_id, edit.attendance_date);
    let overrideReason: string | null = null;
    if (locked) {
      overrideReason = String(req.body?.overrideReason || "").trim() || null;
      if (!isAdmin(req) || !overrideReason) {
        await client.query("ROLLBACK");
        return res.status(423).json({
          error: "This employee's salary for that month is finalized/locked. An admin override reason is required to apply this change.",
          salaryLocked: true,
          requiresOverride: true,
        });
      }
    }

    const applied = await applyEditToAttendance(client, edit);

    const updated = await client.query(
      `UPDATE drm.attendance_edit_requests
          SET status = 'Approved', reviewed_by_user_id = $1, reviewed_at = now(),
              salary_locked = $2, override_reason = $3, updated_at = now()
        WHERE id = $4 RETURNING *`,
      [req.user.userId, locked, overrideReason, req.params.id],
    );
    await client.query("COMMIT");

    await recordAuditLog({
      actorUserId: req.user.userId,
      action: "attendance.edit_request.approve",
      module: "attendance",
      entityType: "Attendance",
      entityId: String(applied.attendanceId),
      previousStatus: "Pending",
      nextStatus: "Approved",
      before: { field: edit.field, value: applied.before },
      after: { field: edit.field, value: applied.after },
      reason: locked ? `Salary-locked override: ${overrideReason}` : edit.reason,
      req,
    });

    res.json({ edit: updated.rows[0], applied: { attendanceId: applied.attendanceId } });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already rolled back */ }
    const he = err as HttpError;
    if (he && typeof he.status === "number") {
      return res.status(he.status).json({ error: he.message });
    }
    console.error("Error approving attendance edit:", err);
    res.status(500).json({ error: "Failed to approve attendance edit request" });
  } finally {
    client.release();
  }
}

async function rejectEdit(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    if (!rejectionReason) return res.status(400).json({ error: "A rejectionReason is required" });

    const existing = await pool.query(`SELECT status FROM drm.attendance_edit_requests WHERE id = $1`, [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Edit request not found" });
    if (existing.rows[0].status !== "Pending") {
      return res.status(409).json({ error: `Request already ${existing.rows[0].status}` });
    }
    const updated = await pool.query(
      `UPDATE drm.attendance_edit_requests
       SET status = 'Rejected', rejection_reason = $1, reviewed_by_user_id = $2, reviewed_at = now(), updated_at = now()
       WHERE id = $3 RETURNING *`,
      [rejectionReason, req.user.userId, req.params.id],
    );

    await recordAuditLog({
      actorUserId: req.user.userId,
      action: "attendance.edit_request.reject",
      module: "attendance",
      entityType: "AttendanceEditRequest",
      entityId: String(req.params.id),
      previousStatus: "Pending",
      nextStatus: "Rejected",
      reason: rejectionReason,
      req,
    });

    res.json({ edit: updated.rows[0] });
  } catch (err) {
    console.error("Error rejecting attendance edit:", err);
    res.status(500).json({ error: "Failed to reject attendance edit request" });
  }
}

/**
 * PATCH /api/attendance/:id/correction — admin-only DIRECT correction of an
 * attendance row (no separate request/approval step). Records a self-approved
 * edit-request row for the audit trail, applies the change, and respects the
 * salary lock (admin override reason required for a locked month).
 */
async function directCorrection(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const field = String(req.body?.field || "");
    const reason = String(req.body?.reason || "").trim();
    const value = req.body?.value;
    if (!ALLOWED_FIELDS.has(field)) {
      return res.status(400).json({ error: `field must be one of ${Array.from(ALLOWED_FIELDS).join(", ")}` });
    }
    if (!reason) return res.status(400).json({ error: "A reason is required" });
    if (field === "status" && !VALID_STATUSES.includes(String(value ?? ""))) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    await client.query("BEGIN");
    const attRes = await client.query(
      `SELECT id, user_id, date FROM drm.attendance WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    if (attRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Attendance record not found" });
    }
    const att = attRes.rows[0];

    const locked = await isMonthLocked(client, att.user_id, att.date);
    let overrideReason: string | null = null;
    if (locked) {
      overrideReason = String(req.body?.overrideReason || "").trim() || null;
      if (!overrideReason) {
        await client.query("ROLLBACK");
        return res.status(423).json({
          error: "This employee's salary for that month is finalized/locked. An override reason is required.",
          salaryLocked: true,
          requiresOverride: true,
        });
      }
    }

    const applied = await applyEditToAttendance(client, {
      attendance_id: att.id,
      user_id: att.user_id,
      attendance_date: att.date,
      field,
      after_value: value,
    });

    const inserted = await client.query(
      `INSERT INTO drm.attendance_edit_requests
         (attendance_id, user_id, attendance_date, field, before_value, after_value, reason, status,
          requested_by_user_id, reviewed_by_user_id, reviewed_at, salary_locked, override_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Approved',$8,$8, now(), $9, $10)
       RETURNING *`,
      [
        att.id,
        att.user_id,
        att.date,
        field,
        applied.before == null ? null : String(applied.before),
        applied.after == null ? null : String(applied.after),
        reason,
        req.user.userId,
        locked,
        overrideReason,
      ],
    );
    await client.query("COMMIT");

    await recordAuditLog({
      actorUserId: req.user.userId,
      action: "attendance.correction",
      module: "attendance",
      entityType: "Attendance",
      entityId: String(att.id),
      before: { field, value: applied.before },
      after: { field, value: applied.after },
      reason: locked ? `${reason} | Salary-locked override: ${overrideReason}` : reason,
      req,
    });

    res.json({ correction: inserted.rows[0], applied: { attendanceId: applied.attendanceId } });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* already rolled back */ }
    const he = err as HttpError;
    if (he && typeof he.status === "number") {
      return res.status(he.status).json({ error: he.message });
    }
    console.error("Error applying attendance correction:", err);
    res.status(500).json({ error: "Failed to apply attendance correction" });
  } finally {
    client.release();
  }
}

export function registerAttendanceEditRoutes(app: Express) {
  const approveGuard = requireReportPermission("edit_attendance", "approve");
  const correctionGuard = requireActionPermission("attendance:correction", {
    roles: ["admin"],
    message: "Only an administrator can directly correct attendance.",
  });

  // List + create (managerial see all; others see own — enforced in handler).
  for (const base of ["/api/attendance/edits", "/api/attendance/edit-requests"]) {
    app.get(base, listEdits);
    app.post(base, createEdit);
    app.patch(`${base}/:id/approve`, approveGuard, approveEdit);
    app.patch(`${base}/:id/reject`, approveGuard, rejectEdit);
  }

  // Admin-only direct correction.
  app.patch("/api/attendance/:id/correction", correctionGuard, directCorrection);

  // GET /api/attendance/raw - raw biometric logs.
  // No biometric device/import is integrated, so this honestly returns an empty
  // set with an explanatory message instead of fabricated logs. The real,
  // attendance-sourced report lives at GET /api/reports/raw-attendance.
  app.get("/api/attendance/raw", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      res.json({
        records: [],
        available: false,
        message:
          "No biometric/raw attendance source is connected. Once a device or import is integrated, raw logs will appear here.",
      });
    } catch (err) {
      console.error("Error fetching raw attendance:", err);
      res.status(500).json({ error: "Failed to fetch raw attendance" });
    }
  });
}
