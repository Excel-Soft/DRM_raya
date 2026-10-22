// Provider interface — keeps model orchestration behind an interface so a
// future Python agent service (or a different model vendor) can replace this
// without touching business authorization (brief: "keep model orchestration
// behind interfaces"). Only one adapter exists today (Anthropic); there is
// deliberately no cross-provider fallback.
export interface ProviderToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ProviderMessageRole = "user" | "assistant";

export interface ProviderToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export interface ProviderTextBlock {
  type: "text";
  text: string;
}
export type ProviderContentBlock = ProviderTextBlock | ProviderToolUseBlock;

export interface ProviderMessage {
  role: ProviderMessageRole;
  content: string | ProviderContentBlock[];
}

export interface ProviderToolResultMessage {
  role: "user";
  content: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }>;
}

export interface ProviderTurnResult {
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "unknown";
  content: ProviderContentBlock[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface ProviderCallParams {
  model: string;
  systemPrompt: string;
  messages: Array<ProviderMessage | ProviderToolResultMessage>;
  tools: ProviderToolSpec[];
  maxOutputTokens: number;
  timeoutMs: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "rate_limit" | "timeout" | "model_unavailable" | "invalid_request" | "unknown",
  ) {
    super(message);
  }
}

export interface ProviderAdapter {
  name: string;
  call(params: ProviderCallParams): Promise<ProviderTurnResult>;
}
