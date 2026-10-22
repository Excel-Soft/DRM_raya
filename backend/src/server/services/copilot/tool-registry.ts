// The ONLY place tool names are allowlisted and dispatched. The model never
// gets raw SQL, generic HTTP fetch, shell, or arbitrary code execution — every
// tool here is a narrow, typed, scope-checked function (brief §4).
import { ZodError } from "zod";
import type { ToolContext, ToolDefinition, ToolResult } from "./types";
import { getMyWorkSummaryTool } from "./tools/get-my-work-summary";
import { searchAuthorisedCustomersTool } from "./tools/search-authorised-customers";
import { getCustomerSummaryTool } from "./tools/get-customer-summary";
import { getWorkflowStatusTool } from "./tools/get-workflow-status";
import { getProjectSummaryTool } from "./tools/get-project-summary";
import { getApprovedServiceOptionsTool } from "./tools/get-approved-service-options";
import { searchApprovedGuidanceTool } from "./tools/search-approved-guidance";
import { prepareDraftTool } from "./tools/prepare-draft";

const REGISTRY: ToolDefinition[] = [
  getMyWorkSummaryTool,
  searchAuthorisedCustomersTool,
  getCustomerSummaryTool,
  getWorkflowStatusTool,
  getProjectSummaryTool,
  getApprovedServiceOptionsTool,
  searchApprovedGuidanceTool,
  prepareDraftTool,
];

const BY_NAME = new Map(REGISTRY.map((t) => [t.name, t]));

export function listToolDefinitions(): ToolDefinition[] {
  return REGISTRY;
}

/** What gets sent to the Anthropic SDK's `tools` param. */
export function toAnthropicToolSpecs() {
  return REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.jsonSchema,
  }));
}

export interface DispatchResult {
  status: "ok" | "error" | "denied";
  result?: ToolResult;
  errorMessage?: string;
  /** Truncated/stringified result actually sent back to the model (capped). */
  resultForModel: string;
}

export async function dispatchTool(
  toolName: string,
  rawArgs: unknown,
  ctx: ToolContext,
  maxResultChars: number,
): Promise<DispatchResult> {
  const tool = BY_NAME.get(toolName);
  if (!tool) {
    return {
      status: "denied",
      errorMessage: `unknown tool: ${toolName}`,
      resultForModel: JSON.stringify({ error: "unknown_tool" }),
    };
  }
  try {
    const result = await tool.handler(rawArgs, ctx);
    const json = JSON.stringify(result);
    const capped = json.length > maxResultChars ? json.slice(0, maxResultChars) + "...(truncated)" : json;
    return { status: "ok", result, resultForModel: capped };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        status: "error",
        errorMessage: "invalid_arguments",
        resultForModel: JSON.stringify({ error: "invalid_arguments", issues: err.issues.map((i) => i.message) }),
      };
    }
    console.error(`[copilot] tool ${toolName} failed`, err);
    return {
      status: "error",
      errorMessage: "tool_execution_failed",
      resultForModel: JSON.stringify({ error: "tool_execution_failed" }),
    };
  }
}
