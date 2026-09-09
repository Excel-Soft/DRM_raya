/**
 * Patch 6 Stage 4 — PMS transition service.
 *
 * Central, single chokepoint for PMS task/project status changes. Before this
 * service the two PMS status endpoints (`PATCH /api/pms/task/:id/status` and
 * `PATCH /api/pms/running-projects/:id/status`) wrote status ad hoc, with no
 * shared legal-transition map, audit, or notification. This service mirrors the
 * style of `workflow-transition.service.ts` (a `*TransitionError` carrying an
 * HTTP `status` + `code`, a `mapPmsError` response helper, and orchestrator
 * methods that own history/audit/notify).
 *
 * SAFETY: the service is PERMISSIVE BY DEFAULT. With the default config every
 * HTTP outcome is byte-for-byte identical to the legacy endpoints:
 *   - task status: owner/assignee permission preserved via
 *     `tasksRepository.updateStatus` (same 403 message); status history still
 *     recorded; same 200 body (the updated task).
 *   - project status: no enum validation and no role restriction (legacy
 *     behaviour); same 404 / 200 bodies.
 * Stricter behaviour (canonical-transition enforcement, required reason/evidence/
 * remarks, manager/admin acting) is OPT-IN via env flags with safe `false`
 * defaults, so turning any of them on is an explicit, reversible config change.
 *
 * No schema change. No new table. Audit reuses `AuditLogService` (→
 * `drm.activity_logs`); notifications reuse `NotificationService`. Both are
 * best-effort and never throw to the caller.
 */
import type { Request } from "express";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import { isManagerialRole } from "../utils/role-utils";
import { tasksRepository } from "../repositories/tasks.repository";
import { projectsRepository } from "../repositories/projects.repository";
import { taskStatusHistoryRepository } from "../repositories/task-status-history.repository";

// ---------------------------------------------------------------------------
// Config — env-overridable flags with safe defaults that preserve behaviour.
// Same pattern as `WORKFLOW_REWORK_ESCALATION_COUNT` in workflow-transition.
// ---------------------------------------------------------------------------
function envFlag(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return def;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

/** Enforce the canonical transition map + manager/admin guard on projects. */
export const PMS_STRICT_TRANSITIONS = envFlag("PMS_STRICT_TRANSITIONS", false);
/** Require a reason when a task is moved to Blocked (returned). */
export const PMS_REQUIRE_RETURN_REASON = envFlag("PMS_REQUIRE_RETURN_REASON", false);
/** Require at least one evidence entry when submitting a task for review. */
export const PMS_REQUIRE_SUBMIT_EVIDENCE = envFlag("PMS_REQUIRE_SUBMIT_EVIDENCE", false);
/** Require completion remarks when a task is moved to Completed. */
export const PMS_REQUIRE_COMPLETE_REMARKS = envFlag("PMS_REQUIRE_COMPLETE_REMARKS", false);
/** Allow a manager/admin (not owner/assignee) to change a task's status. */
export const PMS_ALLOW_MANAGER_ACT = envFlag("PMS_ALLOW_MANAGER_ACT", false);

// ---------------------------------------------------------------------------
// State model
// ---------------------------------------------------------------------------
export const PMS_TASK_STATUSES = [
  "ToDo",
  "InProgress",
  "Blocked",
  "Completed",
  "READY_FOR_QA",
  "IN_EXECUTION",
] as const;
export type PmsTaskStatus = (typeof PMS_TASK_STATUSES)[number];

export const PMS_PROJECT_STATUSES = [
  "Active",
  "Completed",
  "OnHold",
  "READY_FOR_QA",
  "IN_EXECUTION",
] as const;
export type PmsProjectStatus = (typeof PMS_PROJECT_STATUSES)[number];

/**
 * The 10 logical PMS lifecycle states from the spec, mapped onto the EXISTING
 * task-status enum (no schema change). Several logical states collapse onto one
 * stored value (e.g. CREATED + ASSIGNED both persist as `ToDo`); the richer
 * state is recoverable from the task-status history + audit trail.
 */
export type PmsLogicalState =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "COMPLETED"
  | "REOPENED"
  | "ARCHIVED";

export const PMS_LOGICAL_TO_TASK_STATUS: Record<PmsLogicalState, PmsTaskStatus> = {
  CREATED: "ToDo",
  ASSIGNED: "ToDo",
  IN_PROGRESS: "InProgress",
  BLOCKED: "Blocked",
  REVIEW: "READY_FOR_QA",
  RETURNED: "Blocked",
  APPROVED: "READY_FOR_QA",
  COMPLETED: "Completed",
  REOPENED: "ToDo",
  ARCHIVED: "Completed",
};

/** Canonical legal task transitions (superset; only enforced in strict mode). */
export const PMS_TASK_TRANSITIONS: Record<PmsTaskStatus, readonly PmsTaskStatus[]> = {
  ToDo: ["InProgress", "Blocked", "IN_EXECUTION", "READY_FOR_QA", "Completed"],
  InProgress: ["ToDo", "Blocked", "IN_EXECUTION", "READY_FOR_QA", "Completed"],
  IN_EXECUTION: ["ToDo", "InProgress", "Blocked", "READY_FOR_QA", "Completed"],
  Blocked: ["ToDo", "InProgress", "IN_EXECUTION", "READY_FOR_QA", "Completed"],
  READY_FOR_QA: ["ToDo", "InProgress", "Blocked", "Completed"],
  Completed: ["ToDo", "InProgress"],
};

/** Canonical legal project transitions (superset; only enforced in strict mode). */
export const PMS_PROJECT_TRANSITIONS: Record<PmsProjectStatus, readonly PmsProjectStatus[]> = {
  Active: ["OnHold", "IN_EXECUTION", "READY_FOR_QA", "Completed"],
  OnHold: ["Active", "IN_EXECUTION", "READY_FOR_QA", "Completed"],
  IN_EXECUTION: ["Active", "OnHold", "READY_FOR_QA", "Completed"],
  READY_FOR_QA: ["Active", "OnHold", "IN_EXECUTION", "Completed"],
  Completed: ["Active", "IN_EXECUTION"],
};

export function isLegalTaskTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = PMS_TASK_TRANSITIONS[from as PmsTaskStatus];
  return !!allowed && allowed.includes(to as PmsTaskStatus);
}

export function isLegalProjectTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = PMS_PROJECT_TRANSITIONS[from as PmsProjectStatus];
  return !!allowed && allowed.includes(to as PmsProjectStatus);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------
export class PmsTransitionError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "PMS_TRANSITION_REJECTED") {
    super(message);
    this.name = "PmsTransitionError";
    this.status = status;
    this.code = code;
  }
}

/** Map a thrown error onto an HTTP response. Returns true if it handled it. */
export function mapPmsError(res: any, error: unknown): boolean {
  if (error instanceof PmsTransitionError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export interface PmsTaskTransitionContext {
  from: string | null;
  to: string;
  strict?: boolean;
  reason?: string | null;
  evidenceCount?: number;
  remarks?: string | null;
}

/**
 * Validate a task transition. In permissive mode (default) this never rejects a
 * legacy move — non-canonical transitions only produce warnings. Content rules
 * (reason/evidence/remarks) are enforced only when their flag is on (or strict).
 * Throws `PmsTransitionError` when a rule is violated.
 */
export function validateTaskTransition(ctx: PmsTaskTransitionContext): { warnings: string[] } {
  const strict = ctx.strict ?? PMS_STRICT_TRANSITIONS;
  const warnings: string[] = [];
  const from = ctx.from ?? null;
  const to = ctx.to;

  if (!(PMS_TASK_STATUSES as readonly string[]).includes(to)) {
    throw new PmsTransitionError(`Invalid task status: "${to}".`, 400, "PMS_INVALID_STATUS");
  }

  const legal = from == null || isLegalTaskTransition(from, to);
  if (!legal) {
    if (strict) {
      throw new PmsTransitionError(
        `Illegal PMS task transition: ${from} → ${to}.`,
        400,
        "PMS_ILLEGAL_TRANSITION",
      );
    }
    warnings.push(`Non-canonical PMS task transition ${from} → ${to} (permitted in permissive mode).`);
  }

  // Returning a task (→ Blocked) needs a reason when required.
  if (to === "Blocked" && (PMS_REQUIRE_RETURN_REASON || strict) && !(ctx.reason && ctx.reason.trim())) {
    throw new PmsTransitionError(
      "A reason is required to block/return a task.",
      400,
      "PMS_REASON_REQUIRED",
    );
  }

  // Submitting for review (→ READY_FOR_QA) needs evidence when required.
  if (to === "READY_FOR_QA" && PMS_REQUIRE_SUBMIT_EVIDENCE && (ctx.evidenceCount ?? 0) < 1) {
    throw new PmsTransitionError(
      "At least one evidence entry is required to submit a task for review.",
      400,
      "PMS_EVIDENCE_REQUIRED",
    );
  }

  // Completing a task needs remarks when required.
  if (to === "Completed" && PMS_REQUIRE_COMPLETE_REMARKS && !(ctx.remarks && ctx.remarks.trim())) {
    throw new PmsTransitionError(
      "Completion remarks are required.",
      400,
      "PMS_REMARKS_REQUIRED",
    );
  }

  return { warnings };
}

// ---------------------------------------------------------------------------
// Orchestrators
// ---------------------------------------------------------------------------
export interface ChangeStatusResult<T> {
  success: boolean;
  status?: number;
  error?: string;
  code?: string;
  task?: T;
  project?: T;
  fromStatus?: string | null;
  warnings?: string[];
}

function firstRole(roles?: readonly string[] | null): string | undefined {
  return (roles && roles.find((r) => !!r)) || undefined;
}

function anyManagerial(roles?: readonly string[] | null): boolean {
  return (roles ?? []).some((r) => isManagerialRole(r));
}

export interface ChangeTaskStatusInput {
  taskId: string;
  toStatus: string;
  actorUserId: string;
  actorRoles?: readonly string[] | null;
  reason?: string | null;
  evidenceCount?: number;
  remarks?: string | null;
  notes?: string | null;
  req?: Request;
}

/**
 * Change a PMS task's status through the central machine. Preserves the legacy
 * owner/assignee permission model (via `tasksRepository.updateStatus`) and the
 * legacy 403 message by default. Records status history (best-effort, as the old
 * route did) plus audit + notification (best-effort, never throws).
 */
export async function changeTaskStatus(
  input: ChangeTaskStatusInput,
): Promise<ChangeStatusResult<any>> {
  // Best-effort pre-read for fromStatus / history / notification ONLY. As in the
  // legacy route we DO NOT branch on this: `findById` inner-joins the owner row,
  // so a null-owner task reads as undefined here, yet the legacy route still
  // succeeded because `tasksRepository.updateStatus` selects the task directly.
  // updateStatus therefore remains the sole existence + permission authority on
  // the default path.
  const task = await tasksRepository.findById(input.taskId);
  const fromStatus = (task as any)?.status ?? null;

  let warnings: string[] = [];
  try {
    ({ warnings } = validateTaskTransition({
      from: fromStatus,
      to: input.toStatus,
      reason: input.reason,
      evidenceCount: input.evidenceCount,
      remarks: input.remarks,
    }));
  } catch (e) {
    if (e instanceof PmsTransitionError) {
      return { success: false, status: e.status, error: e.message, code: e.code };
    }
    throw e;
  }

  const managerAllowed = PMS_ALLOW_MANAGER_ACT && anyManagerial(input.actorRoles);
  const isOwnerOrAssignee =
    (task as any)?.ownerUserId === input.actorUserId ||
    (task as any)?.assignedToUserId === input.actorUserId;

  let updated: any;
  if (!managerAllowed || isOwnerOrAssignee) {
    // DEFAULT path = EXACT legacy behaviour. `updateStatus` is the authority: it
    // returns {success:false, error:"Task not found"} for a missing task and the
    // owner/assignee message otherwise — the legacy route mapped BOTH to HTTP
    // 403, so we do the same (a missing task is 403 "Task not found", never 404).
    const result = await tasksRepository.updateStatus(input.taskId, input.toStatus, input.actorUserId);
    if (!result.success) return { success: false, status: 403, error: result.error };
    updated = result.task;
  } else {
    // Manager/admin override (opt-in via PMS_ALLOW_MANAGER_ACT) acting on a task
    // they neither own nor are assigned to. Confirm existence first.
    if (!task) return { success: false, status: 404, error: "Task not found" };
    updated = await tasksRepository.update(input.taskId, { status: input.toStatus as any });
  }

  // Status history (best-effort) — same behaviour the legacy route had.
  if (fromStatus && updated?.status && fromStatus !== updated.status) {
    try {
      await taskStatusHistoryRepository.create({
        taskId: input.taskId,
        userId: input.actorUserId,
        fromStatus,
        toStatus: updated.status,
        changedAt: new Date(),
        notes: input.notes ?? null,
      } as any);
    } catch (err) {
      console.error("[PmsTransitionService] Failed to record task status history", err);
    }
  }

  // Audit (best-effort; must never break the committed status change).
  try {
    await AuditLogService.record({
      actorUserId: input.actorUserId,
      actorRole: firstRole(input.actorRoles),
      action: "PMS_TASK_STATUS_CHANGED",
      module: "pms",
      entityType: "task",
      entityId: input.taskId,
      previousStatus: fromStatus ?? undefined,
      nextStatus: updated?.status ?? input.toStatus,
      reason: input.reason ?? undefined,
      after: warnings.length ? { warnings } : undefined,
      req: input.req,
    });
  } catch (err) {
    console.error("[PmsTransitionService] task audit failed", err);
  }

  // Notify the counterparty (best-effort).
  await notifyTaskCounterparty(task, updated, input.actorUserId);

  return { success: true, task: updated, fromStatus, warnings };
}

async function notifyTaskCounterparty(task: any, updated: any, actorUserId: string): Promise<void> {
  try {
    const recipients = new Set<string>();
    if (task?.ownerUserId && task.ownerUserId !== actorUserId) recipients.add(task.ownerUserId);
    if (task?.assignedToUserId && task.assignedToUserId !== actorUserId) {
      recipients.add(task.assignedToUserId);
    }
    if (recipients.size === 0) return;
    const label = task?.title ? `"${task.title}"` : "A task";
    const newStatus = updated?.status ?? "";
    for (const userId of Array.from(recipients)) {
      await NotificationService.notify({
        userId,
        message: `${label} status changed to ${newStatus}.`,
        type: "INFO",
        targetUrl: "/pms",
      });
    }
  } catch (err) {
    console.error("[PmsTransitionService] task notify failed", err);
  }
}

export interface ChangeProjectStatusInput {
  projectId: string;
  toStatus: string;
  actorUserId: string;
  actorRoles?: readonly string[] | null;
  reason?: string | null;
  req?: Request;
}

/**
 * Change a PMS running-project's status through the central machine. The legacy
 * endpoint had NO enum validation and NO role restriction, so the permissive
 * default keeps both (any authenticated caller, any status string). Strict mode
 * adds enum validation, canonical-transition enforcement, and a manager/admin
 * guard. Audit is recorded best-effort either way.
 */
export async function changeProjectStatus(
  input: ChangeProjectStatusInput,
): Promise<ChangeStatusResult<any>> {
  const project = await projectsRepository.findById(input.projectId);
  if (!project) return { success: false, status: 404, error: "Project not found" };

  const fromStatus = (project as any).status ?? null;
  const warnings: string[] = [];

  if (PMS_STRICT_TRANSITIONS) {
    if (!(PMS_PROJECT_STATUSES as readonly string[]).includes(input.toStatus)) {
      return {
        success: false,
        status: 400,
        error: `Invalid project status: "${input.toStatus}".`,
        code: "PMS_INVALID_STATUS",
      };
    }
    if (fromStatus && !isLegalProjectTransition(fromStatus, input.toStatus)) {
      return {
        success: false,
        status: 400,
        error: `Illegal PMS project transition: ${fromStatus} → ${input.toStatus}.`,
        code: "PMS_ILLEGAL_TRANSITION",
      };
    }
    if (!anyManagerial(input.actorRoles)) {
      return {
        success: false,
        status: 403,
        error: "Only a manager or admin can change project status.",
        code: "PMS_ROLE_FORBIDDEN",
      };
    }
  } else if (fromStatus && !isLegalProjectTransition(fromStatus, input.toStatus)) {
    warnings.push(
      `Non-canonical PMS project transition ${fromStatus} → ${input.toStatus} (permitted in permissive mode).`,
    );
  }

  const updated = await projectsRepository.update(input.projectId, { status: input.toStatus });

  // Audit (best-effort; must never break the committed status change).
  try {
    await AuditLogService.record({
      actorUserId: input.actorUserId,
      actorRole: firstRole(input.actorRoles),
      action: "PMS_PROJECT_STATUS_CHANGED",
      module: "pms",
      entityType: "project",
      entityId: input.projectId,
      previousStatus: fromStatus ?? undefined,
      nextStatus: (updated as any)?.status ?? input.toStatus,
      reason: input.reason ?? undefined,
      after: warnings.length ? { warnings } : undefined,
      req: input.req,
    });
  } catch (err) {
    console.error("[PmsTransitionService] project audit failed", err);
  }

  return { success: true, project: updated, fromStatus, warnings };
}

export const PmsTransitionService = {
  changeTaskStatus,
  changeProjectStatus,
  validateTaskTransition,
  isLegalTaskTransition,
  isLegalProjectTransition,
  mapPmsError,
  PmsTransitionError,
};

export default PmsTransitionService;
