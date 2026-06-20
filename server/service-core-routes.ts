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
import { requireActionPermission } from "./middleware/action-permission.middleware";
import { CommunicationService } from "./services/communication.service";
import { CrossDepartmentStatusService } from "./services/cross-department-status.service";

// --- Stage 7 best-effort communication logging helpers ---------------------
const COMM_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMM_CHANNELS = new Set(["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT", "SMS", "NOTE", "OTHER"]);
const COMM_OUTCOMES = new Set([
  "INTERESTED", "NOT_INTERESTED", "CALLBACK", "NO_RESPONSE", "CONVERTED",
  "COMPLAINT", "RENEWAL", "RESOLVED", "DROPOUT_RISK", "OTHER",
]);
const asUuid = (v: any): string | undefined =>
  typeof v === "string" && COMM_UUID_RE.test(v) ? v : undefined;
const mapChannel = (v: any): any => {
  const s = String(v ?? "").toUpperCase();
  return COMM_CHANNELS.has(s) ? s : "NOTE";
};
const validOutcome = (v: any): any => {
  const s = String(v ?? "").toUpperCase();
  return COMM_OUTCOMES.has(s) ? s : undefined;
};
// Parse a date safely — never throw into the host handler before log() runs.
const commSafeIso = (v: any): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

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

  app.post("/api/service/followups", requireActionPermission("service.followup.create"), async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceFollowups).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      const created = result[0];
      if (created?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(created.serviceCustomerId),
          customerId: asUuid(created.customerId),
          channel: mapChannel(created.method),
          outcome: validOutcome(req.body?.outcome),
          notes: created.note ?? created.purpose ?? undefined,
          status: created.status === "completed" ? "COMPLETED" : "PENDING",
          nextFollowupAt: commSafeIso(created.nextFollowupDate),
          relatedFollowupId: String(created.id),
        }, { userId: req.user!.userId }, req);
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create followup" });
    }
  });

  app.patch("/api/service/followups/:id/complete", requireActionPermission("service.followup.complete"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const outcome = req.body?.outcome;
      if (!outcome || !String(outcome).trim()) {
        return res.status(400).json({ error: "An outcome is required to complete a follow-up." });
      }
      await db.update(serviceFollowups)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serviceFollowups.id, req.params.id));
      const fu = (await db.select().from(serviceFollowups).where(eq(serviceFollowups.id, req.params.id)))[0];
      if (fu?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(fu.serviceCustomerId),
          customerId: asUuid(fu.customerId),
          channel: mapChannel(fu.method),
          outcome: validOutcome(req.body?.outcome),
          notes: req.body?.note ?? undefined,
          status: "COMPLETED",
          relatedFollowupId: String(fu.id),
        }, { userId: req.user!.userId || (req.user as any)!.id }, req);
      }
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

  app.post("/api/service/complaints", requireActionPermission("service.complaint.create"), async (req: Request, res: Response) => {
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
      const created = result[0];
      if (created?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(created.serviceCustomerId),
          customerId: asUuid(created.customerId),
          channel: "NOTE",
          outcome: "COMPLAINT",
          notes: [created.title, created.description].filter(Boolean).join(" — ") || undefined,
          status: "COMPLETED",
          relatedFollowupId: String(created.id),
        }, { userId: req.user.userId }, req);
      }
      if (created?.id) {
        // Cross-department handoff: a new complaint needs attention. Notifies the
        // assignee (if any) else service managers, resolved to real user UUIDs,
        // and records the ledger row. Best-effort — never blocks the response.
        await CrossDepartmentStatusService.onServiceComplaintRaised({
          complaintId: String(created.id),
          assignedTo: (created as any).assignedTo ?? null,
          actorUserId: req.user.userId,
          notify: true,
          req,
        });
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      console.error("Error creating complaint:", err);
      res.status(500).json({ error: "Failed to create complaint" });
    }
  });

  // General edit (title / description / priority / due date)
  app.patch("/api/service/complaints/:id", requireActionPermission("service.complaint.update"), async (req: Request, res: Response) => {
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

  app.patch("/api/service/complaints/:id/assign", requireActionPermission("service.complaint.assign"), async (req: Request, res: Response) => {
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

  app.patch("/api/service/complaints/:id/resolve", requireActionPermission("service.complaint.resolve"), async (req: Request, res: Response) => {
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
      const cmp = (await db.select().from(serviceComplaints).where(eq(serviceComplaints.id, req.params.id)))[0];
      if (cmp?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(cmp.serviceCustomerId),
          customerId: asUuid(cmp.customerId),
          channel: "NOTE",
          outcome: "RESOLVED",
          notes: String(remarks).trim(),
          status: "COMPLETED",
          relatedFollowupId: String(cmp.id),
        }, { userId: req.user.userId }, req);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error resolving complaint:", err);
      res.status(500).json({ error: "Failed to resolve complaint" });
    }
  });

  app.patch("/api/service/complaints/:id/close", requireActionPermission("service.complaint.close"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const existing = (await db.select().from(serviceComplaints).where(eq(serviceComplaints.id, req.params.id)))[0];
      if (!existing) return res.status(404).json({ error: "Complaint not found" });
      const provided = req.body?.remarks;
      const finalRemark = (provided && String(provided).trim()) || existing.remarks;
      if (!finalRemark || !String(finalRemark).trim()) {
        return res.status(400).json({ error: "A resolution note is required before closing a complaint. Resolve it first or provide remarks." });
      }
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

  app.patch("/api/service/complaints/:id/reopen", requireActionPermission("service.complaint.reopen"), async (req: Request, res: Response) => {
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

  app.post("/api/service/dropouts", requireActionPermission("service.dropout.create"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!req.body?.reason || !String(req.body.reason).trim()) {
        return res.status(400).json({ error: "A reason is required to mark a customer as a dropout." });
      }
      const result = await db.insert(serviceDropouts).values({
        ...req.body,
        createdBy: req.user.userId,
      }).returning();
      const created = result[0];
      if (created?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(created.serviceCustomerId),
          customerId: asUuid(created.customerId),
          channel: "NOTE",
          outcome: "DROPOUT_RISK",
          notes: created.reason ?? undefined,
          status: "COMPLETED",
          relatedFollowupId: String(created.id),
        }, { userId: req.user.userId }, req);
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark dropout" });
    }
  });

  app.patch("/api/service/dropouts/:id/recover", requireActionPermission("service.dropout.recover"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!req.body?.recoveryNote || !String(req.body.recoveryNote).trim()) {
        return res.status(400).json({ error: "A recovery note is required to recover a dropout." });
      }
      await db.update(serviceDropouts)
        .set({ status: "recovered", recoveredAt: new Date(), recoveryNote: String(req.body.recoveryNote).trim() })
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

  app.post("/api/service/renewals", requireActionPermission("service.renewal.create"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const b = req.body || {};
      if (!b.serviceCustomerId) {
        return res.status(400).json({ error: "serviceCustomerId is required for a renewal." });
      }
      const pkg = b.package ?? b.packageName ?? b.renewalType ?? b.service;
      if (!pkg || !String(pkg).trim()) {
        return res.status(400).json({ error: "A renewal package/service is required." });
      }
      const due = b.dueDate ?? b.newExpiryDate;
      if (!due) {
        return res.status(400).json({ error: "A renewal due/expiry date is required." });
      }
      if (b.amount === undefined || b.amount === null || Number(b.amount) <= 0 || Number.isNaN(Number(b.amount))) {
        return res.status(400).json({ error: "A valid renewal amount greater than 0 is required." });
      }
      const result = await db.insert(serviceRenewals).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      const created = result[0];
      if (created?.serviceCustomerId) {
        void CommunicationService.log({
          entityType: "service_customer",
          entityId: String(created.serviceCustomerId),
          channel: "NOTE",
          outcome: "RENEWAL",
          notes: (() => {
            const iso = commSafeIso(created.newExpiryDate);
            return iso ? `Renewed; new expiry ${iso.slice(0, 10)}` : undefined;
          })(),
          status: "COMPLETED",
          relatedFollowupId: String(created.id),
        }, { userId: req.user!.userId || (req.user as any)!.id }, req);
      }
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

  // Service → GM / VAS / BV bridges.
  // These do not yet create real linked records. Rather than silently returning a
  // fake success (which would let the UI believe a GM/VAS/BV record exists), they
  // fail clearly so callers route through the real GM/VAS/BV modules.
  app.post("/api/service/gm", async (_req: Request, res: Response) => {
    res.status(501).json({ error: "Service→GM bridge is not implemented. Create the GM entry via the GM module." });
  });

  app.post("/api/service/vas", async (_req: Request, res: Response) => {
    res.status(501).json({ error: "Service→VAS bridge is not implemented. Create the VAS entry via the VAS module." });
  });

  app.post("/api/service/bv", async (_req: Request, res: Response) => {
    res.status(501).json({ error: "Service→BV bridge is not implemented. Create the BV entry via the BV module." });
  });
}
