import type { Express } from "express";
import { attendanceRepository } from "../repositories/attendance.repository";
import { legacyAttendanceRepository } from "../repositories/legacy-attendance.repository";
import { isManagerialRole, normalizeRole } from "../utils/role-utils";
import { pool } from "../db";
import { recordAuditLog } from "../services/activity-service";
import {
  OldViewError,
  isIsoDate,
  saveOldViewAttendance,
  validateOldViewValues,
} from "../services/old-attendance-edit.service";

// Roles that may save the old "Attendence System" modal directly (others submit
// an edit request that a reviewer approves).
export const OLD_VIEW_DIRECT_SAVE_ROLES = ["admin", "super_hod", "hod", "account_manager"];

const SELF_CHECKIN_ENABLED = process.env.ATTENDANCE_SELF_CHECKIN_ENABLED === "true";

const normalizeDateRange = (start: Date, end: Date) => {
  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(end);
  normalizedEnd.setHours(23, 59, 59, 999);
  return { start: normalizedStart, end: normalizedEnd };
};

export function registerAttendanceRoutes(app: Express) {
  app.get("/api/attendance/settings", async (req, res) => {
    res.json({
      selfCheckInEnabled: SELF_CHECKIN_ENABLED,
      dataSource: "legacy",
      message: SELF_CHECKIN_ENABLED
        ? null
        : "Attendance is recorded from the office system. Self check-in is disabled.",
    });
  });

  // GET /api/attendance/today - Today's check-in/check-out status for the
  // calling user, independent of whatever date range the Daily Details
  // filter is currently showing.
  app.get("/api/attendance/today", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const now = new Date();
      const { start, end } = normalizeDateRange(now, now);
      const records = await attendanceRepository.findByUserIdAndDateRange(req.user.userId, start, end);
      res.json({ record: records[0] || null });
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      res.status(500).json({ error: "Failed to fetch today's attendance" });
    }
  });

  // GET /api/attendance - Get attendance records for date range
  app.get("/api/attendance", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.pageSize || "25"), 10) || 25),
      );

      const effectiveAttendanceRole = (req.user as any).activeRoleId || req.user.roleId;
      const canOverrideAttendanceUser =
        isManagerialRole(effectiveAttendanceRole) && effectiveAttendanceRole !== "sales_manager";
      const targetUserId =
        canOverrideAttendanceUser && req.query.userId
          ? (req.query.userId as string)
          : req.user.userId;

      let startDate: Date | null = null;
      let endDate: Date | null = null;
      if (startDateStr && endDateStr) {
        const normalized = normalizeDateRange(new Date(startDateStr), new Date(endDateStr));
        startDate = normalized.start;
        endDate = normalized.end;
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid date format" });
        }
      }

      // Old DRM "Attendence System" view (func.php user_id_attendence_view):
      // old rows (webxl_attendance) with Name / Net Salary / Drm Time / Cutting
      // Min RS, or the new-app rows when the user has no old rows in the range.
      // userId 'Female' / 'Male' = every old user of that gender (managers only).
      const genderTarget =
        canOverrideAttendanceUser && (req.query.userId === "Female" || req.query.userId === "Male")
          ? (req.query.userId as string)
          : null;
      const isoStart = /^\d{4}-\d{2}-\d{2}/.test(startDateStr || "") ? startDateStr.slice(0, 10) : null;
      const isoEnd = /^\d{4}-\d{2}-\d{2}/.test(endDateStr || "") ? endDateStr.slice(0, 10) : null;

      const view = await legacyAttendanceRepository.getOldAttendanceView(genderTarget ?? targetUserId, {
        startDate: isoStart,
        endDate: isoEnd,
        page,
        pageSize,
      });

      return res.json({
        ...view,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ error: "Failed to fetch attendance records" });
    }
  });

  // GET /api/attendance/salary-distribution?userId= - old func.php action
  // 'get_user_salary': users listed in the selected user's old salary_distribution.
  app.get("/api/attendance/salary-distribution", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const effectiveAttendanceRole = (req.user as any).activeRoleId || req.user.roleId;
      const canOverrideAttendanceUser =
        isManagerialRole(effectiveAttendanceRole) && effectiveAttendanceRole !== "sales_manager";
      const targetUserId =
        canOverrideAttendanceUser && req.query.userId
          ? (req.query.userId as string)
          : req.user.userId;
      if (!/^[0-9a-f-]{36}$/i.test(String(targetUserId))) {
        return res.json({ status: "error", message: "User not found", total_users: 0, salary_users: [] });
      }
      res.json(await legacyAttendanceRepository.getSalaryDistribution(targetUserId));
    } catch (error) {
      console.error("Error fetching salary distribution:", error);
      res.status(500).json({ error: "Failed to fetch salary distribution" });
    }
  });

  // PATCH /api/attendance/old-view/:userId/:date - old Attendance page modal
  // (Time In / Time Out / late/absent) saved directly, like func.php
  // `cuttingUseridNoDaily`: corrects the day (+ salary-distribution users that
  // have that day) and recalculates the month totals. Body:
  // { timeIn: "HH:MM"|"", timeOut: "HH:MM"|"", lateAbsent: "H:M"|"True", overrideReason? }
  app.patch("/api/attendance/old-view/:userId/:date", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const role = normalizeRole(String((req.user as any).activeRoleId || req.user.roleId || ""));
    if (!OLD_VIEW_DIRECT_SAVE_ROLES.includes(role)) {
      return res.status(403).json({
        error: "Only Admin, Super HOD, HOD or Account Manager can save attendance directly. Submit an edit request instead.",
        requestFlow: true,
      });
    }
    const userId = String(req.params.userId);
    const date = String(req.params.date);
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !isIsoDate(date)) {
      return res.status(400).json({ error: "Invalid employee or date" });
    }
    const overrideReason = String(req.body?.overrideReason ?? "").trim() || null;
    const client = await pool.connect();
    try {
      const values = validateOldViewValues(req.body);
      await client.query("BEGIN");
      const results = await saveOldViewAttendance(client, {
        modernUserId: userId,
        date,
        values,
        actorUserId: req.user.userId,
        allowLocked: role === "admin" && !!overrideReason,
      });
      await client.query("COMMIT");
      for (const r of results) {
        await recordAuditLog({
          actorUserId: req.user.userId,
          activeRole: role,
          action: "attendance.old_view.save",
          module: "attendance",
          entityType: "Attendance",
          entityId: r.attendanceIds[0] ?? r.userId,
          before: { userId: r.userId, date, rows: r.before, month: r.month.before },
          after: { userId: r.userId, date, ...r.after, created: r.created, month: r.month.after },
          reason: overrideReason
            ? `Salary-locked override: ${overrideReason}`
            : r.userId === userId
              ? "Old attendance view edit"
              : `Old attendance view edit (salary distribution of ${userId})`,
          req,
        }).catch((e) => console.error("[attendance/old-view] audit log failed:", e));
      }
      res.json({ success: true, updated: results.map((r) => ({
        userId: r.userId, attendanceIds: r.attendanceIds, created: r.created, month: r.month,
      })) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof OldViewError) {
        return res.status(error.status).json({ error: error.message, ...(error.extra ?? {}) });
      }
      console.error("Error saving old attendance view:", error);
      res.status(500).json({ error: "Failed to save attendance" });
    } finally {
      client.release();
    }
  });

  // GET /api/attendance/summary - Get monthly summary
  app.get("/api/attendance/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      let startDate: Date;
      let endDate: Date;

      if (!startDateStr || !endDateStr) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        const normalized = normalizeDateRange(new Date(startDateStr), new Date(endDateStr));
        startDate = normalized.start;
        endDate = normalized.end;
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // Sales Manager never gets the ?userId override — self-only, even
      // though they're otherwise a managerial role.
      const effectiveAttendanceRole = (req.user as any).activeRoleId || req.user.roleId;
      const canOverrideAttendanceUser = isManagerialRole(effectiveAttendanceRole) && effectiveAttendanceRole !== "sales_manager";
      const targetUserId = (canOverrideAttendanceUser && req.query.userId) ? (req.query.userId as string) : req.user.userId;
      const legacySummaries = await legacyAttendanceRepository.getLegacyMonthlySummaries(
        targetUserId,
        startDate,
        endDate,
      );
      const displayName = await legacyAttendanceRepository.resolveDisplayName(targetUserId);

      let summary =
        legacySummaries[0] ??
        (await attendanceRepository.getMonthlySummary(targetUserId, startDate, endDate));
      if (legacySummaries.length > 0) {
        summary = { ...legacySummaries[0], userName: displayName };
      }

      res.json({
        summary,
        summaries: legacySummaries.length ? legacySummaries : [summary],
        userName: displayName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      res.status(500).json({ error: "Failed to fetch attendance summary" });
    }
  });

  // GET /api/attendance/salary - Get salary-based attendance details
  app.get("/api/attendance/salary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      let startDate: Date;
      let endDate: Date;

      if (!startDateStr || !endDateStr) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        const normalized = normalizeDateRange(new Date(startDateStr), new Date(endDateStr));
        startDate = normalized.start;
        endDate = normalized.end;
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // Sales Manager never gets the ?userId override — self-only, even
      // though they're otherwise a managerial role.
      const effectiveAttendanceRole = (req.user as any).activeRoleId || req.user.roleId;
      const canOverrideAttendanceUser = isManagerialRole(effectiveAttendanceRole) && effectiveAttendanceRole !== "sales_manager";
      const targetUserId = (canOverrideAttendanceUser && req.query.userId) ? (req.query.userId as string) : req.user.userId;
      
      const displayName = await legacyAttendanceRepository.resolveDisplayName(targetUserId);
      let legacySlips = await legacyAttendanceRepository.getLegacySalarySlips(
        targetUserId,
        startDate,
        endDate,
      );
      if (legacySlips.length === 0 && !startDateStr && !endDateStr) {
        legacySlips = await legacyAttendanceRepository.getLegacySalarySlipsRecent(targetUserId);
      }

      if (legacySlips.length > 0) {
        return res.json({
          salaryDetails: legacySlips,
          userName: displayName,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
      }

      const userRes = await pool.query("SELECT full_name, basic_salary FROM drm.users WHERE id = $1", [
        targetUserId,
      ]);
      const userData = userRes.rows[0] || {};
      const grossSalary = Number(userData.basic_salary || 0);

      const baseSalaryDetails = await attendanceRepository.getSalaryDetails(
        targetUserId,
        startDate,
        endDate,
      );

      const perDay = grossSalary / 30;
      const cuttingAmount = baseSalaryDetails.daysAbsent * perDay;
      const totalSalary = Math.max(0, grossSalary - cuttingAmount);

      const salaryDetails = {
        ...baseSalaryDetails,
        userName: displayName || userData.full_name,
        grossSalary,
        totalCutting: cuttingAmount,
        totalSalary,
        lateMinutes: baseSalaryDetails.totalLateMinutes,
      };

      res.json({
        salaryDetails: [salaryDetails],
        userName: displayName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching salary details:", error);
      res.status(500).json({ error: "Failed to fetch salary details" });
    }
  });

  // POST /api/attendance/check-in - Check in for the day
  app.post("/api/attendance/check-in", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!SELF_CHECKIN_ENABLED) {
        return res.status(403).json({
          error: "Self check-in is disabled",
          message:
            "Attendance is managed through the office attendance system. Please contact HR if you need a correction.",
        });
      }

      const record = await attendanceRepository.checkIn(req.user.userId);
      res.json(record);
    } catch (error) {
      console.error("Error checking in:", error);
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  // POST /api/attendance/check-out - Check out for the day
  app.post("/api/attendance/check-out", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!SELF_CHECKIN_ENABLED) {
        return res.status(403).json({
          error: "Self check-out is disabled",
          message:
            "Attendance is managed through the office attendance system. Please contact HR if you need a correction.",
        });
      }

      const record = await attendanceRepository.checkOut(req.user.userId);
      
      if (!record) {
        return res.status(400).json({ error: "No check-in found for today" });
      }

      res.json(record);
    } catch (error) {
      console.error("Error checking out:", error);
      res.status(500).json({ error: "Failed to check out" });
    }
  });
}
