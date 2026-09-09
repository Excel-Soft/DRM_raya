import { ApiError } from "./api-error";

/**
 * Stage 8 — canonical GM/BV lifecycle state machine.
 *
 * The existing GM model is fragmented across several columns (gm_entries.status,
 * approval_status, hod_status, account_manager_status, super_hod_status,
 * withdrawal_status). This module does NOT replace those columns — it provides a
 * single canonical vocabulary plus an allowed-transition map so the existing
 * transition endpoints can (a) reject illegal moves and (b) emit a consistent
 * audit trail. `mapToCanonical()` translates the legacy column values into the
 * canonical status for reporting and auditing.
 */

export const GM_BV_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_HOD",
  "PENDING_ACCOUNT",
  "APPROVED",
  "REJECTED",
  "PROJECT_CREATED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "CANCELLED",
  "WITHDRAWAL_REQUESTED",
  "WITHDRAWN",
] as const;

export type GmBvStatus = (typeof GM_BV_STATUSES)[number];

/** Allowed forward transitions. A status not listed is treated as terminal. */
export const ALLOWED_TRANSITIONS: Record<GmBvStatus, GmBvStatus[]> = {
  DRAFT: ["SUBMITTED", "PENDING_HOD", "CANCELLED"],
  SUBMITTED: ["PENDING_HOD", "CANCELLED"],
  PENDING_HOD: ["PENDING_ACCOUNT", "APPROVED", "REJECTED", "CANCELLED"],
  PENDING_ACCOUNT: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PROJECT_CREATED", "REFUND_REQUESTED", "WITHDRAWAL_REQUESTED", "CANCELLED"],
  PROJECT_CREATED: ["REFUND_REQUESTED", "WITHDRAWAL_REQUESTED"],
  REFUND_REQUESTED: ["REFUNDED", "REJECTED", "APPROVED"],
  REFUNDED: [],
  REJECTED: ["PENDING_HOD", "CANCELLED"],
  WITHDRAWAL_REQUESTED: ["WITHDRAWN", "REJECTED", "APPROVED"],
  WITHDRAWN: [],
  CANCELLED: [],
};

/** Transitions that REQUIRE a non-empty reason from the actor. */
export const REASON_REQUIRED_TARGETS: GmBvStatus[] = [
  "REJECTED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "WITHDRAWAL_REQUESTED",
  "WITHDRAWN",
  "CANCELLED",
];

export function isValidStatus(value: unknown): value is GmBvStatus {
  return typeof value === "string" && (GM_BV_STATUSES as readonly string[]).includes(value);
}

/** Whether `from -> to` is a permitted transition. Same-state is a no-op (true). */
export function canTransition(from: GmBvStatus, to: GmBvStatus): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

export function requiresReason(to: GmBvStatus): boolean {
  return REASON_REQUIRED_TARGETS.includes(to);
}

/**
 * Assert a transition is legal and (when required) accompanied by a reason.
 * Throws ApiError(409) for an illegal transition, ApiError(400) for a missing
 * reason. Returns the trimmed reason.
 */
export function assertTransition(
  from: GmBvStatus,
  to: GmBvStatus,
  reason?: string | null,
): string {
  if (!canTransition(from, to)) {
    throw new ApiError(
      409,
      "CONFLICT",
      `Illegal GM/BV transition: ${from} -> ${to}.`,
      { from, to, allowed: ALLOWED_TRANSITIONS[from] || [] },
    );
  }
  const trimmed = (reason || "").trim();
  if (requiresReason(to) && !trimmed) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `A reason is required to move a GM/BV record to ${to}.`,
    );
  }
  return trimmed;
}

/**
 * Translate the legacy GM column values into a single canonical status.
 * Precedence reflects the real workflow: terminal/withdrawal/refund states win
 * over in-flight approval states.
 */
export function mapToCanonical(row: {
  status?: string | null;
  approval_status?: string | null;
  approvalStatus?: string | null;
  withdrawal_status?: string | null;
  withdrawalStatus?: string | null;
  final_status?: string | null;
  finalStatus?: string | null;
  account_manager_status?: string | null;
  project_id?: string | null;
  projectId?: string | null;
}): GmBvStatus {
  const status = (row.status || "").toLowerCase();
  const approval = (row.approval_status ?? row.approvalStatus ?? "").toLowerCase();
  const withdrawal = (row.withdrawal_status ?? row.withdrawalStatus ?? "").toLowerCase();
  const finalStatus = (row.final_status ?? row.finalStatus ?? "").toLowerCase();
  const acctStatus = (row.account_manager_status || "").toLowerCase();
  const hasProject = Boolean(row.project_id ?? row.projectId);

  // Withdrawal flow
  if (status === "withdrawn" || withdrawal === "approved") return "WITHDRAWN";
  if (withdrawal === "pending_hod" || withdrawal === "pending") return "WITHDRAWAL_REQUESTED";

  // Rejections
  if (
    approval.startsWith("rejected") ||
    finalStatus === "rejected" ||
    status === "rejected"
  ) {
    return "REJECTED";
  }

  // Cancellations
  if (status === "cancelled" || status === "canceled") return "CANCELLED";

  // Approved / completed
  if (
    approval === "approved" ||
    finalStatus === "approved" ||
    status === "approved" ||
    status === "completed"
  ) {
    return hasProject ? "PROJECT_CREATED" : "APPROVED";
  }

  // In-flight approvals
  if (approval === "pending_managers" || acctStatus === "pending") return "PENDING_ACCOUNT";
  if (approval === "pending_hod" || status === "pending") return "PENDING_HOD";
  if (status === "draft" || approval === "draft" || approval === "") return "DRAFT";

  return "PENDING_HOD";
}
