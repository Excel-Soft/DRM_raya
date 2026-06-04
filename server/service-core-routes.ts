import { Express, Request, Response } from "express";

import { db, pool } from "./db";
import {
  serviceFollowups,
  serviceComplaints,
  serviceDropouts,
  serviceRenewals
} from "../shared/schema";
import { eq } from "drizzle-orm";
import { serviceReportsRepository, type ServiceListOptions } from "./repositories/service-reports.repository";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { isManagerialRole } from "./utils/role-utils";

async function scopedUserIds(req: Request): Promise<string[] | null> {
  const isManager = isManagerialRole((req.user as any).activeRoleId || req.user!.roleId);
  return isManager ? await getDepartmentFilterUserIds(req) : [req.user!.userId];
}

function listOpts(req: Request, userIds: string[] | null): ServiceListOptions & { priority?: string } {
  return {
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 25,
    search: (req.query.search as string) || undefined,
    executive: (req.query.executive as string) || undefined,
    status: (req.query.status as string) || undefined,
    priority: (req.query.priority as string) || undefined,
    dateFrom: (req.query.dateFrom as string) || undefined,
    dateTo: (req.query.dateTo as string) || undefined,
    userIds,
  };
}

export function registerServiceCoreRoutes(app: Express) {
  // Followups
  app.get("/api/service/followups/due", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const followups = await db.select().from(serviceFollowups).where(eq(serviceFollowups.assignedTo, execId));
      res.json(followups);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch due followups" });
    }
  });

  app.post("/api/service/followups", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceFollowups).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create followup" });
    }
  });

  app.patch("/api/service/followups/:id/complete", async (req: Request, res: Response) => {
    try {
      await db.update(serviceFollowups)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serviceFollowups.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to complete followup" });
    }
  });

  // ===== Complaints =====
  // Joined + paginated + filterable list. Returns { data, total, page, pageSize }.
  app.get("/api/service/complaints", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.listComplaints(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error fetching complaints:", err);
      res.status(500).json({ error: "Failed to fetch complaints" });
    }
  });

  app.post("/api/service/complaints", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { title } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: "Complaint title is required." });
      }
      const result = await db.insert(serviceComplaints).values({
        ...req.body,
        title: String(title).trim(),
        createdBy: req.user.userId,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      console.error("Error creating complaint:", err);
      res.status(500).json({ error: "Failed to create complaint" });
    }
  });

  // General edit (title / description / priority / due date)
  app.patch("/api/service/complaints/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { title, description, priority, dueDate } = req.body || {};
      const result = await pool.query(
        `UPDATE drm.service_complaints
           SET title = COALESCE($2, title),
               description = COALESCE($3, description),
               priority = COALESCE($4, priority),
               due_date = COALESCE($5, due_date),
               updated_by = $6,
               updated_at = now()
         WHERE id = $1 RETURNING id`,
        [req.params.id, title ?? null, description ?? null, priority ?? null, dueDate ?? null, req.user.userId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Complaint not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating complaint:", err);
      res.status(500).json({ error: "Failed to update complaint" });
    }
  });

  app.patch("/api/service/complaints/:id/assign", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { assignedTo } = req.body || {};
      if (!assignedTo) return res.status(400).json({ error: "assignedTo is required." });
      const result = await pool.query(
        `UPDATE drm.service_complaints
           SET assigned_to = $2,
               assigned_at = now(),
               status = CASE WHEN status = 'open' THEN 'in_progress'::drm.service_complaint_status ELSE status END,
               status_changed_at = now(),
               updated_by = $3,
               updated_at = now()
         WHERE id = $1 RETURNING id`,
        [req.params.id, assignedTo, req.user.userId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Complaint not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error assigning complaint:", err);
      res.status(500).json({ error: "Failed to assign complaint" });
    }
  });

  app.patch("/api/service/complaints/:id/resolve", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { remarks } = req.body || {};
      if (!remarks || !String(remarks).trim()) {
        return res.status(400).json({ error: "A resolution remark is required to resolve a complaint." });
      }
      const result = await pool.query(
        `UPDATE drm.service_complaints
           SET status = 'resolved'::drm.service_complaint_status,
               remarks = $2,
               resolved_at = now(),
               status_changed_at = now(),
               updated_by = $3,
               updated_at = now()
         WHERE id = $1 RETURNING id`,
        [req.params.id, String(remarks).trim(), req.user.userId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Complaint not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error resolving complaint:", err);
      res.status(500).json({ error: "Failed to resolve complaint" });
    }
  });

  app.patch("/api/service/complaints/:id/close", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await pool.query(
        `UPDATE drm.service_complaints
           SET status = 'closed'::drm.service_complaint_status,
               closed_at = now(),
               status_changed_at = now(),
               remarks = COALESCE($2, remarks),
               updated_by = $3,
               updated_at = now()
         WHERE id = $1 RETURNING id`,
        [req.params.id, req.body?.remarks ?? null, req.user.userId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Complaint not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error closing complaint:", err);
      res.status(500).json({ error: "Failed to close complaint" });
    }
  });

  app.patch("/api/service/complaints/:id/reopen", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await pool.query(
        `UPDATE drm.service_complaints
           SET status = 'open'::drm.service_complaint_status,
               reopened_at = now(),
               resolved_at = NULL,
               closed_at = NULL,
               status_changed_at = now(),
               updated_by = $2,
               updated_at = now()
         WHERE id = $1 RETURNING id`,
        [req.params.id, req.user.userId],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Complaint not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error reopening complaint:", err);
      res.status(500).json({ error: "Failed to reopen complaint" });
    }
  });

  // ===== Dropouts =====
  // Joined + paginated list. Returns { data, total, page, pageSize }.
  app.get("/api/service/dropouts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userIds = await scopedUserIds(req);
      const result = await serviceReportsRepository.dropouts(listOpts(req, userIds));
      res.json(result);
    } catch (err) {
      console.error("Error fetching dropouts:", err);
      res.status(500).json({ error: "Failed to fetch dropouts" });
    }
  });

  app.post("/api/service/dropouts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await db.insert(serviceDropouts).values({
        ...req.body,
        createdBy: req.user.userId,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark dropout" });
    }
  });

  app.patch("/api/service/dropouts/:id/recover", async (req: Request, res: Response) => {
    try {
      await db.update(serviceDropouts)
        .set({ status: "recovered", recoveredAt: new Date(), recoveryNote: req.body.recoveryNote })
        .where(eq(serviceDropouts.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to recover dropout" });
    }
  });

  // Renewals
  app.get("/api/service/renewals", async (req: Request, res: Response) => {
    try {
      const renewals = await db.select().from(serviceRenewals);
      res.json(renewals);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch renewals" });
    }
  });

  app.post("/api/service/renewals", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceRenewals).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create renewal" });
    }
  });

  // Phase 5: GM / VAS / BV Bridges
  app.get("/api/service/gm-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "GM Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch GM report" });
    }
  });

  app.get("/api/service/vas-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "VAS Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch VAS report" });
    }
  });

  app.get("/api/service/bv-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "BV Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch BV report" });
    }
  });

  app.post("/api/service/gm", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "GM injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create GM entry" });
    }
  });

  app.post("/api/service/vas", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "VAS injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create VAS entry" });
    }
  });

  app.post("/api/service/bv", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "BV injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create BV entry" });
    }
  });
}
