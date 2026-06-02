import type { Express } from "express";
import { overtimeRepository } from "./repositories/overtime.repository";
import { insertOvertimeRecordSchema } from "@shared/schema";

export function registerOvertimeRoutes(app: Express) {
  // GET /api/overtime - Get all overtime records for the current user
  app.get("/api/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { normalizeRole } = await import("./utils/role-utils.js");
      const { getDepartmentFilterUserIds } = await import("./dashboard-routes.js");
      const { pool } = await import("./db.js");
      const userRes = await pool.query("SELECT role FROM drm.users WHERE id = $1", [userId]);
      const dbRole = userRes.rows[0]?.role || req.user.roleId;
      
      const role = normalizeRole(dbRole);
      const isManager = role.endsWith("_manager") || role.endsWith("_assistant_manager");
      const isGlobalAdmin = role === "super_admin" || role === "admin";

      let targetUserIds = [userId];

      if (isGlobalAdmin || isManager) {
        const records = await overtimeRepository.findAll();
        return res.json(records);
      }

      const result = await pool.query(
        `select o.id, o.user_id as "userId", o.date, o.hours as "timeSpent", o.status, o.reason as "taskTitle", o.reason as "taskDetails", o.approved_by as "reviewedByUserId", o.created_at as "createdAt", o.updated_at as "updatedAt", u.full_name as "userName"
           from drm.overtime_records o
           left join drm.users u on u.id = o.user_id
          where o.user_id = ANY($1::uuid[])
          order by o.created_at desc`,
        [targetUserIds]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching overtime records:", error);
      res.status(500).json({ error: "Failed to fetch overtime records" });
    }
  });

  // GET /api/admin/overtime - Get all overtime records for the manager
  app.get("/api/admin/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const records = await overtimeRepository.findAll();
      res.json(records);
    } catch (error) {
      console.error("Error fetching all overtime records:", error);
      res.status(500).json({ error: "Failed to fetch overtime records" });
    }
  });

  // GET /api/overtime/all - Manager view: all records
  app.get("/api/overtime/all", async (req, res) => {
    try {
      if (!req.user) { return res.status(401).json({ error: "Not authenticated" }); }
      const { pool } = await import("./db.js");
      const { rows } = await pool.query(`SELECT o.id, o.user_id AS "userId", u.full_name AS "userName", o.date, o.hours AS "timeSpent", o.status, o.reason, COALESCE(o.task_title, o.reason, 'N/A') AS "taskTitle", COALESCE(o.task_details, '') AS "taskDetails", o.created_at AS "createdAt" FROM drm.overtime_records o LEFT JOIN drm.users u ON u.id = o.user_id ORDER BY o.created_at DESC`);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: "Failed" }); }
  });

  // GET /api/overtime/stats - Get overtime statistics for the current user
  app.get("/api/overtime/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const stats = await overtimeRepository.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching overtime stats:", error);
      res.status(500).json({ error: "Failed to fetch overtime statistics" });
    }
  });

  // GET /api/overtime/monthly - Get monthly overtime minutes
  app.get("/api/overtime/monthly", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth();

      const minutes = await overtimeRepository.getMonthlyOvertimeMinutes(
        userId,
        year,
        month
      );

      res.json({ year, month, totalMinutes: minutes });
    } catch (error) {
      console.error("Error fetching monthly overtime:", error);
      res.status(500).json({ error: "Failed to fetch monthly overtime" });
    }
  });

  // GET /api/overtime/:id - Get a specific overtime record
  app.get("/api/overtime/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const record = await overtimeRepository.findById(req.params.id);
      
      if (!record) {
        return res.status(404).json({ error: "Overtime record not found" });
      }

      if (record.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this record" });
      }

      res.json(record);
    } catch (error) {
      console.error("Error fetching overtime record:", error);
      res.status(500).json({ error: "Failed to fetch overtime record" });
    }
  });

  // POST /api/overtime - Submit a new overtime record
  app.post("/api/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const targetUserId = req.body.userId || req.user.userId;
      const parseResult = insertOvertimeRecordSchema.safeParse({
        ...req.body,
        userId: targetUserId,
      });

      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: parseResult.error.errors,
        });
      }

      const record = await overtimeRepository.create(parseResult.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating overtime record:", error);
      res.status(500).json({ error: "Failed to create overtime record" });
    }
  });

  // DELETE /api/overtime/:id - Delete a pending overtime record
  app.delete("/api/overtime/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { normalizeRole } = await import("./utils/role-utils.js");
      const { pool } = await import("./db.js");
      const userRes = await pool.query("SELECT role FROM drm.users WHERE id = $1", [userId]);
      const dbRole = userRes.rows[0]?.role || req.user.roleId;

      const role = normalizeRole(dbRole);
      const isManager = role.endsWith("_manager") || role.endsWith("_assistant_manager");
      const isGlobalAdmin = role === "super_admin" || role === "admin";

      let allowedUserIds = [userId];
      if (isGlobalAdmin || isManager) {
         allowedUserIds = []; // empty means all
      }

      const existing = await overtimeRepository.findById(req.params.id);
      if (!existing || existing.status !== "Pending") {
        return res.status(400).json({ 
          error: "Cannot delete this record. It may not exist or is no longer pending." 
        });
      }

      if (!isGlobalAdmin && !allowedUserIds.includes(existing.userId)) {
         return res.status(403).json({ error: "Not authorized to delete this record" });
      }

      await pool.query(`delete from drm.overtime_records where id = $1`, [req.params.id]);

      res.json({ message: "Overtime record deleted successfully" });
    } catch (error) {
      console.error("Error deleting overtime record:", error);
      res.status(500).json({ error: "Failed to delete overtime record" });
    }
  });

  // PATCH /api/overtime/:id/approve - Approve an overtime record (for managers)
  app.patch("/api/overtime/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // TODO: Add role check for manager/HOD
      const record = await overtimeRepository.approve(req.params.id, userId);
      
      if (!record) {
        return res.status(400).json({ 
          error: "Cannot approve this record. It may not exist or is no longer pending." 
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error approving overtime record:", error);
      res.status(500).json({ error: "Failed to approve overtime record" });
    }
  });

  // PATCH /api/overtime/:id/reject - Reject an overtime record (for managers)
  app.patch("/api/overtime/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { reason } = req.body;
      
      // TODO: Add role check for manager/HOD
      const record = await overtimeRepository.reject(req.params.id, userId, reason);
      
      if (!record) {
        return res.status(400).json({ 
          error: "Cannot reject this record. It may not exist or is no longer pending." 
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error rejecting overtime record:", error);
      res.status(500).json({ error: "Failed to reject overtime record" });
    }
  });
}
