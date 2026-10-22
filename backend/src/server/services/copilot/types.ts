import type { ZodType } from "zod";
import type { CopilotIdentity } from "./identity";

export interface SourceRef {
  type: string;
  id: string;
  label?: string;
  route?: string;
  retrievedAt: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  unavailable?: string;
  sourceRefs: SourceRef[];
}

export interface ToolContext {
  identity: CopilotIdentity;
  conversationId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: ZodType<any>;
  /** Hand-written JSON Schema handed to the Anthropic tool_use definition. */
  jsonSchema: Record<string, unknown>;
  handler: (args: any, ctx: ToolContext) => Promise<ToolResult>;
}

export function nowIso(): string {
  return new Date().toISOString();
}
