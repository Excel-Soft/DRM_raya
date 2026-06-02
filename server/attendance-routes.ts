import type { Express } from "express";
import { attendanceRepository } from "./repositories/attendance.repository";
import { isManagerialRole } from "./utils/role-utils";

const normalizeDateRange = (start: Date, end: Date) => {
  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(end);
  normalizedEnd.setHours(23, 59, 59, 999);
  return { start: normalizedStart, end: normalizedEnd };
};

export function registerAttendanceRoutes(app: Express) {
  // GET /api/attendance - Get attendance records for date range
  app.get("/api/attendance", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

       if (!startDateStr || !endDateStr) {
         const endDateRaw = new Date();
         const startDateRaw = new Date();
         startDateRaw.setDate(startDateRaw.getDate() - 15);
         const { start, end } = normalizeDateRange(startDateRaw, endDateRaw);

         const targetUserId = (isManagerialRole(req.user.roleId) && req.query.userId) ? (req.query.userId as string) : req.user.userId;
         const records = await attendanceRepository.findByUserIdAndDateRange(
          targetUserId,
          start,
          end
         );

        return res.json({
          records,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });
      }

      const { start: startDate, end: endDate } = normalizeDateRange(
        new Date(startDateStr),
        new Date(endDateStr),
      );

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const targetUserId = (isManagerialRole(req.user.roleId) && req.query.userId) ? (req.query.userId as string) : req.user.userId;
      const records = await attendanceRepository.findByUserIdAndDateRange(
        targetUserId,
        startDate,
        endDate
      );

      res.json({
        records,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ error: "Failed to fetch attendance records" });
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

      const targetUserId = (isManagerialRole(req.user.roleId) && req.query.userId) ? (req.query.userId as string) : req.user.userId;
      const summary = await attendanceRepository.getMonthlySummary(
        targetUserId,
        startDate,
        endDate
      );

      res.json({
        summary,
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

      const targetUserId = (isManagerialRole(req.user.roleId) && req.query.userId) ? (req.query.userId as string) : req.user.userId;
      
      const { pool } = require("./db");
      const userRes = await pool.query('SELECT full_name, basic_salary FROM drm.users WHERE id = $1', [targetUserId]);
      const userData = userRes.rows[0] || {};
      const grossSalary = Number(userData.basic_salary || 0);

      const baseSalaryDetails = await attendanceRepository.getSalaryDetails(
        targetUserId,
        startDate,
        endDate
      );

      // Simple computation for total salary
      const perDay = grossSalary / 30;
      const cuttingAmount = baseSalaryDetails.daysAbsent * perDay;
      const totalSalary = Math.max(0, grossSalary - cuttingAmount);

      const salaryDetails = {
        ...baseSalaryDetails,
        userName: userData.full_name,
        grossSalary,
        totalCutting: cuttingAmount,
        totalSalary
      };

      res.json({
        salaryDetails,
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
