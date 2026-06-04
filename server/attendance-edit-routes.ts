import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { isManagerialRole } from "./utils/role-utils";

const ALLOWED_FIELDS = new Set(["status", "check_in", "check_out", "notes", "working_hours"]);

export function registerAttendanceEditRoutes(app: Express) {
  // GET /api/attendance/edits - list edit requests.
  // Managerial roles see all (optionally filtered); others see only their own.
  app.get("/api/attendance/edits", async (req: Request, res: Response) => {
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
  });

  // POST /api/attendance/edits - create an edit request (Pending).
  app.post("/api/attendance/edits", async (req: Request, res: Response) => {
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

      const result = await pool.query(
        `INSERT INTO drm.attendance_edit_requests
           (attendance_id, user_id, attendance_date, field, before_value, after_value, reason, status, requested_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8)
         RETURNING *`,
        [
          attendanceId || null,
          userId,
          new Date(attendanceDate),
          String(field),
          beforeValue ?? null,
          afterValue ?? null,
          String(reason).trim(),
          req.user.userId,
        ],
      );
      res.status(201).json({ edit: result.rows[0] });
    } catch (err) {
      console.error("Error creating attendance edit:", err);
      res.status(500).json({ error: "Failed to create attendance edit request" });
    }
  });

  // PATCH /api/attendance/edits/:id/approve - managerial only.
  app.patch("/api/attendance/edits/:id/approve", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!isManagerialRole(req.user.roleId)) return res.status(403).json({ error: "Not authorized to review attendance edits" });

      const existing = await pool.query(`SELECT status FROM drm.attendance_edit_requests WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Edit request not found" });
      if (existing.rows[0].status !== "Pending") {
        return res.status(409).json({ error: `Request already ${existing.rows[0].status}` });
      }
      const updated = await pool.query(
        `UPDATE drm.attendance_edit_requests
         SET status = 'Approved', reviewed_by_user_id = $1, reviewed_at = now(), updated_at = now()
         WHERE id = $2 RETURNING *`,
        [req.user.userId, req.params.id],
      );
      res.json({ edit: updated.rows[0] });
    } catch (err) {
      console.error("Error approving attendance edit:", err);
      res.status(500).json({ error: "Failed to approve attendance edit request" });
    }
  });

  // PATCH /api/attendance/edits/:id/reject - managerial only.
  app.patch("/api/attendance/edits/:id/reject", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!isManagerialRole(req.user.roleId)) return res.status(403).json({ error: "Not authorized to review attendance edits" });

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
      res.json({ edit: updated.rows[0] });
    } catch (err) {
      console.error("Error rejecting attendance edit:", err);
      res.status(500).json({ error: "Failed to reject attendance edit request" });
    }
  });

  // GET /api/attendance/raw - raw biometric logs.
  // No biometric device/import is integrated, so this honestly returns an empty
  // set with an explanatory message instead of fabricated logs.
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
