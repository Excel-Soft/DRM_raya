// Typed client for /api/copilot/*. Every call here explicitly checks
// `res.ok` and throws with the server's message — unlike the shared
// `apiRequest`, which intentionally does not throw (see queryClient.ts) and
// is exactly the bug the original WebX-AI chat panel had (a failed request
// silently fell through to `data.response` = undefined).
import { apiRequest } from "./queryClient";

export interface CopilotCapability {
  provider: string;
  configured: boolean;
  reasons: string[];
  allowedForUser: boolean;
  followupCreateEnabled: boolean;
  limits: {
    maxToolRounds: number;
    maxOutputTokens: number;
    rateLimitPerMinute: number;
    maxMessageCharacters: number;
  };
}

export interface CopilotEvidenceRef {
  type: string;
  id: string;
  label?: string;
  route?: string;
}

export interface CopilotDraftRef {
  draftId: string;
  draftType: string;
  title: string;
}

export interface CopilotTurnResponse {
  conversationId: string;
  runId: string;
  answer: string;
  evidence: CopilotEvidenceRef[];
  drafts: CopilotDraftRef[];
  warnings: Array<{ code: string; message: string }>;
  mode: "ok" | "degraded" | "blocked";
  usage: { inputTokens: number; outputTokens: number; toolRounds: number };
}

export interface CopilotConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

export interface CopilotDraft {
  id: string;
  conversationId: string;
  draftType: string;
  content: { title: string; body: string };
  sourceRefs: CopilotEvidenceRef[] | null;
  missingFields: string[] | null;
  version: number;
  status: "draft" | "discarded";
  createdAt: string;
  updatedAt: string;
}

export interface CopilotAuditEntry {
  id: string;
  action: string;
  outcome: string;
  toolName: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

class CopilotApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await apiRequest(method, url, body);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const data = await res.json();
      message = data?.message || data?.error || message;
      code = data?.code || data?.error;
    } catch {
      // body wasn't JSON — keep the generic message
    }
    throw new CopilotApiError(message, res.status, code);
  }
  return res.json();
}

export function getCopilotCapability() {
  return requestJson<CopilotCapability>("GET", "/api/copilot/capability");
}

export function askCopilot(params: { message: string; conversationId?: string | null }) {
  return requestJson<CopilotTurnResponse>("POST", "/api/copilot/ask", params);
}

export function listCopilotConversations() {
  return requestJson<{ conversations: Array<{ id: string; title: string | null; lastMessageAt: string | null }> }>(
    "GET",
    "/api/copilot/conversations",
  );
}

export function listCopilotMessages(conversationId: string) {
  return requestJson<{ messages: CopilotConversationMessage[] }>(
    "GET",
    `/api/copilot/conversations/${conversationId}/messages`,
  );
}

export function listCopilotDrafts() {
  return requestJson<{ drafts: CopilotDraft[] }>("GET", "/api/copilot/drafts");
}

export function discardCopilotDraft(draftId: string) {
  return requestJson<{ success: true }>("DELETE", `/api/copilot/drafts/${draftId}`);
}

export function listCopilotActivity() {
  return requestJson<{ entries: CopilotAuditEntry[] }>("GET", "/api/copilot/activity");
}

export function proposeFollowup(params: { conversationId: string; customerId: string; note: string; method: string; dueAt: string }) {
  return requestJson<{
    proposal: { proposalId: string; payloadHash: string; expiresAt: string; payload: Record<string, unknown> };
  }>("POST", "/api/copilot/actions/followup/propose", params);
}

export function confirmFollowup(params: { proposalId: string; payloadHash: string }) {
  return requestJson<{ execution: { status: string; resultEntityId: string | null } }>(
    "POST",
    "/api/copilot/actions/followup/confirm",
    params,
  );
}

export { CopilotApiError };
