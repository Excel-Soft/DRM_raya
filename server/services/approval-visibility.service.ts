import { pool } from "../db";
import { normalizeRole } from "../utils/role-utils";
import { InvoiceWorkflowService } from "./invoice-workflow.service";
import { projectsRepository } from "../repositories/projects.repository";
import { AuditLogService } from "./audit-log.service";
import { CrossDepartmentStatusService } from "./cross-department-status.service";

/**
 * ApprovalVisibilityService — the READ aggregator behind the unified
 * /approvals dashboard.
 *
 * It NEVER performs a transition and NEVER duplicates a module's workflow
 * logic. For each module it REUSES the module's own pending query (or an
 * equivalent read-only SELECT) and normalizes the result into a single
 * `PendingApprovalItem` shape, attaching `actions` metadata that points at the
 * module's EXISTING approve/reject endpoints. The dashboard simply calls those
 * endpoints — the authoritative guards, state machine and notifications all
 * stay inside each module.
 *
 * Visibility is role-scoped server-side: an actor only sees the sources their
 * role(s) are allowed to act on (admin / super_hod see everything).
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT";

export interface ApprovalAction {
  method: HttpMethod;
  url: string;
  /** A non-empty reason is mandatory (rejections). */
  reasonRequired?: boolean;
  /** Body field name the reason should be sent as (default "reason"). */
  reasonKey?: string;
  /** Static body merged into the request (e.g. workflow {action:"complete"}). */
  body?: Record<string, unknown>;
}

export interface ApprovalActions {
  approve?: ApprovalAction;
  reject?: ApprovalAction;
  /** Client route to open the module's own screen (for multi-field actions). */
  view?: string;
}

export interface PendingApprovalItem {
  module: string;
  moduleLabel: string;
  stage: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  currency?: string | null;
  requestedByUserId?: string | null;
  requestedByName?: string | null;
  department?: string | null;
  status: string;
  createdAt: string | null;
  actions: ApprovalActions;
}

export interface ApprovalActor {
  userId: string;
  activeRoleId?: string | null;
  roleId?: string | null;
  role?: string | null;
  roles?: string[] | null;
  department?: string | null;
}

interface ApprovalSource {
  key: string;
  label: string;
  /** Normalized roles permitted to view/act on this source. */
  roles: string[];
  run: (actor: ApprovalActor) => Promise<PendingApprovalItem[]>;
}

const MANAGERIAL_HR_ROLES = [
  "admin",
  "super_hod",
  "hod",
  "manager",
  "assistant_manager",
  "sales_manager",
  "hr",
];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export class ApprovalVisibilityService {
  /** Collapse an actor's single + multi role into a normalized role set. */
  static actorRoles(actor: ApprovalActor): Set<string> {
    const raw: string[] = [];
    if (actor.activeRoleId) raw.push(String(actor.activeRoleId));
    if (actor.roleId) raw.push(String(actor.roleId));
    if (actor.role) raw.push(String(actor.role));
    if (actor.roles) raw.push(...actor.roles.map((r) => String(r)));
    return new Set(raw.map((r) => String(normalizeRole(r))).filter((r) => r.trim() !== ""));
  }

  private static isAdminLike(roles: Set<string>): boolean {
    return roles.has("admin") || roles.has("super_hod");
  }

  private static canView(actorRoles: Set<string>, source: ApprovalSource): boolean {
    if (this.isAdminLike(actorRoles)) return true;
    const allowed = new Set(source.roles.map((r) => String(normalizeRole(r))));
    return Array.from(actorRoles).some((r) => allowed.has(r));
  }

  // Maps a public `module` slug (as used by getDetail) to the source keys that
  // surface it, so detail reads reuse the SAME role scoping as the dashboard.
  private static readonly MODULE_SOURCE_KEYS: Record<string, string[]> = {
    invoice: ["invoice-hod", "invoice-account"],
    "pms-project": ["pms-project"],
    leave: ["leave"],
    overtime: ["overtime"],
    loan: ["loan-manager", "loan-hod"],
    "product-posting": ["workflow-qa", "workflow-verification"],
    software: ["workflow-qa", "workflow-verification"],
    "service-complaint": ["service-complaint"],
  };

  // Can this actor view detail/history for the given module? True if they can
  // view ANY source that feeds the module (admins always can). Unknown modules
  // are denied so new modules must be wired in explicitly.
  private static canViewModule(actorRoles: Set<string>, module: string): boolean {
    if (this.isAdminLike(actorRoles)) return true;
    const keys = this.MODULE_SOURCE_KEYS[module] || [];
    if (keys.length === 0) return false;
    const sources = this.sources();
    return keys.some((k) => {
      const src = sources.find((s) => s.key === k);
      return src ? this.canView(actorRoles, src) : false;
    });
  }

  // ===========================================================================
  // Module adapters — each returns normalized pending items. All read-only.
  // ===========================================================================

  private static async invoiceQueue(stage: "HOD" | "ACCOUNT"): Promise<PendingApprovalItem[]> {
    const status = stage === "HOD" ? "PENDING_HOD" : "PENDING_ACCOUNT";
    const rows = await InvoiceWorkflowService.queue(status as any);
    const approvePath = stage === "HOD" ? "hod-approve" : "account-approve";
    const rejectPath = stage === "HOD" ? "hod-reject" : "account-reject";
    return rows.map((inv: any) => ({
      module: "invoice",
      moduleLabel: "Invoice",
      stage,
      entityType: "invoice",
      entityId: String(inv.id),
      title: inv.projectName || inv.companyName || `Invoice ${String(inv.id).slice(0, 8)}`,
      subtitle: inv.companyName ?? inv.serviceType ?? null,
      amount: num(inv.amount),
      currency: inv.currency ?? "USD",
      requestedByUserId: inv.salesExecId ?? null,
      requestedByName: null,
      department: stage === "HOD" ? "HOD" : "ACCOUNTS",
      status: inv.status,
      createdAt: iso(inv.createdAt),
      actions: {
        approve: { method: "POST", url: `/api/invoices/${inv.id}/${approvePath}` },
        reject: {
          method: "POST",
          url: `/api/invoices/${inv.id}/${rejectPath}`,
          reasonRequired: true,
          reasonKey: "reason",
        },
        view: "/invoices",
      },
    }));
  }

  private static async pmsPendingProjects(): Promise<PendingApprovalItem[]> {
    const rows = await projectsRepository.findPendingInvoices();
    return rows.map((inv: any) => ({
      module: "pms-project",
      moduleLabel: "Project Creation",
      stage: "PMS",
      entityType: "invoice",
      entityId: String(inv.id),
      title: inv.projectName || inv.companyName || `Invoice ${String(inv.id).slice(0, 8)}`,
      subtitle: inv.companyName ?? null,
      amount: num(inv.amount),
      currency: inv.currency ?? "USD",
      requestedByUserId: inv.salesExecId ?? null,
      requestedByName: inv.salesExecName ?? null,
      department: "PMS",
      status: "APPROVED",
      createdAt: iso(inv.created_at ?? inv.createdAt),
      // Project creation needs structured input, so we link to the PMS screen
      // instead of exposing a one-click approve.
      actions: { view: "/pms/projects" },
    }));
  }

  private static async hrQueue(
    table: "leave_requests" | "overtime_records",
    pendingStatus: string,
  ): Promise<PendingApprovalItem[]> {
    const isLeave = table === "leave_requests";
    const titleExpr = isLeave ? "l.purpose" : "l.task_title";
    const { rows } = await pool.query(
      `SELECT l.id, l.user_id AS "userId", l.status, l.created_at AS "createdAt",
              ${titleExpr} AS title, u.full_name AS "userName", u.username AS "username"
         FROM drm.${table} l
         LEFT JOIN drm.users u ON l.user_id = u.id::text
        WHERE l.status = $1
        ORDER BY l.created_at DESC`,
      [pendingStatus],
    );
    const base = isLeave ? "/api/leave" : "/api/overtime";
    const moduleKey = isLeave ? "leave" : "overtime";
    const label = isLeave ? "Leave" : "Overtime";
    return rows.map((r: any) => ({
      module: moduleKey,
      moduleLabel: label,
      stage: "MANAGER",
      entityType: moduleKey,
      entityId: String(r.id),
      title: r.title || label,
      subtitle: r.userName || r.username || null,
      amount: null,
      currency: null,
      requestedByUserId: r.userId ?? null,
      requestedByName: r.userName || r.username || null,
      department: "HR",
      status: r.status,
      createdAt: iso(r.createdAt),
      actions: {
        approve: { method: "PATCH", url: `${base}/${r.id}/approve` },
        reject: {
          method: "PATCH",
          url: `${base}/${r.id}/reject`,
          reasonRequired: true,
          reasonKey: "reason",
        },
      },
    }));
  }

  private static async loanQueue(stage: "MANAGER" | "HOD"): Promise<PendingApprovalItem[]> {
    const pendingStatus = stage === "MANAGER" ? "Pending" : "ManagerApproved";
    const approvePath = stage === "MANAGER" ? "manager-approve" : "hod-approve";
    const { rows } = await pool.query(
      `SELECT l.id, l.user_id AS "userId", l.amount, l.detail, l.status,
              l.created_at AS "createdAt", u.full_name AS "userName", u.username AS "username"
         FROM drm.loan_requests l
         LEFT JOIN drm.users u ON l.user_id = u.id::text
        WHERE l.status = $1
        ORDER BY l.created_at DESC`,
      [pendingStatus],
    );
    return rows.map((r: any) => ({
      module: "loan",
      moduleLabel: "Loan / Advance",
      stage: stage === "MANAGER" ? "MANAGER" : "HOD",
      entityType: "loan",
      entityId: String(r.id),
      title: r.detail || "Loan request",
      subtitle: r.userName || r.username || null,
      amount: num(r.amount),
      currency: null,
      requestedByUserId: r.userId ?? null,
      requestedByName: r.userName || r.username || null,
      department: "HR",
      status: r.status,
      createdAt: iso(r.createdAt),
      actions: {
        approve: { method: "PATCH", url: `/api/loans/${r.id}/${approvePath}` },
        reject: {
          method: "PATCH",
          url: `/api/loans/${r.id}/reject`,
          reasonRequired: true,
          reasonKey: "reason",
        },
      },
    }));
  }

  private static async workflowQueue(
    phase: "QA_REVIEW" | "VERIFICATION_PENDING",
  ): Promise<PendingApprovalItem[]> {
    const stage = phase === "QA_REVIEW" ? "QA" : "VERIFICATION";
    const reviewPath = phase === "QA_REVIEW" ? "qa-review" : "verification-review";
    const items: PendingApprovalItem[] = [];
    const families: Array<{ table: string; module: string; apiBase: string; label: string }> = [
      {
        table: "product_posting_workflows",
        module: "product-posting",
        apiBase: "/api/product-posting",
        label: "Product Posting",
      },
      {
        table: "software_workflows",
        module: "software",
        apiBase: "/api/software",
        label: "Software",
      },
    ];
    for (const fam of families) {
      const { rows } = await pool.query(
        `SELECT w.id, w.task_id AS "taskId", w.project_id AS "projectId",
                w.current_phase AS "phase", w.created_at AS "createdAt",
                p.name AS "projectName", p.department_type AS "departmentType",
                t.title AS "taskTitle"
           FROM drm.${fam.table} w
           LEFT JOIN drm.projects p ON w.project_id = p.id
           LEFT JOIN drm.tasks t ON w.task_id = t.id
          WHERE w.current_phase = $1
          ORDER BY w.created_at DESC`,
        [phase],
      );
      for (const r of rows) {
        // The review endpoints are keyed by taskId; without one we cannot offer
        // an inline action, so fall back to a view link.
        const canAct = !!r.taskId;
        items.push({
          module: fam.module,
          moduleLabel: fam.label,
          stage,
          entityType: "workflow",
          entityId: String(r.id),
          title: r.taskTitle || r.projectName || `Workflow ${String(r.id).slice(0, 8)}`,
          subtitle: r.projectName ?? null,
          amount: null,
          currency: null,
          requestedByUserId: null,
          requestedByName: null,
          department: r.departmentType || stage,
          status: r.phase,
          createdAt: iso(r.createdAt),
          actions: canAct
            ? {
                approve: {
                  method: "POST",
                  url: `${fam.apiBase}/tasks/${r.taskId}/${reviewPath}`,
                  body: { action: "complete" },
                },
                reject: {
                  method: "POST",
                  url: `${fam.apiBase}/tasks/${r.taskId}/${reviewPath}`,
                  reasonRequired: true,
                  reasonKey: "remarks",
                  body: { action: "return" },
                },
              }
            : { view: "/pms/projects" },
        });
      }
    }
    return items;
  }

  private static async serviceComplaints(): Promise<PendingApprovalItem[]> {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.priority, c.status, c.assigned_to AS "assignedTo",
              c.created_at AS "createdAt", u.full_name AS "assigneeName"
         FROM drm.service_complaints c
         LEFT JOIN drm.users u ON c.assigned_to = u.id
        WHERE c.status IN ('open', 'in_progress')
        ORDER BY c.created_at DESC`,
    );
    return rows.map((r: any) => ({
      module: "service-complaint",
      moduleLabel: "Service Complaint",
      stage: "SERVICE",
      entityType: "service_complaint",
      entityId: String(r.id),
      title: r.title || "Service complaint",
      subtitle: r.assigneeName ?? null,
      amount: null,
      currency: null,
      requestedByUserId: r.assignedTo ?? null,
      requestedByName: r.assigneeName ?? null,
      department: "SERVICE",
      status: r.status,
      createdAt: iso(r.createdAt),
      actions: { view: "/service" },
    }));
  }

  // ===========================================================================
  // Source registry + orchestration
  // ===========================================================================

  private static sources(): ApprovalSource[] {
    return [
      {
        key: "invoice-hod",
        label: "Invoice — HOD",
        roles: ["hod", "super_hod", "admin"],
        run: () => this.invoiceQueue("HOD"),
      },
      {
        key: "invoice-account",
        label: "Invoice — Account",
        roles: ["account_manager", "admin"],
        run: () => this.invoiceQueue("ACCOUNT"),
      },
      {
        key: "pms-project",
        label: "Project Creation",
        roles: ["product_posting_manager", "dd_manager", "software_manager", "pms", "admin"],
        run: () => this.pmsPendingProjects(),
      },
      {
        key: "leave",
        label: "Leave",
        roles: MANAGERIAL_HR_ROLES,
        run: () => this.hrQueue("leave_requests", "Pending"),
      },
      {
        key: "overtime",
        label: "Overtime",
        roles: MANAGERIAL_HR_ROLES,
        run: () => this.hrQueue("overtime_records", "Pending"),
      },
      {
        key: "loan-manager",
        label: "Loan — Manager",
        roles: ["manager", "assistant_manager", "admin"],
        run: () => this.loanQueue("MANAGER"),
      },
      {
        key: "loan-hod",
        label: "Loan — HOD",
        roles: ["hod", "super_hod", "sales_manager", "admin"],
        run: () => this.loanQueue("HOD"),
      },
      {
        key: "workflow-qa",
        label: "QA Review",
        roles: ["qa_manager", "admin"],
        run: () => this.workflowQueue("QA_REVIEW"),
      },
      {
        key: "workflow-verification",
        label: "Verification",
        roles: ["verification_manager", "admin"],
        run: () => this.workflowQueue("VERIFICATION_PENDING"),
      },
      {
        key: "service-complaint",
        label: "Service Complaints",
        roles: ["service_manager", "admin"],
        run: () => this.serviceComplaints(),
      },
    ];
  }

  /**
   * All pending approvals visible to the actor. Each source is isolated: a
   * single failing adapter logs and yields no rows rather than failing the
   * whole dashboard. Optionally filtered to one module.
   */
  static async getPendingApprovals(
    actor: ApprovalActor,
    opts?: { module?: string },
  ): Promise<PendingApprovalItem[]> {
    const roles = this.actorRoles(actor);
    const visible = this.sources().filter((s) => this.canView(roles, s));
    const settled = await Promise.allSettled(visible.map((s) => s.run(actor)));
    const items: PendingApprovalItem[] = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        items.push(...res.value);
      } else {
        console.error(`[ApprovalVisibilityService] source '${visible[i].key}' failed:`, res.reason);
      }
    });
    const filtered = opts?.module ? items.filter((it) => it.module === opts.module) : items;
    return filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  /** Counts per module + per stage + total, scoped to what the actor can see. */
  static async getSummary(actor: ApprovalActor) {
    const items = await this.getPendingApprovals(actor);
    const byModule: Record<string, { label: string; count: number }> = {};
    const byStage: Record<string, number> = {};
    for (const it of items) {
      byModule[it.module] = byModule[it.module] || { label: it.moduleLabel, count: 0 };
      byModule[it.module].count += 1;
      byStage[it.stage] = (byStage[it.stage] || 0) + 1;
    }
    return {
      total: items.length,
      byModule: Object.entries(byModule).map(([module, v]) => ({
        module,
        label: v.label,
        count: v.count,
      })),
      byStage: Object.entries(byStage).map(([stage, count]) => ({ stage, count })),
    };
  }

  /**
   * Detail for one approval entity: the module's own audit history plus the
   * cross-department ledger. Read-only; delegates history to existing services.
   */
  static async getDetail(actor: ApprovalActor, module: string, entityId: string) {
    // Authorization: only actors who may view this module's approvals may read
    // its audit/cross-department trail. Without this any authenticated user
    // could enumerate other modules' history by entity id (IDOR).
    if (!this.canViewModule(this.actorRoles(actor), module)) {
      const err: any = new Error("Not allowed to view this approval");
      err.status = 403;
      throw err;
    }

    const entityType =
      module === "invoice" || module === "pms-project"
        ? "invoice"
        : module === "product-posting" || module === "software"
          ? "workflow"
          : module === "service-complaint"
            ? "service_complaint"
            : module;

    let auditHistory: any[] = [];
    if (module === "invoice" || module === "pms-project") {
      try {
        auditHistory = await InvoiceWorkflowService.history(entityId);
      } catch (err) {
        console.error("[ApprovalVisibilityService] invoice history failed:", err);
      }
    } else {
      try {
        auditHistory = await AuditLogService.getHistory(entityType, entityId);
      } catch (err) {
        console.error("[ApprovalVisibilityService] audit history failed:", err);
      }
    }

    const crossDepartmentHistory = await CrossDepartmentStatusService.getHistoryForEntity(
      entityType,
      entityId,
    );
    return { module, entityType, entityId, auditHistory, crossDepartmentHistory };
  }
}

export default ApprovalVisibilityService;
