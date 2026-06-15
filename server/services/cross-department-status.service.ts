import type { Request } from "express";
import { pool } from "../db";
import { NotificationService } from "./notification-service";
import { AuditLogService } from "./audit-log.service";

/**
 * CrossDepartmentStatusService — the cross-department synchronization layer.
 *
 * It runs as a set of POST-TRANSITION hooks: each module performs its own
 * authoritative status change (HOD approval, QA completion, project creation,
 * …) and THEN calls the matching hook here. The hook only does the
 * cross-cutting work that no single module owns:
 *
 *   1. append a row to `drm.cross_department_status_history` (the ledger of
 *      who handed what to which department, and who is now responsible);
 *   2. record a cross-department audit event in `drm.activity_logs`;
 *   3. optionally notify the next department's REAL users (UUID ids only).
 *
 * HARD RULES honoured here:
 *   - It NEVER sets or mutates any business status — the module tables remain
 *     the single source of truth. This service is read-aggregating + ledgering.
 *   - It NEVER duplicates a notification a module already sends. The invoice
 *     chain (submit → HOD → Account → PMS) already notifies the next stage
 *     inline via InvoiceWorkflowService, so those hooks default to
 *     `notify: false` and only record the ledger + audit.
 *   - Recipients are always resolved to real user UUIDs via NotificationService
 *     (role strings are resolved first, never used as ids).
 *   - It is best-effort and NEVER throws: it runs after the business
 *     transaction has already committed, so a ledger/notify failure must not
 *     break the committed business flow.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NotifyType = "INFO" | "WARNING" | "SUCCESS" | "ERROR";

export interface CrossDeptRecordInput {
  /** Module that just performed the transition, e.g. "invoice", "pms", "product-posting". */
  sourceModule: string;
  sourceDepartment?: string | null;
  /** Module/department now responsible for the next step. */
  targetModule?: string | null;
  targetDepartment?: string | null;
  entityType: string;
  entityId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** Semantic action name, e.g. "INVOICE_HOD_APPROVED". */
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  /** Concrete recipient user ids (validated as UUIDs). */
  recipientUserIds?: string[];
  /** Roles to resolve to real user ids for the next stage. */
  recipientRoles?: string[];
  /** When set, roles are resolved within this department only. */
  recipientDepartment?: string | null;
  /**
   * Whether THIS hook should send notifications. Defaults to true. Pass false
   * when the originating module already notifies the next stage inline (the
   * invoice chain does) — the ledger still records the resolved recipients.
   */
  notify?: boolean;
  notifyMessage?: string;
  notifyType?: NotifyType;
  notifyTargetUrl?: string;
  notifyPriority?: "low" | "normal" | "high";
  metadata?: Record<string, unknown>;
  req?: Request;
}

export interface CrossDeptRecordResult {
  recorded: boolean;
  targetUserIds: string[];
  notifiedCount: number;
}

export class CrossDepartmentStatusService {
  private static schemaReady = false;

  /**
   * Idempotently create the ledger table + indexes. db:push is broken repo-wide
   * (pre-existing FK type mismatch), so the table is provisioned at runtime the
   * same way CommunicationService and the Stage-7 registrars do.
   */
  static async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drm.cross_department_status_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_key text NOT NULL UNIQUE,
        source_module text NOT NULL,
        source_department text,
        target_module text,
        target_department text,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        related_entity_type text,
        related_entity_id text,
        action text NOT NULL,
        from_status text,
        to_status text NOT NULL,
        actor_user_id uuid,
        target_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        notified boolean NOT NULL DEFAULT false,
        notified_count integer NOT NULL DEFAULT 0,
        audit_log_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_cross_dept_status_entity
         ON drm.cross_department_status_history (entity_type, entity_id);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_cross_dept_status_created
         ON drm.cross_department_status_history (created_at DESC);`,
    );
    this.schemaReady = true;
  }

  /**
   * Resolve the next-stage recipients to real user UUIDs. Concrete ids are
   * validated; roles are resolved (optionally department-scoped). Role strings
   * are never returned as ids.
   */
  private static async resolveRecipients(input: CrossDeptRecordInput): Promise<string[]> {
    const ids = new Set<string>((input.recipientUserIds || []).filter((id) => UUID_RE.test(id)));
    for (const role of input.recipientRoles || []) {
      if (!role) continue;
      const resolved = input.recipientDepartment
        ? await NotificationService.resolveUsersByDepartmentRole(input.recipientDepartment, role)
        : await NotificationService.resolveUsersByRole(role);
      resolved.forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }

  /**
   * Core ledger writer. Best-effort: never throws. Returns what happened so
   * callers/tests can assert, but a failure is swallowed (logged) so the
   * already-committed business transition is never affected.
   */
  static async record(input: CrossDeptRecordInput): Promise<CrossDeptRecordResult> {
    const result: CrossDeptRecordResult = { recorded: false, targetUserIds: [], notifiedCount: 0 };
    try {
      await this.ensureSchema();

      const targetUserIds = await this.resolveRecipients(input);
      result.targetUserIds = targetUserIds;

      const shouldNotify =
        input.notify !== false && !!input.notifyMessage && targetUserIds.length > 0;
      const eventKey = `${input.sourceModule}:${input.entityId}:${input.action}:${input.toStatus}`;
      const actorUserId =
        input.actorUserId && UUID_RE.test(input.actorUserId) ? input.actorUserId : null;

      // 1) Append the ledger row FIRST. event_key dedupes, and because every
      //    side effect below is gated on this insert creating a NEW row, a
      //    repeated hook is a true no-op (no duplicate notifications or audit).
      const insert = await pool.query(
        `INSERT INTO drm.cross_department_status_history
           (id, event_key, source_module, source_department, target_module, target_department,
            entity_type, entity_id, related_entity_type, related_entity_id, action,
            from_status, to_status, actor_user_id, target_user_ids, notified, notified_count,
            metadata, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14::jsonb, $15, $16, $17::jsonb, NOW())
         ON CONFLICT (event_key) DO NOTHING
         RETURNING id`,
        [
          eventKey,
          input.sourceModule,
          input.sourceDepartment ?? null,
          input.targetModule ?? null,
          input.targetDepartment ?? null,
          input.entityType,
          String(input.entityId),
          input.relatedEntityType ?? null,
          input.relatedEntityId ? String(input.relatedEntityId) : null,
          input.action,
          input.fromStatus ?? null,
          input.toStatus,
          actorUserId,
          JSON.stringify(targetUserIds),
          false,
          0,
          JSON.stringify(input.metadata || {}),
        ],
      );
      result.recorded = (insert.rowCount ?? 0) > 0;
      if (!result.recorded) {
        // Duplicate event (same event_key): the original record already
        // notified + audited, so do nothing more.
        return result;
      }
      const rowId = insert.rows[0].id as string;

      // 2) Notify next-stage real users (best-effort, UUID-validated inside),
      //    then persist how many were actually notified onto the ledger row.
      if (shouldNotify) {
        result.notifiedCount = await NotificationService.createNotificationsForUsers(targetUserIds, {
          message: input.notifyMessage as string,
          type: input.notifyType || "INFO",
          targetUrl: input.notifyTargetUrl,
          module: input.sourceModule,
          entityType: input.entityType,
          entityId: input.entityId,
          priority: input.notifyPriority || "normal",
        });
        await pool.query(
          `UPDATE drm.cross_department_status_history
              SET notified = $1, notified_count = $2 WHERE id = $3`,
          [result.notifiedCount > 0, result.notifiedCount, rowId],
        );
      }

      // 3) Cross-department audit event (separate table; never throws).
      await AuditLogService.recordTransition({
        actorUserId: actorUserId ?? undefined,
        action: `CROSS_DEPT_${input.action}`,
        module: "cross-department",
        entityType: input.entityType,
        entityId: String(input.entityId),
        previousStatus: input.fromStatus ?? undefined,
        nextStatus: input.toStatus,
        after: {
          sourceModule: input.sourceModule,
          sourceDepartment: input.sourceDepartment ?? null,
          targetModule: input.targetModule ?? null,
          targetDepartment: input.targetDepartment ?? null,
          relatedEntityType: input.relatedEntityType ?? null,
          relatedEntityId: input.relatedEntityId ?? null,
          targetUserIds,
          notified: shouldNotify && result.notifiedCount > 0,
          notifiedCount: result.notifiedCount,
        },
        req: input.req,
      });
    } catch (err) {
      // Post-transition hook: swallow so the committed business flow is safe.
      console.error("[CrossDepartmentStatusService] record failed:", err);
    }
    return result;
  }

  /** Read the cross-department ledger for one entity (newest first). */
  static async getHistoryForEntity(entityType: string, entityId: string) {
    try {
      const { rows } = await pool.query(
        `SELECT id, event_key, source_module, source_department, target_module, target_department,
                entity_type, entity_id, related_entity_type, related_entity_id, action,
                from_status, to_status, actor_user_id, target_user_ids, notified, notified_count,
                metadata, created_at
           FROM drm.cross_department_status_history
          WHERE entity_type = $1 AND entity_id = $2
          ORDER BY created_at DESC`,
        [entityType, String(entityId)],
      );
      return rows;
    } catch (err) {
      console.error("[CrossDepartmentStatusService] getHistoryForEntity failed:", err);
      return [];
    }
  }

  // ===========================================================================
  // Typed hooks — one per cross-department hand-off. Each is a thin wrapper over
  // record() that fixes the source/target/action so call sites stay readable.
  // ===========================================================================

  // ---- Invoice approval chain (module already notifies inline → notify:false) ----

  /** Sales submitted an invoice to HOD. Invoice service already notifies HOD. */
  static onInvoiceSubmittedToHod(args: {
    invoiceId: string;
    fromStatus?: string | null;
    toStatus: string;
    actorUserId?: string | null;
    req?: Request;
  }) {
    return this.record({
      sourceModule: "invoice",
      sourceDepartment: "SALES",
      targetModule: "invoice",
      targetDepartment: "HOD",
      entityType: "invoice",
      entityId: args.invoiceId,
      action: "INVOICE_SUBMITTED_TO_HOD",
      fromStatus: args.fromStatus ?? null,
      toStatus: args.toStatus,
      actorUserId: args.actorUserId ?? null,
      recipientRoles: ["hod", "super_hod"],
      notify: false,
      req: args.req,
    });
  }

  /** HOD approved → Account stage. Invoice service already notifies Account. */
  static onInvoiceHodApproved(args: {
    invoiceId: string;
    fromStatus?: string | null;
    toStatus: string;
    actorUserId?: string | null;
    req?: Request;
  }) {
    return this.record({
      sourceModule: "invoice",
      sourceDepartment: "HOD",
      targetModule: "invoice",
      targetDepartment: "ACCOUNTS",
      entityType: "invoice",
      entityId: args.invoiceId,
      action: "INVOICE_HOD_APPROVED",
      fromStatus: args.fromStatus ?? null,
      toStatus: args.toStatus,
      actorUserId: args.actorUserId ?? null,
      recipientRoles: ["account_manager"],
      notify: false,
      req: args.req,
    });
  }

  /** Account approved → PMS owns project creation. Invoice service already notifies PMS. */
  static onInvoiceAccountApproved(args: {
    invoiceId: string;
    projectId?: string | null;
    fromStatus?: string | null;
    toStatus: string;
    actorUserId?: string | null;
    req?: Request;
  }) {
    return this.record({
      sourceModule: "invoice",
      sourceDepartment: "ACCOUNTS",
      targetModule: "pms",
      targetDepartment: "PMS",
      entityType: "invoice",
      entityId: args.invoiceId,
      relatedEntityType: args.projectId ? "project" : null,
      relatedEntityId: args.projectId ?? null,
      action: "INVOICE_ACCOUNT_APPROVED",
      fromStatus: args.fromStatus ?? null,
      toStatus: args.toStatus,
      actorUserId: args.actorUserId ?? null,
      recipientRoles: ["pms", "product_posting_manager", "dd_manager", "software_manager"],
      notify: false,
      req: args.req,
    });
  }

  /** Invoice rejected. Invoice service already notifies the sales exec. */
  static onInvoiceRejected(args: {
    invoiceId: string;
    salesExecId?: string | null;
    stage: string;
    fromStatus?: string | null;
    actorUserId?: string | null;
    req?: Request;
  }) {
    return this.record({
      sourceModule: "invoice",
      sourceDepartment: args.stage,
      targetModule: "invoice",
      targetDepartment: "SALES",
      entityType: "invoice",
      entityId: args.invoiceId,
      action: "INVOICE_REJECTED",
      fromStatus: args.fromStatus ?? null,
      toStatus: "REJECTED",
      actorUserId: args.actorUserId ?? null,
      recipientUserIds: args.salesExecId ? [args.salesExecId] : [],
      notify: false,
      metadata: { stage: args.stage },
      req: args.req,
    });
  }

  // ---- PMS: project created from an approved invoice ----

  /**
   * A project was created from an approved invoice and routed to an execution
   * department. Notifies that department's managers (unless the caller opts out).
   */
  static onProjectCreated(args: {
    projectId: string;
    invoiceId?: string | null;
    departmentType?: string | null;
    workflowType?: "product-posting" | "software" | null;
    projectName?: string | null;
    actorUserId?: string | null;
    notify?: boolean;
    req?: Request;
  }) {
    const dept = (args.departmentType || "").toUpperCase();
    const managerRole =
      args.workflowType === "software" || dept === "SOFTWARE"
        ? "software_manager"
        : dept === "DND"
          ? "dd_manager"
          : "product_posting_manager";
    return this.record({
      sourceModule: "pms",
      sourceDepartment: "PMS",
      targetModule: args.workflowType ?? "product-posting",
      targetDepartment: dept || "PRODUCT_POSTING",
      entityType: "project",
      entityId: args.projectId,
      relatedEntityType: args.invoiceId ? "invoice" : null,
      relatedEntityId: args.invoiceId ?? null,
      action: "PROJECT_CREATED",
      fromStatus: "INVOICE_APPROVED",
      toStatus: "PROJECT_CREATED",
      actorUserId: args.actorUserId ?? null,
      recipientRoles: [managerRole],
      notify: args.notify,
      notifyMessage: `A new ${dept || "project"} was created${
        args.projectName ? ` for "${args.projectName}"` : ""
      } and is ready for assignment.`,
      notifyType: "INFO",
      notifyTargetUrl: "/approvals",
      req: args.req,
    });
  }

  // ---- Product Posting / Software workflow hand-offs ----

  /** Manager completed execution → QA review. Notifies QA managers. */
  static onWorkflowManagerCompleted(args: {
    module: "product-posting" | "software";
    workflowId: string;
    projectId?: string | null;
    taskId?: string | null;
    fromStatus?: string | null;
    actorUserId?: string | null;
    notify?: boolean;
    req?: Request;
  }) {
    return this.record({
      sourceModule: args.module,
      sourceDepartment: args.module === "software" ? "SOFTWARE" : "PRODUCT_POSTING",
      targetModule: args.module,
      targetDepartment: "QA",
      entityType: "workflow",
      entityId: args.workflowId,
      relatedEntityType: args.projectId ? "project" : null,
      relatedEntityId: args.projectId ?? null,
      action: "WORKFLOW_MANAGER_COMPLETED",
      fromStatus: args.fromStatus ?? "RUNNING_PROJECT",
      toStatus: "QA_REVIEW",
      actorUserId: args.actorUserId ?? null,
      recipientRoles: ["qa_manager"],
      notify: args.notify,
      notifyMessage: "A task has been completed and is awaiting QA review.",
      notifyType: "INFO",
      notifyTargetUrl: "/approvals",
      req: args.req,
    });
  }

  /** QA passed → verification. Notifies verification managers. */
  static onWorkflowQaCompleted(args: {
    module: "product-posting" | "software";
    workflowId: string;
    projectId?: string | null;
    taskId?: string | null;
    fromStatus?: string | null;
    actorUserId?: string | null;
    notify?: boolean;
    req?: Request;
  }) {
    return this.record({
      sourceModule: args.module,
      sourceDepartment: "QA",
      targetModule: args.module,
      targetDepartment: "VERIFICATION",
      entityType: "workflow",
      entityId: args.workflowId,
      relatedEntityType: args.projectId ? "project" : null,
      relatedEntityId: args.projectId ?? null,
      action: "WORKFLOW_QA_COMPLETED",
      fromStatus: args.fromStatus ?? "QA_REVIEW",
      toStatus: "VERIFICATION_PENDING",
      actorUserId: args.actorUserId ?? null,
      recipientRoles: ["verification_manager"],
      notify: args.notify,
      notifyMessage: "A task has passed QA and is awaiting verification.",
      notifyType: "INFO",
      notifyTargetUrl: "/approvals",
      req: args.req,
    });
  }

  /** Verification completed → work done. Notifies the originating manager. */
  static onWorkflowVerificationCompleted(args: {
    module: "product-posting" | "software";
    workflowId: string;
    projectId?: string | null;
    taskId?: string | null;
    fromStatus?: string | null;
    actorUserId?: string | null;
    recipientUserIds?: string[];
    notify?: boolean;
    req?: Request;
  }) {
    const managerRole = args.module === "software" ? "software_manager" : "product_posting_manager";
    return this.record({
      sourceModule: args.module,
      sourceDepartment: "VERIFICATION",
      targetModule: args.module,
      targetDepartment: args.module === "software" ? "SOFTWARE" : "PRODUCT_POSTING",
      entityType: "workflow",
      entityId: args.workflowId,
      relatedEntityType: args.projectId ? "project" : null,
      relatedEntityId: args.projectId ?? null,
      action: "WORKFLOW_VERIFICATION_COMPLETED",
      fromStatus: args.fromStatus ?? "VERIFICATION_PENDING",
      toStatus: "VERIFICATION_COMPLETE",
      actorUserId: args.actorUserId ?? null,
      recipientUserIds: args.recipientUserIds,
      recipientRoles: [managerRole],
      notify: args.notify,
      notifyMessage: "A task has completed verification and is now closed.",
      notifyType: "SUCCESS",
      notifyTargetUrl: "/approvals",
      req: args.req,
    });
  }

  // ---- Service department hand-offs ----

  /** A service complaint was raised/assigned. Notifies the assignee or service managers. */
  static onServiceComplaintRaised(args: {
    complaintId: string;
    assignedTo?: string | null;
    actorUserId?: string | null;
    notify?: boolean;
    req?: Request;
  }) {
    return this.record({
      sourceModule: "service",
      sourceDepartment: "SERVICE",
      targetModule: "service",
      targetDepartment: "SERVICE",
      entityType: "service_complaint",
      entityId: args.complaintId,
      action: "SERVICE_COMPLAINT_RAISED",
      toStatus: "open",
      actorUserId: args.actorUserId ?? null,
      recipientUserIds: args.assignedTo ? [args.assignedTo] : [],
      recipientRoles: args.assignedTo ? [] : ["service_manager"],
      notify: args.notify,
      notifyMessage: "A new service complaint has been raised and needs attention.",
      notifyType: "WARNING",
      notifyTargetUrl: "/approvals",
      req: args.req,
    });
  }
}

export default CrossDepartmentStatusService;
