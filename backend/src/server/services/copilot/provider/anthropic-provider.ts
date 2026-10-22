import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  type ProviderAdapter,
  type ProviderCallParams,
  type ProviderTurnResult,
  type ProviderContentBlock,
} from "./provider.interface";

export class AnthropicProvider implements ProviderAdapter {
  name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    // Pass the key explicitly — never rely on the SDK's implicit
    // ANTHROPIC_API_KEY env var, so Copilot's own config.ts stays the single
    // source of truth for which key is in use.
    this.client = new Anthropic({ apiKey });
  }

  async call(params: ProviderCallParams): Promise<ProviderTurnResult> {
    try {
      const response = await this.client.messages.create(
        {
          model: params.model,
          system: params.systemPrompt,
          max_tokens: params.maxOutputTokens,
          messages: params.messages as any,
          tools: params.tools as any,
        },
        { timeout: params.timeoutMs },
      );

      const content: ProviderContentBlock[] = response.content
        .map((block): ProviderContentBlock => {
          if (block.type === "text") return { type: "text", text: block.text };
          if (block.type === "tool_use") return { type: "tool_use", id: block.id, name: block.name, input: block.input };
          // Any other block type (thinking, redacted_thinking, etc.) is dropped
          // from what reaches persistence/UI — brief: "concise operational
          // explanations, not hidden chain-of-thought."
          return { type: "text", text: "" };
        })
        .filter((b) => !(b.type === "text" && b.text === ""));

      const stopReason =
        response.stop_reason === "end_turn" ||
        response.stop_reason === "tool_use" ||
        response.stop_reason === "max_tokens" ||
        response.stop_reason === "stop_sequence"
          ? response.stop_reason
          : "unknown";

      return {
        stopReason,
        content,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      };
    } catch (err: any) {
      throw mapAnthropicError(err);
    }
  }
}

function mapAnthropicError(err: any): ProviderError {
  const status = err?.status ?? err?.response?.status;
  if (err?.name === "APIConnectionTimeoutError" || err?.code === "ETIMEDOUT") {
    return new ProviderError("Request to the model provider timed out.", "timeout");
  }
  if (status === 401 || status === 403) {
    return new ProviderError("Model provider rejected the request (invalid credentials).", "auth");
  }
  if (status === 429) {
    return new ProviderError("Model provider rate limit exceeded.", "rate_limit");
  }
  if (status === 404 || /model/i.test(String(err?.message)) && /not_found|invalid/i.test(String(err?.message))) {
    return new ProviderError("Configured model is unavailable.", "model_unavailable");
  }
  if (status >= 400 && status < 500) {
    return new ProviderError("Invalid request to model provider.", "invalid_request");
  }
  return new ProviderError("Model provider error.", "unknown");
}
