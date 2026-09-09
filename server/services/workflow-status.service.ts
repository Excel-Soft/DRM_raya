import type { Request } from "express";
import type { PoolClient } from "pg";
import { withPgTransaction } from "../utils/financial-transaction";
import { ApiError } from "../utils/api-error";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import { normalizeRole } from "../utils/role-utils";
import {
  GM_LEGAL_TRANSITIONS,
  INVOICE_LEGAL_TRANSITIONS,
  WORKFLOW_ENTITY_TYPES,
  isLegalTransition,
  nextLegalStatuses,
  type WorkflowEntityType,
} from "../../shared/gm-sales-constants";

/**
 * WorkflowStatusService — Patch 5 Stage 6 (P14).
 *
 * The ONE place every cross-module workflow transition (GM, invoice, project,
 * QA, verification) is validated, recorded and coordinated. It is an
 * ORCHESTRATOR, not a rewrite: it OWNS the cross-cutting concerns —
 *
 *   1. legal-transition validation (shared maps; illegal => 400 BEFORE any write)
 *   2. role / reason / evidence policy (wrong role => 403; missing reason => 400)
 *   3. the transaction boundary (a single raw-pg client)
 *   4. the append-only `workflow_status_history` ledger (written IN the tx)
 *   5. best-effort audit (activity_logs) + notifications (AFTER commit)
 *
 * — but DELEGATES the entity-specific write to a caller-supplied `execute(client)`
 * executor. The executor MUST perform every state-changing statement on the
 * provided `client` so that a failure rolls back the entity write AND the
 * history row together. Work done through the global `db`/`pool` is NOT covered
 * by the transaction and must not be claimed as atomic.
 *
 * Validation runs BEFORE the transaction opens, so an illegal transition or a
 * permission failure never touches a row.
 */

export interface WorkflowActor {
  userId: string;
  roleId?: string;
  activeRoleId?: string;
  roles?: string[];
}

/** What a delegated executor returns after performing the entity write. */
export interface WorkflowExecuteResult<E = unknown> {
  /** Authoritative status the entity moved FROM (read inside the tx). */
  previousStatus: string;
  /** Authoritative status the entity moved TO. */
  nextStatus: string;
  /** The updated entity row, surfaced back to the route for its response. */
  updatedEntity?: E;
  /** Extra related entities touched (e.g. a generated project) for history. */
  related?: Array<{ entityType: string; entityId: string }>;
}

export interface WorkflowTransitionInput<E = unknown> {
  entityType: WorkflowEntityType;
  entityId: string;
  action: string;
  /** Current (expected) status used for legal-transition validation. */
  fromStatus: string;
  /** Target status used for legal-transition validation. */
  toStatus: string;
  actor: WorkflowActor;
  reason?: string;
  evidence?: unknown[];
  metadata?: Record<string, unknown>;
  /** Actor must hold one of these roles, else 403. Omit to skip role check. */
  requiredRoles?: string[];
  /** Reject (400) when no non-empty reason is supplied. */
  requireReason?: boolean;
  /** Reject (400) when no evidence entry is supplied. */
  requireEvidence?: boolean;
  /**
   * Override the legal-transition map. Defaults are derived from `entityType`
   * (GM / INVOICE). Entity types without a canonical map (PROJECT, QA, etc.)
   * must pass a map here to get strict validation, otherwise only role/reason
   * are enforced and the transition is recorded.
   */
  transitionMap?: Record<string, string[]>;
  /** Performs the entity write on the supplied tx client. */
  execute: (client: PoolClient) => Promise<WorkflowExecuteResult<E>>;
  /** Optional related entity recorded on the history row. */
  relatedEntity?: { entityType: string; entityId: string };
  /**
   * Optional notification fired AFTER commit. Default is OFF — supply this only
   * where the delegated service does NOT already notify, to avoid duplicates.
   */
  notify?: {
    message: string;
    type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
    recipientRoles?: string[];
    recipientUserIds?: string[];
    department?: string;
    targetUrl?: string;
    priority?: "low" | "normal" | "high";
  };
  module?: string;
  /**
   * Override the entityType used for the best-effort audit row ONLY (the
   * append-only history ledger always uses `entityType`). Lets a migrated module
   * keep writing its audit under its legacy entity type so existing audit /
   * history views keep finding the row. Defaults to `entityType`.
   */
  auditEntityType?: string;
  req?: Request;
}

export interface WorkflowTransitionResult<E = unknown> {
  ok: true;
  entityType: WorkflowEntityType;
  entityId: string;
  previousStatus: string;
  nextStatus: string;
  updatedEntity?: E;
  historyId: string;
  auditRecorded: boolean;
  notifiedCount: number;
  nextAllowedActions: string[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}

function actorRoles(actor: WorkflowActor): string[] {
  return [actor.activeRoleId, actor.roleId, ...(actor.roles || [])]
    .filter(Boolean)
    .map((r) => normalizeRole(r as string));
}

/** The role we attribute this action to (active role first). */
function primaryActorRole(actor: WorkflowActor): string | null {
  const roles = actorRoles(actor);
  return roles[0] ?? null;
}

function resolveTransitionMap(
  entityType: WorkflowEntityType,
  override?: Record<string, string[]>,
): Record<string, string[]> | null {
  if (override) return override;
  if (entityType === WORKFLOW_ENTITY_TYPES.GM) return GM_LEGAL_TRANSITIONS;
  if (entityType === WORKFLOW_ENTITY_TYPES.INVOICE) {
    return INVOICE_LEGAL_TRANSITIONS;
  }
  return null;
}

export class WorkflowStatusService {
  /**
   * Validate + execute + record a single workflow transition. See the class
   * docstring for the contract. Throws ApiError(400|403) on policy failures
   * (before any write); rethrows any executor error after the tx rolls back.
   */
  static async transition<E = unknown>(
    input: WorkflowTransitionInput<E>,
  ): Promise<WorkflowTransitionResult<E>> {
    const {
      entityType,
      entityId,
      action,
      fromStatus,
      toStatus,
      actor,
      reason,
      evidence,
      metadata,
      requiredRoles,
      requireReason,
      requireEvidence,
      transitionMap,
      execute,
      relatedEntity,
      notify,
      module,
      auditEntityType,
      req,
    } = input;

    // --- 1. Permission ------------------------------------------------------
    if (requiredRoles && requiredRoles.length > 0) {
      const held = new Set(actorRoles(actor));
      const ok = requiredRoles.some((r) => held.has(normalizeRole(r)));
      if (!ok) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Your role is not permitted to perform "${action}" on this ${entityType.toLowerCase()}`,
        );
      }
    }

    // --- 2. Reason / evidence policy ---------------------------------------
    if (requireReason && (!reason || !reason.trim())) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `A reason is required to perform "${action}"`,
      );
    }
    if (requireEvidence && (!evidence || evidence.length === 0)) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Supporting evidence is required to perform "${action}"`,
      );
    }

    // --- 3. Legal-transition validation (BEFORE any write) -----------------
    const map = resolveTransitionMap(entityType, transitionMap);
    if (map) {
      if (!map[fromStatus]) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `${entityType} is in an unknown status "${fromStatus}" and cannot be transitioned`,
        );
      }
      if (!isLegalTransition(map, fromStatus, toStatus)) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `Illegal ${entityType.toLowerCase()} transition: ${fromStatus} → ${toStatus}`,
        );
      }
    }

    const actorRole = primaryActorRole(actor);
    const actorUserId = isUuid(actor.userId) ? actor.userId : null;

    // --- 4. Execute the entity write + write history in ONE transaction ----
    const { execResult, historyId } = await withPgTransaction(async (client) => {
      const execResult = await execute(client);

      const historyRes = await client.query(
        `INSERT INTO drm.workflow_status_history
           (entity_type, entity_id, action, previous_status, next_status,
            actor_user_id, actor_role, reason, evidence,
            related_entity_type, related_entity_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6::uuid,$7,$8,$9::jsonb,$10,$11,$12::jsonb)
         RETURNING id`,
        [
          entityType,
          String(entityId),
          action,
          execResult.previousStatus ?? fromStatus,
          execResult.nextStatus ?? toStatus,
          actorUserId,
          actorRole,
          reason ?? null,
          JSON.stringify(evidence ?? []),
          relatedEntity?.entityType ?? null,
          relatedEntity?.entityId ?? null,
          JSON.stringify(metadata ?? {}),
        ],
      );

      return { execResult, historyId: historyRes.rows[0].id as string };
    });

    const previousStatus = execResult.previousStatus ?? fromStatus;
    const nextStatus = execResult.nextStatus ?? toStatus;

    // --- 5. Best-effort audit (activity_logs) — never blocks the result ----
    let auditRecorded = false;
    try {
      await AuditLogService.recordTransition({
        actorUserId: actor.userId,
        action,
        module: module ?? "workflow-status",
        entityType: auditEntityType ?? entityType,
        entityId: String(entityId),
        previousStatus,
        nextStatus,
        reason,
        after: { historyId, ...(execResult.related ? { related: execResult.related } : {}) },
        req,
      });
      auditRecorded = true;
    } catch (err) {
      console.error("[workflow-status] audit record failed (best-effort):", err);
    }

    // --- 6. Best-effort notification (opt-in only) -------------------------
    let notifiedCount = 0;
    if (notify) {
      try {
        notifiedCount = await NotificationService.notifyWorkflowTransition({
          message: notify.message,
          type: notify.type,
          recipientRoles: notify.recipientRoles,
          recipientUserIds: notify.recipientUserIds,
          department: notify.department,
          module: module ?? "workflow-status",
          entityType,
          entityId: String(entityId),
          targetUrl: notify.targetUrl,
          priority: notify.priority,
        });
      } catch (err) {
        console.error("[workflow-status] notify failed (best-effort):", err);
      }
    }

    return {
      ok: true,
      entityType,
      entityId,
      previousStatus,
      nextStatus,
      updatedEntity: execResult.updatedEntity,
      historyId,
      auditRecorded,
      notifiedCount,
      nextAllowedActions: map ? nextLegalStatuses(map, nextStatus) : [],
    };
  }
}

/** Functional entry point for the central transition (alias of the class method). */
export async function transitionWorkflowStatus<E = unknown>(
  input: WorkflowTransitionInput<E>,
): Promise<WorkflowTransitionResult<E>> {
  return WorkflowStatusService.transition<E>(input);
}

/**
 * Named alias kept for the GM-sales orchestration entry point referenced by the
 * Patch 5 plan. Identical to {@link transitionWorkflowStatus}.
 */
export const transitionGmSalesWorkflow = transitionWorkflowStatus;

export default WorkflowStatusService;
