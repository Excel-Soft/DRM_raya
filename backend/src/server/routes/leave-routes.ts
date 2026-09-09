import type { Express } from "express";
import { leaveRequestRepository } from "../repositories/leave-request.repository";
import { z } from "zod";
import { pool } from "../db";
import { isManagerialRole, normalizeRole, ROLES } from "../utils/role-utils";
import { requireActionPermission } from "../middleware/action-permission";
import { ActivityLogService } from "../services/activity-service";
import { sendApiError, sendError, ApiError } from "../utils/api-error";
import { ValidationService } from "../services/validation.service";

// Resolve the caller's effective (active) role from the auth payload.
function callerRole(req: any): string {
  return (req.user?.activeRoleId ?? req.user?.roleId ?? req.user?.role ?? "") as string;
}

export function registerLeaveRoutes(app: Express) {
  // GET /api/leave/colleagues - Get colleagues of a specific role
  app.get("/api/leave/colleagues", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const role = req.query.role as string;
      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }
      const query = `
        SELECT id, name, full_name, email 
        FROM drm.users 
        WHERE (is_active = true OR is_active IS NULL) 
        AND (role_id = $1 OR role = $1 OR $1 = ANY(roles))
      `;
      const result = await pool.query(query, [role]);
      const users = result.rows.map(u => ({
        id: u.id,
        fullName: u.name || u.full_name,
        email: u.email
      }));
      res.json({ users });
    } catch (error) {
      console.error("Error fetching colleagues:", error);
      res.status(500).json({ error: "Failed to fetch colleagues" });
    }
  });

  // GET /api/leave - Get all leave requests for the current user
  app.get("/api/leave", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const requests = await leaveRequestRepository.findByUserId(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  });

  // GET /api/admin/leaves - Get all leave requests for the manager
  app.get("/api/admin/leaves", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      // This returns every employee's leave records, so restrict to
      // managerial roles (manager/HOD/super_hod/admin).
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to view all leave requests." });
      }
      const requests = await leaveRequestRepository.findAll();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching all leave requests:", error);
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  });

  // GET /api/leave/stats - Get leave statistics for the current user
  app.get("/api/leave/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const stats = await leaveRequestRepository.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching leave stats:", error);
      res.status(500).json({ error: "Failed to fetch leave statistics" });
    }
  });

  // GET /api/leave/monthly - Get monthly leave count
  app.get("/api/leave/monthly", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth();

      const count = await leaveRequestRepository.getMonthlyLeaveCount(
        userId,
        year,
        month
      );

      res.json({ year, month, totalDays: count });
    } catch (error) {
      console.error("Error fetching monthly leave count:", error);
      res.status(500).json({ error: "Failed to fetch monthly leave count" });
    }
  });

  // GET /api/leave/:id - Get a specific leave request
  app.get("/api/leave/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const request = await leaveRequestRepository.findById(req.params.id);
      
      if (!request) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      if (request.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this request" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching leave request:", error);
      res.status(500).json({ error: "Failed to fetch leave request" });
    }
  });

  // POST /api/leave - Submit a new leave request
  app.post("/api/leave", async (req, res) => {
    try {
      if (!req.user) {
        return sendApiError(res, {
          status: 401,
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const userId = req.user.userId;
      const nullableString = z.union([z.string(), z.null(), z.undefined()]);

      const schema = z.object({
        fromDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
        toDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
        type: z.union([z.string(), z.array(z.string())]).optional(),
        leaveType: z.union([z.string(), z.array(z.string())]).optional(),
        reason: nullableString.optional(),
        description: nullableString.optional(),
        purpose: nullableString.optional(),
        time: nullableString.optional(),
        alternative: nullableString.optional(),
      }).transform((data) => {
        const pick = (val?: string | string[]) => {
          if (Array.isArray(val)) return val[0];
          return val;
        };
        const type = pick(data.leaveType) || pick(data.type);
        return {
          fromDate: data.fromDate,
          toDate: data.toDate,
          type,
          reason: data.reason || data.description || data.purpose || null,
        };
      }).superRefine((data, ctx) => {
        if (!data.type || `${data.type}`.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "type is required",
            path: ["type"],
          });
        }
        if (data.toDate < data.fromDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "toDate must be after fromDate",
            path: ["toDate"],
          });
        }
      });

      const parsed = ValidationService.parse(schema, req.body);
      if (!parsed.type) {
        return sendApiError(res, {
          status: 400,
          code: "VALIDATION_ERROR",
          message: "type is required",
        });
      }

      const request = await leaveRequestRepository.create({
        userId,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        type: parsed.type,
        reason: parsed.reason,
      });
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof ApiError || error instanceof z.ZodError) {
        return sendError(res, error);
      }
      console.error("Error creating leave request:", error);
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  // PATCH /api/leave/:id/cancel - Cancel a pending leave request
  app.patch("/api/leave/:id/cancel", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const request = await leaveRequestRepository.cancel(req.params.id, userId);
      
      if (!request) {
        return res.status(400).json({ 
          error: "Cannot cancel this request. It may not exist, not belong to you, or is no longer pending." 
        });
      }

      res.json(request);
    } catch (error) {
      console.error("Error cancelling leave request:", error);
      res.status(500).json({ error: "Failed to cancel leave request" });
    }
  });

  // PATCH /api/leave/:id/approve - Approve a leave request (for managers)
  app.patch("/api/leave/:id/approve", requireActionPermission("leave.approve", { allowRole: isManagerialRole, message: "You are not authorized to approve leave requests." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // Only managerial roles (manager/HOD/super_hod/admin) may approve.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to approve leave requests." });
      }
      // Segregation of duties: a non-admin may not approve their own request.
      const existingLeave = await leaveRequestRepository.findById(req.params.id);
      if (
        existingLeave &&
        existingLeave.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot approve your own leave request." });
      }
      const request = await leaveRequestRepository.approve(req.params.id, userId);
      
      if (!request) {
        return res.status(400).json({ 
          error: "Cannot approve this request. It may not exist or is no longer pending." 
        });
      }

      await ActivityLogService.log({
        userId,
        action: "LEAVE_APPROVED",
        resourceType: "leave_request",
        resourceId: req.params.id,
        details: `Approved by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(request);
    } catch (error) {
      console.error("Error approving leave request:", error);
      res.status(500).json({ error: "Failed to approve leave request" });
    }
  });

  // PATCH /api/leave/:id/reject - Reject a leave request (for managers)
  app.patch("/api/leave/:id/reject", requireActionPermission("leave.reject", { allowRole: isManagerialRole, message: "You are not authorized to reject leave requests." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { reason } = req.body;

      // Only managerial roles (manager/HOD/super_hod/admin) may reject.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to reject leave requests." });
      }
      // Segregation of duties: a non-admin may not reject their own request.
      const existingLeaveR = await leaveRequestRepository.findById(req.params.id);
      if (
        existingLeaveR &&
        existingLeaveR.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot reject your own leave request." });
      }
      const request = await leaveRequestRepository.reject(req.params.id, userId, reason);
      
      if (!request) {
        return res.status(400).json({ 
          error: "Cannot reject this request. It may not exist or is no longer pending." 
        });
      }

      await ActivityLogService.log({
        userId,
        action: "LEAVE_REJECTED",
        resourceType: "leave_request",
        resourceId: req.params.id,
        details: `Rejected by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(request);
    } catch (error) {
      console.error("Error rejecting leave request:", error);
      res.status(500).json({ error: "Failed to reject leave request" });
    }
  });
}
