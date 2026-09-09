/**
 * Patch 5 Stage 7 (Part A) — Verification lifecycle LABELS only.
 *
 * This module is the single source of truth for the user-facing wording of the
 * QA -> Verification -> final-owner lifecycle. It DOES NOT change any workflow
 * transition, phase value, role or permission — it only maps a phase to a label
 * that is consistent with the current `verificationManagerRequiredAfterQa` config.
 *
 * Background: management has NOT confirmed whether the Verification Manager step
 * after QA is mandatory. The backend transition logic is therefore left exactly
 * as-is. These labels let the UI describe the same underlying state truthfully
 * under either configuration without implying a transition change. See
 * VERIFICATION_MANAGER_LIFECYCLE_DECISION.md.
 *
 * Shared client/server: must not import server-only modules.
 */

/** Canonical lifecycle stages relevant to the QA/Verification handoff. */
export const VERIFICATION_LIFECYCLE_STAGES = {
  QA_REVIEW: "QA_REVIEW",
  QA_COMPLETE: "QA_COMPLETE",
  VERIFICATION_PENDING: "VERIFICATION_PENDING",
  VERIFICATION_COMPLETE: "VERIFICATION_COMPLETE",
} as const;
export type VerificationLifecycleStage =
  (typeof VERIFICATION_LIFECYCLE_STAGES)[keyof typeof VERIFICATION_LIFECYCLE_STAGES];

export interface VerificationLifecycleLabels {
  /** Label for "QA finished its review". */
  qaComplete: string;
  /** Label for the state immediately after QA, before the project is final. */
  postQaPending: string;
  /** Label for the terminal "ready / fully verified" state. */
  verificationComplete: string;
  /** Who owns the project at the terminal state. */
  finalOwner: string;
  /** Short tag used in compact UI (e.g. table chips) for the post-QA state. */
  postQaTag: string;
}

/**
 * Returns lifecycle labels consistent with the active config.
 *
 * - `verificationManagerRequiredAfterQa = true` (current default): QA completion
 *   is NOT terminal; a Verification Manager step follows and owns the final
 *   state. Wording: "QA Complete" -> "Verification Pending" -> "Verification
 *   Complete" (final owner = Verification Manager).
 * - `verificationManagerRequiredAfterQa = false`: QA completion is the terminal
 *   state; there is no separate verification gate. Wording collapses so the UI
 *   does not imply a pending step that will never happen.
 */
export function getVerificationLifecycleLabels(
  verificationManagerRequiredAfterQa: boolean,
): VerificationLifecycleLabels {
  if (verificationManagerRequiredAfterQa) {
    return {
      qaComplete: "QA Complete",
      postQaPending: "Verification Pending",
      verificationComplete: "Verification Complete",
      finalOwner: "Verification Manager",
      postQaTag: "verification pending",
    };
  }
  return {
    qaComplete: "QA Complete",
    postQaPending: "QA Complete",
    verificationComplete: "QA Complete",
    finalOwner: "QA Manager",
    postQaTag: "qa complete",
  };
}
