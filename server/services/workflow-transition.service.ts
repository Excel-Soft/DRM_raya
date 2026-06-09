import { AuditLogService } from "./audit-log.service";
import { normalizeRole } from "../utils/role-utils";

/**
 * WorkflowTransitionService — the single, centralized authority that decides
 * whether a workflow phase change is allowed, and governs the cross-cutting
 * concerns of every transition (legal state machine, role/ownership guards,
 * rework escalation, structured routing, and error→HTTP mapping).
 *
 * Design notes
 * ------------
 * The Product Posting / D&D and Software lifecycles share an identical phase
 * set (see `shared/schema.ts` PRODUCT_POSTING_PHASE_KEYS / SOFTWARE_PHASE_KEYS).
 * They run on separate tables, so each module keeps a thin *executor*
 * (`transitionWorkflowByProject` / `transitionWorkflowByTask`) that owns its
 * Drizzle table access, but delegates the *decision* (is this transition legal,
 * is this actor allowed, is a reason required) to this service. That keeps a
 * single source of truth for the state machine without forcing one generic
 * table-agnostic writer.
 *
 * IMPORTANT: `WORKFLOW_TRANSITIONS` must remain a faithful *superset* of every
 * transition the routes/services actually perform. Adding a real transition in
 * a route without registering it here will cause a fail-closed 400. Conversely,
 * never widen the map to legalise a transition the business does not perform.
 */

export const WORKFLOW_PHASES = [
  "PENDING_PROJECT",
  "DATA_VERIFY",
  "PROJECT_OVERVIEW",
  "TASK_ASSIGNMENT",
  "RUNNING_PROJECT",
  "MANAGER_COMPLETE",
  "QA_REVIEW",
  "QA_COMPLETE",
  "VERIFICATION_PENDING",
  "VERIFICATION_COMPLETE",
  "RETURNED_FOR_CHANGE",
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

/** Phases that have no legal outgoing transition (other than an idempotent self-loop). */
export const TERMINAL_PHASES: ReadonlySet<string> = new Set(["VERIFICATION_COMPLETE"]);

/**
 * Rework escalation threshold. When a task is returned (QA or Verification) and
 * its cumulative return count reaches this value, the transition is flagged for
 * management escalation. Configurable via env so ops can tune it without a
 * code change; defaults to 3.
 */
export const WORKFLOW_REWORK_ESCALATION_COUNT: number = (() => {
  const raw = process.env.WORKFLOW_REWORK_ESCALATION_COUNT;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

type RoleSet = readonly string[] | null;

interface TransitionRule {
  /** Semantic action name used by callers (matches `action` passed to executors). */
  action: string;
  /** Legal source phases for this action. */
  from: readonly WorkflowPhase[];
  /** Resulting phase(s). Most actions resolve to a single phase. */
  to: readonly WorkflowPhase[];
  /**
   * Roles permitted to perform the action. `null` means "no role restriction at
   * this layer" — used for executive self-service actions (timer, submit,
   * evidence) whose access is governed by ownership + route-level requireRole.
   * `admin` is always permitted regardless of this list.
   */
  roles: RoleSet;
  /** A non-empty textual reason is mandatory (e.g. returns, rejections). */
  requireReason?: boolean;
  /** At least one evidence link is mandatory (e.g. executive submission). */
  requireEvidence?: boolean;
}

const MANAGER_ROLES = [
  "product_posting_manager",
  "dd_manager",
  "software_manager",
  "admin",
] as const;

/**
 * The canonical workflow state machine. One declarative table shared by both
 * modules. Self-loops (from === to) are always permitted for idempotent
 * re-saves and are intentionally not enumerated here.
 */
export const WORKFLOW_TRANSITIONS: readonly TransitionRule[] = [
  // ---- Intake / document handling -----------------------------------------
  {
    action: "DOCUMENT_UPLOADED",
    from: ["PENDING_PROJECT", "DATA_VERIFY", "PROJECT_OVERVIEW", "RETURNED_FOR_CHANGE"],
    to: ["PENDING_PROJECT", "DATA_VERIFY"],
    roles: null,
  },
  {
    action: "DOCUMENT_REJECTED",
    from: ["PENDING_PROJECT", "DATA_VERIFY", "PROJECT_OVERVIEW"],
    to: ["PENDING_PROJECT"],
    roles: [...MANAGER_ROLES, "qa_manager"],
    requireReason: true,
  },
  {
    action: "DATA_VERIFIED",
    from: ["PENDING_PROJECT", "DATA_VERIFY"],
    to: ["PROJECT_OVERVIEW"],
    roles: [...MANAGER_ROLES, "qa_manager"],
  },

  // ---- Assignment / execution ---------------------------------------------
  {
    action: "TASK_ASSIGNED",
    from: ["PROJECT_OVERVIEW", "TASK_ASSIGNMENT", "RETURNED_FOR_CHANGE", "RUNNING_PROJECT"],
    to: ["RUNNING_PROJECT"],
    roles: [...MANAGER_ROLES, "qa_manager"],
  },
  {
    action: "TIMER_STARTED",
    from: ["PROJECT_OVERVIEW", "TASK_ASSIGNMENT", "RUNNING_PROJECT", "RETURNED_FOR_CHANGE"],
    to: ["RUNNING_PROJECT"],
    roles: null,
  },
  {
    action: "EXTENSION_REQUESTED",
    from: ["RUNNING_PROJECT", "RETURNED_FOR_CHANGE"],
    to: ["RUNNING_PROJECT"],
    roles: null,
  },
  {
    action: "EXECUTIVE_SUBMITTED",
    from: ["RUNNING_PROJECT", "RETURNED_FOR_CHANGE"],
    to: ["RUNNING_PROJECT"],
    roles: null,
    requireEvidence: true,
  },

  // ---- Manager completion → QA --------------------------------------------
  {
    action: "MANAGER_COMPLETE",
    from: ["RUNNING_PROJECT", "MANAGER_COMPLETE"],
    to: ["QA_REVIEW"],
    roles: [...MANAGER_ROLES],
  },

  // ---- QA review ----------------------------------------------------------
  {
    action: "QA_COMPLETE",
    from: ["QA_REVIEW", "QA_COMPLETE"],
    to: ["VERIFICATION_PENDING"],
    roles: ["qa_manager", "admin"],
  },
  {
    action: "QA_RETURNED",
    from: ["QA_REVIEW"],
    to: ["RETURNED_FOR_CHANGE"],
    roles: ["qa_manager", "admin"],
    requireReason: true,
  },

  // ---- Verification -------------------------------------------------------
  {
    action: "VERIFICATION_COMPLETE",
    from: ["VERIFICATION_PENDING", "QA_COMPLETE"],
    to: ["VERIFICATION_COMPLETE"],
    roles: ["verification_manager", "admin"],
  },
  {
    action: "VERIFICATION_RETURNED",
    from: ["VERIFICATION_PENDING", "QA_COMPLETE"],
    to: ["QA_REVIEW"],
    roles: ["verification_manager", "admin"],
    requireReason: true,
  },
];

/**
 * Typed error for transition rejections. `status` carries the HTTP status the
 * route should surface: 400 for an illegal/invalid transition, 403 for a
 * role/ownership rejection. Carrying the status on the error lets every route
 * map rejections uniformly via `mapWorkflowError`.
 */
export class WorkflowTransitionError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "WORKFLOW_TRANSITION_REJECTED") {
    super(message);
    this.name = "WorkflowTransitionError";
    this.status = status;
    this.code = code;
  }
}

/** Find the single rule that governs an action. */
function findRuleByAction(action: string): TransitionRule | undefined {
  return WORKFLOW_TRANSITIONS.find((r) => r.action === action);
}

/**
 * True when `to` is reachable from `from`. Idempotent self-loops are always
 * legal. Otherwise at least one registered rule must permit `from → to`.
 */
export function isLegalTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return WORKFLOW_TRANSITIONS.some(
    (r) => r.from.includes(from as WorkflowPhase) && r.to.includes(to as WorkflowPhase),
  );
}

export interface TransitionContext {
  from: string;
  to: string;
  action: string;
  /** Single active role. Combined with `actorRoles` for the role guard. */
  actorRole?: string | null;
  /**
   * Full set of roles the actor holds (mirrors `req.user.roles`). The role guard
   * passes when ANY of these (or `actorRole`) is permitted — identical semantics
   * to the route-level `requireRole`, so threading roles here cannot introduce a
   * 403 that `requireRole` would not also produce.
   */
  actorRoles?: readonly string[] | null;
  /** Explicit ownership/scope result. `false` rejects with 403. Omit to skip. */
  ownershipSatisfied?: boolean;
  reason?: string | null;
  evidenceCount?: number;
  /**
   * Enforce content rules (required reason / required evidence). Defaults to
   * false so the module executors — which delegate state + role + ownership
   * governance here, but keep their own route-level reason/evidence checks —
   * are never falsely rejected. New callers that own the full transition should
   * pass `true` to get end-to-end validation.
   */
  enforceContent?: boolean;
  /**
   * Admin-only escape hatch to force an otherwise-illegal *state* transition.
   * Requires a reason and is audited by the caller. Never bypasses role checks
   * for non-admins.
   */
  override?: boolean;
}

/**
 * The core guard. Throws `WorkflowTransitionError` (400/403) when a transition
 * is not permitted, and returns silently when it is. Performs NO database
 * writes, so callers can rely on "rejected transition ⇒ no state change".
 */
export function validateTransition(ctx: TransitionContext): void {
  // Collapse the actor's single + multi role into one normalized set. Track
  // whether any role context was supplied: when none is, the role guard is
  // skipped (route-level requireRole remains the gate) so callers that don't
  // thread roles are never falsely rejected.
  const rawRoles: string[] = [];
  if (ctx.actorRole) rawRoles.push(String(ctx.actorRole));
  if (ctx.actorRoles) rawRoles.push(...ctx.actorRoles.map((r) => String(r)));
  const hasRoleContext = rawRoles.some((r) => r.trim() !== "");
  const roleSet = new Set(
    rawRoles.map((r) => String(normalizeRole(r))).filter((r) => r.trim() !== ""),
  );
  const isAdmin = roleSet.has("admin");

  // 1. The action MUST be registered. Legality is bound to the action so that a
  // mismatched/unknown action can never piggy-back on another action's legal
  // edge and skip its role/content rules. NOTE: this runs for self-loops too — a
  // same-phase transition (e.g. EXECUTIVE_SUBMITTED on RUNNING_PROJECT) is a
  // legal *state* no-op but must still satisfy role/ownership/content below, so
  // there is intentionally NO global self-loop early-return here.
  const rule = findRuleByAction(ctx.action);
  if (!rule) {
    if (isAdmin && ctx.override && ctx.reason && ctx.reason.trim()) return;
    throw new WorkflowTransitionError(
      `Unknown workflow action: "${ctx.action}".`,
      400,
      "WORKFLOW_UNKNOWN_ACTION",
    );
  }

  // 2. Legal state for THIS action. A self-loop (from === to, no phase change) is
  // always a legal state (idempotent re-save); otherwise `from` must be a
  // registered source and `to` a registered target of the action's rule. Either
  // way, the role/ownership/content guards below still run.
  const isSelfLoop = ctx.from === ctx.to;
  if (!isSelfLoop) {
    const legal =
      rule.from.includes(ctx.from as WorkflowPhase) &&
      rule.to.includes(ctx.to as WorkflowPhase);
    if (!legal) {
      if (isAdmin && ctx.override) {
        if (!ctx.reason || !ctx.reason.trim()) {
          throw new WorkflowTransitionError(
            "An override reason is required to force this transition.",
            400,
            "WORKFLOW_OVERRIDE_REASON_REQUIRED",
          );
        }
        // Admin override of an illegal state is permitted but still subject to the
        // reason guard above; routes audit the override explicitly.
        return;
      }
      throw new WorkflowTransitionError(
        `Illegal workflow transition for "${ctx.action}": ${ctx.from} → ${ctx.to}.`,
        400,
        "WORKFLOW_ILLEGAL_TRANSITION",
      );
    }
  }

  // 3. Role guard. Admins always pass; a `null` role-set means the action is not
  // role-restricted at this layer (executive self-service governed by ownership
  // + route requireRole). Passes when ANY held role is permitted.
  if (rule.roles && !isAdmin && hasRoleContext) {
    const allowed = new Set(rule.roles.map((r) => String(normalizeRole(r))));
    const permitted = Array.from(roleSet).some((r) => allowed.has(r));
    if (!permitted) {
      throw new WorkflowTransitionError(
        `Role "${ctx.actorRole ?? Array.from(roleSet).join(", ")}" is not permitted to perform "${ctx.action}".`,
        403,
        "WORKFLOW_ROLE_FORBIDDEN",
      );
    }
  }

  // 4. Ownership / scope guard (only when the caller computed it).
  if (ctx.ownershipSatisfied === false && !isAdmin) {
    throw new WorkflowTransitionError(
      "You do not have ownership of this workflow item.",
      403,
      "WORKFLOW_OWNERSHIP_FORBIDDEN",
    );
  }

  // Content rules (reason / evidence) are enforced when the caller owns the full
  // transition (`enforceContent`).
  if (!ctx.enforceContent) return;

  // 5. Reason requirement (returns / rejections).
  if (rule.requireReason && (!ctx.reason || !ctx.reason.trim())) {
    throw new WorkflowTransitionError(
      `A reason is required to perform "${ctx.action}".`,
      400,
      "WORKFLOW_REASON_REQUIRED",
    );
  }

  // 6. Evidence requirement (executive submissions).
  if (rule.requireEvidence && (ctx.evidenceCount ?? 0) < 1) {
    throw new WorkflowTransitionError(
      `At least one evidence link is required to perform "${ctx.action}".`,
      400,
      "WORKFLOW_EVIDENCE_REQUIRED",
    );
  }
}

/**
 * Convenience used by the module executors: assert a transition is legal +
 * (optionally) role-allowed before any DB write. Identical semantics to
 * `validateTransition`, named for intent at call sites.
 */
export function assertWorkflowTransition(ctx: TransitionContext): void {
  validateTransition(ctx);
}

/**
 * Map a thrown error onto an Express response. Returns `true` when the error was
 * a `WorkflowTransitionError` (and a response was sent), so route catch blocks
 * can early-return; otherwise returns `false` to let the caller fall back to a
 * generic 500.
 */
export function mapWorkflowError(res: any, error: unknown): boolean {
  if (error instanceof WorkflowTransitionError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Rework escalation
// ---------------------------------------------------------------------------

export interface ReworkEscalationInput {
  module: "product-posting" | "software";
  workflowId: string;
  taskId?: string | null;
  projectId?: string | null;
  returnCount: number;
  actorUserId?: string;
  reason?: string | null;
}

/**
 * Decide whether a return has crossed the escalation threshold. Pure — does no
 * I/O so it is trivially testable and side-effect free.
 */
export function shouldEscalateRework(returnCount: number): boolean {
  return returnCount >= WORKFLOW_REWORK_ESCALATION_COUNT;
}

/**
 * Record a rework escalation when the threshold is crossed. Best-effort: audit
 * logging never throws (see `AuditLogService`), so this is safe on a mutation's
 * critical path. Returns whether an escalation was recorded.
 */
export async function maybeEscalateRework(input: ReworkEscalationInput): Promise<boolean> {
  if (!shouldEscalateRework(input.returnCount)) return false;
  await AuditLogService.record({
    actorUserId: input.actorUserId,
    action: "WORKFLOW_REWORK_ESCALATED",
    module: input.module,
    entityType: "workflow",
    entityId: input.workflowId,
    reason: input.reason || undefined,
    after: {
      returnCount: input.returnCount,
      threshold: WORKFLOW_REWORK_ESCALATION_COUNT,
      taskId: input.taskId ?? undefined,
      projectId: input.projectId ?? undefined,
    },
  });
  return true;
}

// ---------------------------------------------------------------------------
// Structured routing
// ---------------------------------------------------------------------------

export type DepartmentType = "DND" | "PRODUCT_POSTING" | "SOFTWARE";

export interface WorkflowRouting {
  departmentType: DepartmentType;
  /** Module owning the workflow tables/endpoints. */
  workflowType: "product-posting" | "software";
  /** Human-facing service/category label (best-effort). */
  serviceType: string;
  /** Manager + executive dashboard URLs for notifications/redirects. */
  managerDashboardUrl: string;
  executiveDashboardUrl: string;
  /**
   * True when the department was derived from free-text project/invoice names
   * rather than a structured field. Such records should be back-filled with
   * structured routing columns — see WORKFLOW_STATE_MACHINE.md.
   */
  derivedFromText: boolean;
}

const DND_HINTS = ["minisite", "mini site", "listing", "alibaba"];

/**
 * Resolve the structured routing for a workflow. Prefers an explicit
 * `departmentType`/`workflowType`; only falls back to text matching when those
 * structured signals are absent (and flags it via `derivedFromText`).
 */
export function resolveWorkflowRouting(input: {
  departmentType?: string | null;
  workflowType?: "product-posting" | "software" | null;
  projectName?: string | null;
  invoiceProjectName?: string | null;
}): WorkflowRouting {
  const explicitWorkflow = input.workflowType ?? null;
  const explicitDept = (input.departmentType || "").trim().toUpperCase();

  let department: DepartmentType | null = null;
  let derivedFromText = false;

  if (explicitDept === "DND" || explicitDept === "PRODUCT_POSTING" || explicitDept === "SOFTWARE") {
    // Structured department column present — the authoritative signal.
    department = explicitDept as DepartmentType;
  } else if (explicitWorkflow === "software") {
    // A software workflow lives in its own table, so the module identity is a
    // structural signal — never a text guess. DND is a product-posting subtype,
    // so it can never apply here.
    department = "SOFTWARE";
  } else {
    // No structured signal: fall back to free-text name matching to split
    // product-posting into DND vs PRODUCT_POSTING. Flagged so such records can
    // be back-filled with a structured department_type — see schema/projects.
    derivedFromText = true;
    const haystack = `${input.projectName || ""} ${input.invoiceProjectName || ""}`.toLowerCase();
    if (DND_HINTS.some((h) => haystack.includes(h))) {
      department = "DND";
    } else {
      department = "PRODUCT_POSTING";
    }
  }

  const workflowType: "product-posting" | "software" =
    explicitWorkflow ?? (department === "SOFTWARE" ? "software" : "product-posting");

  const serviceType = input.invoiceProjectName || input.projectName || department;

  const routes =
    department === "SOFTWARE"
      ? { manager: "/dashboard/l-manager", executive: "/dashboard/l-executive" }
      : department === "DND"
        ? { manager: "/dd/manager", executive: "/dd/executive" }
        : { manager: "/product-posting/manager", executive: "/product-posting/executive" };

  return {
    departmentType: department,
    workflowType,
    serviceType,
    managerDashboardUrl: routes.manager,
    executiveDashboardUrl: routes.executive,
    derivedFromText,
  };
}

/**
 * Pure, DB-free validation of an extension-request payload. Returns a
 * `WorkflowTransitionError` (code + 400) describing the first problem, or `null`
 * when the payload is acceptable. Callers must reject BEFORE any write so a bad
 * request creates no row.
 */
export function validateExtensionRequestInput(input: {
  requestedTimeMinutes: unknown;
  reason: unknown;
}): WorkflowTransitionError | null {
  const minutes = Number(input.requestedTimeMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return new WorkflowTransitionError(
      "A positive requested time (in minutes) is required.",
      400,
      "EXTENSION_MINUTES_INVALID",
    );
  }
  if (typeof input.reason !== "string" || input.reason.trim().length === 0) {
    return new WorkflowTransitionError(
      "A reason is required to request an extension.",
      400,
      "EXTENSION_REASON_REQUIRED",
    );
  }
  return null;
}

export default {
  WORKFLOW_PHASES,
  WORKFLOW_TRANSITIONS,
  WORKFLOW_REWORK_ESCALATION_COUNT,
  WorkflowTransitionError,
  isLegalTransition,
  validateTransition,
  assertWorkflowTransition,
  mapWorkflowError,
  shouldEscalateRework,
  maybeEscalateRework,
  resolveWorkflowRouting,
};
