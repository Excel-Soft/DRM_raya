// All Copilot persistence in one place: conversations, messages, runs, tool
// calls, drafts, audit log, action proposals/executions. Every read here is
// scoped by `userId` — there is no "list all conversations" query.
import { createHash } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, pool } from "../../db";
import {
  copilotConversations,
  copilotMessages,
  copilotRuns,
  copilotToolCalls,
  copilotDrafts,
  copilotAuditLog,
  copilotActionProposals,
  copilotActionExecutions,
  type CopilotMessageRole,
  type CopilotRunStatus,
  type CopilotToolCallStatus,
  type CopilotDraftType,
  type CopilotProposalStatus,
  type CopilotExecutionStatus,
} from "../../../shared/schema";

// ─── Conversations ────────────────────────────────────────────────────────────
export async function createConversation(userId: string, title?: string | null) {
  const [row] = await db
    .insert(copilotConversations)
    .values({ userId, title: title ?? null })
    .returning();
  return row;
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(copilotConversations)
    .where(and(eq(copilotConversations.id, conversationId), eq(copilotConversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listConversationsForUser(userId: string, limit = 30) {
  return db
    .select()
    .from(copilotConversations)
    .where(eq(copilotConversations.userId, userId))
    .orderBy(desc(copilotConversations.lastMessageAt), desc(copilotConversations.createdAt))
    .limit(limit);
}

export async function touchConversation(conversationId: string) {
  await db
    .update(copilotConversations)
    .set({ updatedAt: new Date(), lastMessageAt: new Date() })
    .where(eq(copilotConversations.id, conversationId));
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function appendMessage(params: {
  conversationId: string;
  role: CopilotMessageRole;
  content: string;
  runId?: string | null;
}) {
  const [row] = await db
    .insert(copilotMessages)
    .values({
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      runId: params.runId ?? null,
    })
    .returning();
  return row;
}

export async function listMessages(conversationId: string, limit = 50) {
  const rows = await db
    .select()
    .from(copilotMessages)
    .where(eq(copilotMessages.conversationId, conversationId))
    .orderBy(desc(copilotMessages.createdAt))
    .limit(limit);
  return rows.reverse(); // oldest first for model context
}

// ─── Runs ─────────────────────────────────────────────────────────────────────
export async function startRun(conversationId: string, userId: string, model: string | null) {
  const [row] = await db
    .insert(copilotRuns)
    .values({ conversationId, userId, model, status: "running" })
    .returning();
  return row;
}

export async function finishRun(
  runId: string,
  patch: {
    status: CopilotRunStatus;
    toolRounds?: number;
    inputTokens?: number;
    outputTokens?: number;
    error?: string | null;
  },
) {
  await db
    .update(copilotRuns)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(copilotRuns.id, runId));
}

/** How many runs for this conversation are still `running` right now (brief §6: 1 active turn/conversation). */
export async function countActiveRuns(conversationId: string): Promise<number> {
  const rows = await db
    .select({ id: copilotRuns.id })
    .from(copilotRuns)
    .where(and(eq(copilotRuns.conversationId, conversationId), eq(copilotRuns.status, "running")));
  return rows.length;
}

/** Rate limiting: runs started by this user in the last 60 seconds. */
export async function countRecentRunsForUser(userId: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  const rows = await db
    .select({ id: copilotRuns.id })
    .from(copilotRuns)
    .where(and(eq(copilotRuns.userId, userId), gt(copilotRuns.startedAt, since)));
  return rows.length;
}

// ─── Tool calls ───────────────────────────────────────────────────────────────
export async function recordToolCall(params: {
  runId: string;
  toolName: string;
  args: unknown;
  resultSummary: unknown;
  scopeContext: unknown;
  status: CopilotToolCallStatus;
  errorMessage?: string | null;
}) {
  await db.insert(copilotToolCalls).values({
    runId: params.runId,
    toolName: params.toolName,
    arguments: params.args as any,
    resultSummary: params.resultSummary as any,
    scopeContext: params.scopeContext as any,
    status: params.status,
    errorMessage: params.errorMessage ?? null,
  });
}

// ─── Drafts ───────────────────────────────────────────────────────────────────
export async function saveDraft(params: {
  conversationId: string;
  userId: string;
  draftType: CopilotDraftType;
  content: unknown;
  sourceRefs: unknown;
  missingFields: string[];
}) {
  const [row] = await db
    .insert(copilotDrafts)
    .values({
      conversationId: params.conversationId,
      userId: params.userId,
      draftType: params.draftType,
      content: params.content as any,
      sourceRefs: params.sourceRefs as any,
      missingFields: params.missingFields as any,
      version: 1,
      status: "draft",
    })
    .returning();
  return row;
}

export async function listDraftsForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(copilotDrafts)
    .where(and(eq(copilotDrafts.userId, userId), eq(copilotDrafts.status, "draft")))
    .orderBy(desc(copilotDrafts.updatedAt))
    .limit(limit);
}

export async function getDraftForUser(draftId: string, userId: string) {
  const [row] = await db
    .select()
    .from(copilotDrafts)
    .where(and(eq(copilotDrafts.id, draftId), eq(copilotDrafts.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function discardDraft(draftId: string, userId: string) {
  await db
    .update(copilotDrafts)
    .set({ status: "discarded", updatedAt: new Date() })
    .where(and(eq(copilotDrafts.id, draftId), eq(copilotDrafts.userId, userId)));
}

// ─── Audit log ────────────────────────────────────────────────────────────────
export async function recordAudit(params: {
  actorUserId: string;
  effectiveScope: unknown;
  conversationId?: string | null;
  runId?: string | null;
  toolName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  action: string;
  outcome: string;
  sourceRefs?: unknown;
  model?: string | null;
  usage?: unknown;
}) {
  await db.insert(copilotAuditLog).values({
    actorUserId: params.actorUserId,
    effectiveScope: params.effectiveScope as any,
    conversationId: params.conversationId ?? null,
    runId: params.runId ?? null,
    toolName: params.toolName ?? null,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    action: params.action,
    outcome: params.outcome,
    sourceRefs: (params.sourceRefs as any) ?? null,
    model: params.model ?? null,
    usage: (params.usage as any) ?? null,
  });
}

export async function listAuditForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(copilotAuditLog)
    .where(eq(copilotAuditLog.actorUserId, userId))
    .orderBy(desc(copilotAuditLog.createdAt))
    .limit(limit);
}

// ─── Action proposals / executions (M4) ──────────────────────────────────────
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function createProposal(params: {
  conversationId: string;
  userId: string;
  actionType: string;
  payload: unknown;
  targetRecordVersion: string | null;
  ttlMs: number;
}) {
  const [row] = await db
    .insert(copilotActionProposals)
    .values({
      conversationId: params.conversationId,
      userId: params.userId,
      actionType: params.actionType,
      payload: params.payload as any,
      payloadHash: hashPayload(params.payload),
      targetRecordVersion: params.targetRecordVersion,
      status: "pending",
      expiresAt: new Date(Date.now() + params.ttlMs),
    })
    .returning();
  return row;
}

export async function getProposalForUser(proposalId: string, userId: string) {
  const [row] = await db
    .select()
    .from(copilotActionProposals)
    .where(and(eq(copilotActionProposals.id, proposalId), eq(copilotActionProposals.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function markProposalStatus(proposalId: string, status: CopilotProposalStatus) {
  await db.update(copilotActionProposals).set({ status }).where(eq(copilotActionProposals.id, proposalId));
}

/**
 * Transactionally claim a proposal for execution: only succeeds once, even
 * under concurrent confirmations/retries. Returns `null` if already claimed.
 * Uses a raw transaction (not the drizzle query builder) so the
 * UPDATE ... WHERE status='pending' race is a single atomic statement.
 */
export async function claimProposalForExecution(proposalId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `update drm.copilot_action_proposals set status = 'confirmed'
       where id::text = $1::text and status = 'pending'`,
    [proposalId],
  );
  return (rowCount ?? 0) > 0;
}

export async function recordExecution(params: {
  proposalId: string;
  actionKey: string;
  status: CopilotExecutionStatus;
  resultEntityType?: string | null;
  resultEntityId?: string | null;
  errorMessage?: string | null;
}) {
  // ON CONFLICT on either unique column means this exact execution already
  // happened (retry/race) — treat as idempotent no-op, return the existing row.
  const { rows } = await pool.query(
    `insert into drm.copilot_action_executions
       (proposal_id, action_key, status, result_entity_type, result_entity_id, error_message)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (proposal_id) do nothing
     returning id::text as id, proposal_id::text as "proposalId", action_key as "actionKey",
               status, result_entity_type as "resultEntityType", result_entity_id as "resultEntityId"`,
    [
      params.proposalId,
      params.actionKey,
      params.status,
      params.resultEntityType ?? null,
      params.resultEntityId ?? null,
      params.errorMessage ?? null,
    ],
  );
  if (rows[0]) return rows[0];
  const existing = await pool.query(
    `select id::text as id, proposal_id::text as "proposalId", action_key as "actionKey",
            status, result_entity_type as "resultEntityType", result_entity_id as "resultEntityId"
       from drm.copilot_action_executions where proposal_id::text = $1::text`,
    [params.proposalId],
  );
  return existing.rows[0] ?? null;
}

export async function getExecutionForProposal(proposalId: string) {
  const { rows } = await pool.query(
    `select id::text as id, proposal_id::text as "proposalId", action_key as "actionKey",
            status, result_entity_type as "resultEntityType", result_entity_id as "resultEntityId"
       from drm.copilot_action_executions where proposal_id::text = $1::text`,
    [proposalId],
  );
  return rows[0] ?? null;
}
