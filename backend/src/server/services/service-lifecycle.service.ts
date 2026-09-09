/**
 * Patch 6 Stage 5 — Service lifecycle state machine.
 *
 * Central, single chokepoint for changing a service customer's lifecycle status.
 * Mirrors the style of `pms-transition.service.ts`: a `*Error` carrying an HTTP
 * `status` + `code`, a `mapServiceLifecycleError` response helper, legal
 * transition maps, and an orchestrator that owns the status write + audit +
 * notification.
 *
 * SAFETY: PERMISSIVE BY DEFAULT. With the default config the machine never
 * rejects a status change — non-canonical transitions only produce warnings, and
 * every content rule (reason on closure / dropout / recovery / escalation) is
 * OFF. Stricter behaviour is OPT-IN via env flags with safe `false` defaults, so
 * turning any of them on is an explicit, reversible config change.
 *
 * WIRING: there is currently NO HTTP endpoint that mutates
 * `service_customers.status` (the status is set at import/creation only — see
 * SERVICE_LIFECYCLE_STATE_MACHINE.md). This module is therefore the central,
 * reusable authority ready to back any future status endpoint; because nothing is
 * wired to it today, no current HTTP outcome changes. `changeServiceCustomerStatus`
 * performs the write itself (raw SQL; `db:push` is broken) when a caller invokes it.
 *
 * No schema change, no new table. Audit reuses `AuditLogService` (→
 * `drm.activity_logs`); notifications reuse `NotificationService`. Both are
 * best-effort and never throw to the caller.
 */
import type { Request } from "express";
import { pool } from "../db";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import { isManagerialRole } from "../utils/role-utils";

// ---------------------------------------------------------------------------
// Config — env-overridable flags with safe defaults that preserve behaviour.
// ---------------------------------------------------------------------------
function envFlag(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return def;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

/** Enforce the canonical transition map + manager/admin guard. */
export const SERVICE_LIFECYCLE_STRICT = envFlag("SERVICE_LIFECYCLE_STRICT", false);
/** Require a reason when a service customer is closed. */
export const SERVICE_REQUIRE_CLOSURE_REASON = envFlag("SERVICE_REQUIRE_CLOSURE_REASON", false);
/** Require a reason when a service customer is marked dropout. */
export const SERVICE_REQUIRE_DROPOUT_REASON = envFlag("SERVICE_REQUIRE_DROPOUT_REASON", false);
/** Require a reason when recovering a dropout (dropout → active). */
export const SERVICE_REQUIRE_RECOVERY_REASON = envFlag("SERVICE_REQUIRE_RECOVERY_REASON", false);
/** Require a reason when escalating (logical ESCALATED action). */
export const SERVICE_REQUIRE_ESCALATION_REASON = envFlag("SERVICE_REQUIRE_ESCALATION_REASON", false);

// ---------------------------------------------------------------------------
// State model
// ---------------------------------------------------------------------------
/** Stored status enum — mirrors `drm.service_customer_status` EXACTLY. */
export const SERVICE_CUSTOMER_STATUSES = [
  "active",
  "expiring",
  "expired",
  "renewed",
  "upgraded",
  "dropout",
  "closed",
] as const;
export type ServiceCustomerStatus = (typeof SERVICE_CUSTOMER_STATUSES)[number];

/**
 * The 12 logical lifecycle states from the spec, mapped onto the EXISTING stored
 * status enum (no schema change). Several logical states collapse onto one stored
 * value (e.g. ASSIGNED/CONTACTED/FOLLOW_UP_DUE/COMPLAINT_RAISED/ESCALATED/
 * RESOLVED/RECOVERED all persist as `active`); the richer operational state is
 * recoverable from the follow-up / complaint / dropout sub-records + audit trail.
 */
export type ServiceLogicalState =
  | "ASSIGNED"
  | "CONTACTED"
  | "FOLLOW_UP_DUE"
  | "COMPLAINT_RAISED"
  | "ESCALATED"
  | "RESOLVED"
  | "RENEWAL_DUE"
  | "RENEWED"
  | "DROPOUT_RISK"
  | "DROPOUT_CONFIRMED"
  | "RECOVERED"
  | "CLOSED";

export const SERVICE_LOGICAL_TO_STATUS: Record<ServiceLogicalState, ServiceCustomerStatus> = {
  ASSIGNED: "active",
  CONTACTED: "active",
  FOLLOW_UP_DUE: "active",
  COMPLAINT_RAISED: "active",
  ESCALATED: "active",
  RESOLVED: "active",
  RENEWAL_DUE: "expiring",
  RENEWED: "renewed",
  DROPOUT_RISK: "expiring",
  DROPOUT_CONFIRMED: "dropout",
  RECOVERED: "active",
  CLOSED: "closed",
};

/**
 * Canonical legal stored-status transitions (superset; only ENFORCED in strict
 * mode). In permissive mode an out-of-map move is allowed but warned.
 */
export const SERVICE_STATUS_TRANSITIONS: Record<ServiceCustomerStatus, readonly ServiceCustomerStatus[]> = {
  active: ["expiring", "expired", "renewed", "upgraded", "dropout", "closed"],
  expiring: ["active", "expired", "renewed", "upgraded", "dropout", "closed"],
  expired: ["active", "renewed", "upgraded", "dropout", "closed"],
  renewed: ["active", "expiring", "expired", "upgraded", "dropout", "closed"],
  upgraded: ["active", "expiring", "expired", "renewed", "dropout", "closed"],
  dropout: ["active", "closed"],
  closed: ["active"],
};

export function isLegalServiceTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = SERVICE_STATUS_TRANSITIONS[from as ServiceCustomerStatus];
  return !!allowed && allowed.includes(to as ServiceCustomerStatus);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------
export class ServiceLifecycleError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "SERVICE_LIFECYCLE_REJECTED") {
    super(message);
    this.name = "ServiceLifecycleError";
    this.status = status;
    this.code = code;
  }
}

/** Map a thrown error onto an HTTP response. Returns true if it handled it. */
export function mapServiceLifecycleError(res: any, error: unknown): boolean {
  if (error instanceof ServiceLifecycleError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export interface ServiceTransitionContext {
  from: string | null;
  to: string;
  strict?: boolean;
  /** Logical action driving the change (informs which reason rule applies). */
  action?: ServiceLogicalState;
  reason?: string | null;
}

/**
 * Validate a service-customer status transition. In permissive mode (default)
 * this never rejects a legacy move — non-canonical transitions only produce
 * warnings. Content rules (reason on closure/dropout/recovery/escalation) are
 * enforced only when their flag is on (or strict). Throws `ServiceLifecycleError`.
 */
export function validateServiceTransition(ctx: ServiceTransitionContext): { warnings: string[] } {
  const strict = ctx.strict ?? SERVICE_LIFECYCLE_STRICT;
  const warnings: string[] = [];
  const from = ctx.from ?? null;
  const to = ctx.to;

  if (!(SERVICE_CUSTOMER_STATUSES as readonly string[]).includes(to)) {
    throw new ServiceLifecycleError(`Invalid service status: "${to}".`, 400, "SERVICE_INVALID_STATUS");
  }

  const legal = from == null || isLegalServiceTransition(from, to);
  if (!legal) {
    if (strict) {
      throw new ServiceLifecycleError(
        `Illegal service lifecycle transition: ${from} → ${to}.`,
        400,
        "SERVICE_ILLEGAL_TRANSITION",
      );
    }
    warnings.push(`Non-canonical service transition ${from} → ${to} (permitted in permissive mode).`);
  }

  const hasReason = !!(ctx.reason && ctx.reason.trim());

  // Closure needs a reason when required.
  if (to === "closed" && (SERVICE_REQUIRE_CLOSURE_REASON || strict) && !hasReason) {
    throw new ServiceLifecycleError("A reason is required to close a service customer.", 400, "SERVICE_REASON_REQUIRED");
  }
  // Dropout needs a reason when required.
  if (to === "dropout" && (SERVICE_REQUIRE_DROPOUT_REASON || strict) && !hasReason) {
    throw new ServiceLifecycleError("A reason is required to mark a service customer as dropout.", 400, "SERVICE_REASON_REQUIRED");
  }
  // Recovery (dropout → active) needs a reason when required.
  if (from === "dropout" && to === "active" && (SERVICE_REQUIRE_RECOVERY_REASON || strict) && !hasReason) {
    throw new ServiceLifecycleError("A reason is required to recover a dropout.", 400, "SERVICE_REASON_REQUIRED");
  }
  // Escalation (logical) needs a reason when required.
  if (ctx.action === "ESCALATED" && (SERVICE_REQUIRE_ESCALATION_REASON || strict) && !hasReason) {
    throw new ServiceLifecycleError("A reason is required to escalate.", 400, "SERVICE_REASON_REQUIRED");
  }

  return { warnings };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
export interface ChangeServiceStatusResult {
  success: boolean;
  status?: number;
  error?: string;
  code?: string;
  serviceCustomer?: any;
  fromStatus?: string | null;
  warnings?: string[];
}

export interface ChangeServiceStatusInput {
  serviceCustomerId: string;
  toStatus: string;
  actorUserId: string;
  actorRole?: string | null;
  action?: ServiceLogicalState;
  reason?: string | null;
  req?: Request;
}

/**
 * Change a service customer's status through the central machine. Validates
 * (permissive by default), writes the status via raw SQL, records the
 * `status_changed_at` stamp, and emits audit + a best-effort notification to the
 * assignee. Returns a structured result; the caller maps it to HTTP.
 */
export async function changeServiceCustomerStatus(
  input: ChangeServiceStatusInput,
): Promise<ChangeServiceStatusResult> {
  // Pre-read current status (existence + fromStatus + assignee for notify).
  const { rows: current } = await pool.query<{ status: string; assignedTo: string | null }>(
    `SELECT status, assigned_to AS "assignedTo" FROM drm.service_customers WHERE id = $1 LIMIT 1`,
    [input.serviceCustomerId],
  );
  if (current.length === 0) {
    return { success: false, status: 404, error: "Service customer not found" };
  }
  const fromStatus = current[0].status ?? null;

  let warnings: string[] = [];
  try {
    ({ warnings } = validateServiceTransition({
      from: fromStatus,
      to: input.toStatus,
      action: input.action,
      reason: input.reason,
    }));
  } catch (e) {
    if (e instanceof ServiceLifecycleError) {
      return { success: false, status: e.status, error: e.message, code: e.code };
    }
    throw e;
  }

  // Strict mode adds a manager/admin guard (permissive default = any actor).
  if (SERVICE_LIFECYCLE_STRICT && !isManagerialRole(input.actorRole ?? undefined)) {
    return {
      success: false,
      status: 403,
      error: "Only a manager or admin can change a service customer's status.",
      code: "SERVICE_ROLE_FORBIDDEN",
    };
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE drm.service_customers
        SET status = $2::drm.service_customer_status,
            status_changed_at = now(),
            updated_by = $3,
            updated_at = now()
      WHERE id = $1
      RETURNING id, status, assigned_to AS "assignedTo"`,
    [input.serviceCustomerId, input.toStatus, input.actorUserId],
  );
  const updated = updatedRows[0];

  // Audit (best-effort; must never break the committed status change).
  try {
    await AuditLogService.record({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole ?? undefined,
      action: "SERVICE_CUSTOMER_STATUS_CHANGED",
      module: "service",
      entityType: "service_customer",
      entityId: input.serviceCustomerId,
      previousStatus: fromStatus ?? undefined,
      nextStatus: updated?.status ?? input.toStatus,
      reason: input.reason ?? undefined,
      after: warnings.length ? { warnings, logicalAction: input.action } : { logicalAction: input.action },
      req: input.req,
    });
  } catch (err) {
    console.error("[ServiceLifecycle] audit failed", err);
  }

  // Notify the assignee (best-effort).
  try {
    const assignee = updated?.assignedTo ?? current[0].assignedTo;
    if (assignee && assignee !== input.actorUserId) {
      await NotificationService.notify({
        userId: assignee,
        message: `A service customer's status changed to ${updated?.status ?? input.toStatus}.`,
        type: "INFO",
        targetUrl: "/service",
      });
    }
  } catch (err) {
    console.error("[ServiceLifecycle] notify failed", err);
  }

  return { success: true, serviceCustomer: updated, fromStatus, warnings };
}

export const ServiceLifecycleService = {
  changeServiceCustomerStatus,
  validateServiceTransition,
  isLegalServiceTransition,
  mapServiceLifecycleError,
  SERVICE_CUSTOMER_STATUSES,
  SERVICE_LOGICAL_TO_STATUS,
  SERVICE_STATUS_TRANSITIONS,
  ServiceLifecycleError,
};

export default ServiceLifecycleService;
