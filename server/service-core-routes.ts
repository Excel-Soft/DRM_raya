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
import { safePage, safePageSize } from "./utils/sql-safety";
import { ValidationService } from "./services/validation.service";
import { sendError, badRequest, unauthorized } from "./utils/api-error";
import { AuditLogService } from "./services/audit-log.service";
import {
  serviceFollowupCreateSchema,
  serviceComplaintCreateSchema,
  serviceDropoutCreateSchema,
  serviceRenewalCreateSchema,
  serviceFollowupCompleteSchema,
  serviceComplaintResolveSchema,
  serviceComplaintCloseSchema,
  serviceComplaintUpdateSchema,
  serviceDropoutRecoverSchema,
} from "./validators/service.validators";
import { getConfigValue } from "./services/service-bridge-config.service";
import {
  SERVICE_BRIDGE_DISABLED_MESSAGE,
  SERVICE_BRIDGE_TARGET_TO_FLAG,
} from "../shared/service-bridge-constants";
import {
  bridgeToGm,
  bridgeToVas,
  bridgeToBv,
  ensureBridgeLinksTable,
  mapServiceBridgeError,
  type BridgeActor,
} from "./services/service-bridge.service";

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

// --- Service bridge report helpers -----------------------------------------
type BridgeReportTarget = "gm" | "vas" | "bv";

function emptyBridgeSummary(target: BridgeReportTarget): Record<string, number> {
  const base = { total: 0, active: 0, superseded: 0 };
  return target === "gm"
    ? { ...base, linked: 0, pending: 0, totalAmountUsd: 0 }
    : { ...base, totalValueSold: 0 };
}

function summarizeBridgeReport(target: BridgeReportTarget, rows: any[]): Record<string, number> {
  const s: any = emptyBridgeSummary(target);
  s.total = rows.length;
  for (const r of rows) {
    if (r.linkStatus === "active") s.active++;
    else if (r.linkStatus === "superseded") s.superseded++;
    if (target === "gm") {
      if (r.targetRecordId) s.linked++;
      else s.pending++;
      const amt = Number(r.amountUsd);
      if (Number.isFinite(amt)) s.totalAmountUsd += amt;
    } else {
      const v = Number(r.valueSold);
      if (Number.isFinite(v)) s.totalValueSold += v;
    }
  }
  if (target === "gm") s.totalAmountUsd = Math.round(s.totalAmountUsd * 100) / 100;
  else s.totalValueSold = Math.round(s.totalValueSold * 100) / 100;
  return s;
}

async function scopedUserIds(req: Request): Promise<string[] | null> {
  const isManager = isManagerialRole((req.user as any).activeRoleId || req.user!.roleId);
  return isManager ? await getDepartmentFilterUserIds(req) : [req.user!.userId];
}

function listOpts(req: Request, userIds: string[] | null): ServiceListOptions & { priority?: string } {
  return {
    page: safePage(req.query.page, 1),
    pageSize: safePageSize(req.query.pageSize, 25, 200),
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
      const dto = ValidationService.parse(serviceFollowupCreateSchema, req.body);
      const result = await db.insert(serviceFollowups).values({
        ...dto,
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
      if (created?.id) {
        void AuditLogService.record({
          actorUserId: req.user!.userId || (req.user as any)!.id,
          actorRole: (req.user as any)?.activeRoleId || req.user?.roleId,
          action: "create",
          module: "service",
          entityType: "service_followup",
          entityId: String(created.id),
          after: {
            serviceCustomerId: created.serviceCustomerId,
            method: created.method,
            status: created.status,
          },
          req,
        });
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.patch("/api/service/followups/:id/complete", requireActionPermission("service.followup.complete"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const dto = serviceFollowupCompleteSchema.safeParse(req.body);
      if (!dto.success) {
        return res.status(400).json({ error: dto.error.issues[0]?.message ?? "Invalid request." });
      }
      const { outcome, note } = dto.data;
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
          outcome: validOutcome(outcome),
          notes: note ?? undefined,
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
      if (!req.user) throw unauthorized();
      const { title } = req.body || {};
      if (!title || !String(title).trim()) {
        throw badRequest("Complaint title is required.");
      }
      const dto = ValidationService.parse(serviceComplaintCreateSchema, req.body);
      const result = await db.insert(serviceComplaints).values({
        ...dto,
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
      if (created?.id) {
        void AuditLogService.record({
          actorUserId: req.user.userId,
          actorRole: (req.user as any)?.activeRoleId || req.user?.roleId,
          action: "create",
          module: "service",
          entityType: "service_complaint",
          entityId: String(created.id),
          after: {
            serviceCustomerId: created.serviceCustomerId,
            title: created.title,
            status: created.status,
            assignedTo: (created as any).assignedTo ?? null,
          },
          req,
        });
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      console.error("Error creating complaint:", err);
      sendError(res, err);
    }
  });

  // General edit (title / description / priority / due date)
  app.patch("/api/service/complaints/:id", requireActionPermission("service.complaint.update"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const dto = serviceComplaintUpdateSchema.safeParse(req.body);
      if (!dto.success) {
        return res.status(400).json({ error: dto.error.issues[0]?.message ?? "Invalid request." });
      }
      const { title, description, priority, dueDate } = dto.data;
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
      const dto = serviceComplaintResolveSchema.safeParse(req.body);
      if (!dto.success) {
        return res.status(400).json({ error: dto.error.issues[0]?.message ?? "Invalid request." });
      }
      const remarks = dto.data.remarks;
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
      const body = serviceComplaintCloseSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid request." });
      }
      const provided = body.data.remarks;
      const existing = (await db.select().from(serviceComplaints).where(eq(serviceComplaints.id, req.params.id)))[0];
      if (!existing) return res.status(404).json({ error: "Complaint not found" });
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
        [req.params.id, provided ?? null, req.user.userId],
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
      if (!req.user) throw unauthorized();
      if (!req.body?.reason || !String(req.body.reason).trim()) {
        throw badRequest("A reason is required to mark a customer as a dropout.");
      }
      const dto = ValidationService.parse(serviceDropoutCreateSchema, req.body);
      const result = await db.insert(serviceDropouts).values({
        ...dto,
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
      if (created?.id) {
        void AuditLogService.record({
          actorUserId: req.user.userId,
          actorRole: (req.user as any)?.activeRoleId || req.user?.roleId,
          action: "create",
          module: "service",
          entityType: "service_dropout",
          entityId: String(created.id),
          after: {
            serviceCustomerId: created.serviceCustomerId,
            status: created.status,
          },
          req,
        });
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.patch("/api/service/dropouts/:id/recover", requireActionPermission("service.dropout.recover"), async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const dto = serviceDropoutRecoverSchema.safeParse(req.body);
      if (!dto.success) {
        return res.status(400).json({ error: dto.error.issues[0]?.message ?? "Invalid request." });
      }
      await db.update(serviceDropouts)
        .set({ status: "recovered", recoveredAt: new Date(), recoveryNote: dto.data.recoveryNote })
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
      if (!req.user) throw unauthorized();
      const b = req.body || {};
      if (!b.serviceCustomerId) {
        throw badRequest("serviceCustomerId is required for a renewal.");
      }
      const pkg = b.package ?? b.packageName ?? b.renewalType ?? b.service;
      if (!pkg || !String(pkg).trim()) {
        throw badRequest("A renewal package/service is required.");
      }
      const due = b.dueDate ?? b.newExpiryDate;
      if (!due) {
        throw badRequest("A renewal due/expiry date is required.");
      }
      if (b.amount === undefined || b.amount === null || Number(b.amount) <= 0 || Number.isNaN(Number(b.amount))) {
        throw badRequest("A valid renewal amount greater than 0 is required.");
      }
      const dto = ValidationService.parse(serviceRenewalCreateSchema, req.body);
      const result = await db.insert(serviceRenewals).values({
        ...dto,
        // `amount` is a decimal column (Drizzle expects a string); the DTO
        // validated/coerced it to a number, so serialize it back here.
        amount: dto.amount === undefined ? undefined : String(dto.amount),
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
      if (created?.id) {
        void AuditLogService.record({
          actorUserId: req.user!.userId || (req.user as any)!.id,
          actorRole: (req.user as any)?.activeRoleId || req.user?.roleId,
          action: "create",
          module: "service",
          entityType: "service_renewal",
          entityId: String(created.id),
          after: {
            serviceCustomerId: created.serviceCustomerId,
            renewalType: (created as any).renewalType ?? null,
            status: (created as any).status ?? null,
          },
          req,
        });
      }
      res.json(result[0] || { success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Phase 5: GM / VAS / BV bridge REPORTS (read-only).
  // These surface the bridge linkage history (drm.service_bridge_links) joined to
  // the source service record (+ company) and, per target, the canonical report /
  // entry it produced. Reads are intentionally NOT config-gated: disabling a bridge
  // blocks CREATION (the POST routes below return 403), but previously-bridged
  // history must stay viewable. Row-scoped via scopedUserIds (managers see their
  // department, executives only their own links). Each target join is wrapped so
  // schema drift on a target table degrades to a links-only view instead of 500ing.
  const serviceBridgeReport = async (
    req: Request,
    res: Response,
    target: BridgeReportTarget,
  ): Promise<Response> => {
    await ensureBridgeLinksTable();

    const userIds = await scopedUserIds(req);
    const params: any[] = [target];
    let scopeClause = "";
    if (Array.isArray(userIds)) {
      if (userIds.length === 0) {
        return res.json({ targetModule: target, items: [], summary: emptyBridgeSummary(target) });
      }
      params.push(userIds);
      scopeClause = `AND l.created_by = ANY($2::text[])`;
    }

    const TARGET_JOIN: Record<BridgeReportTarget, { extra: string; from: string }> = {
      gm: {
        extra: `, g.status AS "reportStatus", g.company_name AS "reportCompany", g.drm_id AS "drmId", g.amount_usd AS "amountUsd"`,
        from: `LEFT JOIN drm.gm_entries g ON g.id::text = l.target_record_id`,
      },
      vas: {
        extra: `, r.status AS "reportStatus", r.title AS "reportTitle", r.value_sold AS "valueSold", r.report_date AS "reportDate"`,
        from: `LEFT JOIN drm.vas_reports r ON r.id::text = l.target_record_id`,
      },
      bv: {
        extra: `, r.status AS "reportStatus", r.title AS "reportTitle", r.value_sold AS "valueSold", r.report_date AS "reportDate"`,
        from: `LEFT JOIN drm.bv_reports r ON r.id::text = l.target_record_id`,
      },
    };

    const buildSql = (withTarget: boolean): string => {
      const t = TARGET_JOIN[target];
      return `
        SELECT
          l.id                AS "linkId",
          l.service_record_id AS "serviceRecordId",
          l.target_record_id  AS "targetRecordId",
          l.status            AS "linkStatus",
          l.created_by        AS "createdBy",
          l.override_reason   AS "overrideReason",
          l.created_at        AS "linkedAt",
          (l.metadata->>'handoff') AS "handoff",
          sc.status           AS "serviceStatus",
          sc.customer_id      AS "customerId",
          c.company_name      AS "companyName"
          ${withTarget ? t.extra : ""}
        FROM drm.service_bridge_links l
        LEFT JOIN drm.service_customers sc ON sc.id::text = l.service_record_id
        LEFT JOIN drm.customers c          ON c.id::text  = sc.customer_id::text
        ${withTarget ? t.from : ""}
        WHERE l.target_module = $1 ${scopeClause}
        ORDER BY l.created_at DESC
        LIMIT 500`;
    };

    let rows: any[];
    try {
      ({ rows } = await pool.query(buildSql(true), params));
    } catch (joinErr) {
      // Target table drift → degrade to a links-only view (never 500 a read).
      console.error(`[ServiceBridgeReport] ${target} target join failed; links-only fallback`, joinErr);
      ({ rows } = await pool.query(buildSql(false), params));
    }

    return res.json({ targetModule: target, items: rows, summary: summarizeBridgeReport(target, rows) });
  };

  app.get("/api/service/gm-report", async (req: Request, res: Response) => {
    try { await serviceBridgeReport(req, res, "gm"); }
    catch (err) { sendError(res, err); }
  });

  app.get("/api/service/vas-report", async (req: Request, res: Response) => {
    try { await serviceBridgeReport(req, res, "vas"); }
    catch (err) { sendError(res, err); }
  });

  app.get("/api/service/bv-report", async (req: Request, res: Response) => {
    try { await serviceBridgeReport(req, res, "bv"); }
    catch (err) { sendError(res, err); }
  });

  // Service → GM / VAS / BV bridges (Patch 6 Stage 5).
  // Config-gated and DISABLED by default: when the relevant flag is off the
  // endpoint returns 403 "Service bridge is not enabled" (never a user-facing
  // 501) and the UI hides the action. When enabled, BV/VAS create a REAL linked
  // report via their canonical repositories; the GM bridge records the linkage
  // (GM entry creation stays owned by the canonical GM module — see
  // SERVICE_BRIDGE_DECISION.md). Auth required (401 if unauthenticated).
  const bridgeActor = (req: Request): BridgeActor => ({
    userId: req.user!.userId || (req.user as any)!.id,
    role: (req.user as any)?.activeRoleId || req.user?.roleId,
  });

  const runBridge = async (
    req: Request,
    res: Response,
    target: "gm" | "vas" | "bv",
    orchestrator: (input: any, actor: BridgeActor, r: Request) => Promise<any>,
  ) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const enabled = await getConfigValue(SERVICE_BRIDGE_TARGET_TO_FLAG[target]);
      if (!enabled) {
        return res.status(403).json({ error: SERVICE_BRIDGE_DISABLED_MESSAGE });
      }
      const reqBody = (req.body ?? {}) as Record<string, any>;
      const result = await orchestrator(
        {
          serviceRecordId: reqBody.serviceCustomerId ?? reqBody.serviceRecordId,
          override: reqBody.override === true || reqBody.override === "true",
          overrideReason: reqBody.overrideReason,
          payload: reqBody,
        },
        bridgeActor(req),
        req,
      );
      return res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (mapServiceBridgeError(res, err)) return;
      sendError(res, err);
    }
  };

  app.post("/api/service/gm", (req: Request, res: Response) => runBridge(req, res, "gm", bridgeToGm));
  app.post("/api/service/vas", (req: Request, res: Response) => runBridge(req, res, "vas", bridgeToVas));
  app.post("/api/service/bv", (req: Request, res: Response) => runBridge(req, res, "bv", bridgeToBv));
}
