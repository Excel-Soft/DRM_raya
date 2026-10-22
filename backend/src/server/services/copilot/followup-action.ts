// M4 — the ONE optional write Copilot can perform: create one internal
// follow-up assigned to the authenticated user. Default OFF
// (COPILOT_ALLOW_FOLLOWUP_CREATE=false). Reuses the SAME ownership check the
// real POST /api/sales/followups route uses (assertCanEditCustomer) and the
// same insert shape — no replacement schema, no admin-credential HTTP call.
import type { Request } from "express";
import { pool } from "../../db";
import { assertCanEditCustomer } from "../../utils/ownership";
import { ApiError } from "../../utils/api-error";
import {
  createProposal,
  getProposalForUser,
  claimProposalForExecution,
  recordExecution,
  getExecutionForProposal,
  markProposalStatus,
  hashPayload,
} from "./persistence";

const PROPOSAL_TTL_MS = 10 * 60 * 1000; // brief: proposal has an expiry

export interface FollowupProposalPayload {
  customerId: string;
  note: string;
  method: string;
  dueAt: string; // ISO date
}

export async function proposeFollowupAction(params: {
  req: Request;
  conversationId: string;
  userId: string;
  payload: FollowupProposalPayload;
}) {
  // Recheck access at propose-time too — fail fast with a clear reason rather
  // than letting the user confirm something they were never allowed to do.
  await assertCanEditCustomer(params.req, params.payload.customerId, "customer");

  const proposal = await createProposal({
    conversationId: params.conversationId,
    userId: params.userId,
    actionType: "create_followup",
    payload: params.payload,
    targetRecordVersion: null,
    ttlMs: PROPOSAL_TTL_MS,
  });
  return {
    proposalId: proposal.id,
    payloadHash: proposal.payloadHash,
    expiresAt: proposal.expiresAt,
    payload: params.payload,
  };
}

export class ProposalInvalidError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export async function confirmFollowupAction(params: {
  req: Request;
  userId: string;
  proposalId: string;
  payloadHash: string;
}) {
  const proposal = await getProposalForUser(params.proposalId, params.userId);
  if (!proposal) throw new ProposalInvalidError("not_found", "Proposal not found.");
  if (proposal.actionType !== "create_followup") {
    throw new ProposalInvalidError("wrong_type", "Proposal is not a follow-up action.");
  }
  if (new Date(proposal.expiresAt).getTime() < Date.now()) {
    throw new ProposalInvalidError("expired", "This proposal has expired — ask Copilot to prepare it again.");
  }
  if (proposal.payloadHash !== params.payloadHash || hashPayload(proposal.payload) !== params.payloadHash) {
    throw new ProposalInvalidError("changed", "The proposal has changed since it was shown — please review the new version.");
  }
  if (proposal.status !== "pending") {
    // Already confirmed/executed by a concurrent request — return the
    // existing execution instead of erroring, so a retry is idempotent.
    const existing = await getExecutionForProposal(proposal.id);
    if (existing) return existing;
    throw new ProposalInvalidError("not_pending", `Proposal is ${proposal.status}, not pending.`);
  }

  const claimed = await claimProposalForExecution(proposal.id);
  if (!claimed) {
    // Lost the race to another concurrent confirmation — same idempotent fallback.
    const existing = await getExecutionForProposal(proposal.id);
    if (existing) return existing;
    throw new ProposalInvalidError("not_pending", "Proposal was already claimed.");
  }

  const actionKey = `followup:${proposal.id}`;
  const payload = proposal.payload as unknown as FollowupProposalPayload;

  try {
    // Recheck access immediately before the transaction (brief §7).
    await assertCanEditCustomer(params.req, payload.customerId, "customer");

    const { rows } = await pool.query(
      `insert into drm.follow_ups
         (customer_id, assigned_to, created_by, due_at, status, notes, method, created_at, updated_at, is_deleted)
       values ($1, $2, $2, $3, 'Open', $4, $5, now(), now(), false)
       returning id::text as id`,
      [payload.customerId, params.userId, payload.dueAt, payload.note, payload.method],
    );
    const followUpId = rows[0]?.id;
    if (!followUpId) throw new Error("insert returned no id");

    const execution = await recordExecution({
      proposalId: proposal.id,
      actionKey,
      status: "success",
      resultEntityType: "follow_up",
      resultEntityId: followUpId,
    });
    await markProposalStatus(proposal.id, "executed");
    return execution;
  } catch (err) {
    // Commit outcome uncertain — record a reconciling state keyed by the same
    // action_key so a retry never double-inserts; a human reconciles by
    // action_key, we never guess success here.
    await recordExecution({
      proposalId: proposal.id,
      actionKey,
      status: "reconciling",
      errorMessage: err instanceof ApiError ? err.message : "execution failed — needs reconciliation",
    });
    throw err;
  }
}
