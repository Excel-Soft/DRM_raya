/**
 * Copilot V1 — tool dispatcher tests. No DB required: unknown-tool and
 * malformed-argument paths never reach a repository/DB call.
 */
import { describe, expect, it } from "vitest";
import { dispatchTool, listToolDefinitions, toAnthropicToolSpecs } from "../services/copilot/tool-registry";
import type { CopilotIdentity } from "../services/copilot/identity";

const identity: CopilotIdentity = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "test@example.com",
  role: "sales_executive",
  isFullAccess: false,
  isManagerial: false,
  department: null,
  branch: null,
  impersonatorId: null,
};

describe("dispatchTool", () => {
  it("denies an unknown tool name rather than throwing or executing anything", async () => {
    const result = await dispatchTool(
      "drop_all_customers",
      {},
      { identity, conversationId: "c1" },
      1000,
    );
    expect(result.status).toBe("denied");
    expect(result.resultForModel).toContain("unknown_tool");
  });

  it("rejects malformed arguments with a safe, structured error instead of crashing", async () => {
    // search_authorised_customers requires a non-empty `query` string.
    const result = await dispatchTool(
      "search_authorised_customers",
      { query: "" },
      { identity, conversationId: "c1" },
      1000,
    );
    expect(result.status).toBe("error");
    expect(result.resultForModel).toContain("invalid_arguments");
  });

  it("caps the result handed back to the model at the configured character limit", async () => {
    // search_approved_guidance always returns a small, deterministic
    // "unavailable" payload with no DB access — safe to exercise for capping.
    const result = await dispatchTool(
      "search_approved_guidance",
      { query: "payroll policy" },
      { identity, conversationId: "c1" },
      10, // tiny cap on purpose
    );
    expect(result.status).toBe("ok");
    expect(result.resultForModel.length).toBeLessThanOrEqual(10 + "...(truncated)".length);
  });

  it("every registered tool has a name, description, and JSON schema the provider can use", () => {
    const tools = listToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(8);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.jsonSchema).toHaveProperty("type", "object");
    }
    const specs = toAnthropicToolSpecs();
    expect(specs.length).toBe(tools.length);
    expect(specs.every((s) => typeof s.input_schema === "object")).toBe(true);
  });

  it("search_approved_guidance never fabricates an SOP — always reports unavailable", async () => {
    const result = await dispatchTool(
      "search_approved_guidance",
      { query: "anything" },
      { identity, conversationId: "c1" },
      5000,
    );
    expect(result.status).toBe("ok");
    expect(result.result?.ok).toBe(false);
    expect(result.result?.unavailable).toBeTruthy();
    expect(result.result?.sourceRefs).toEqual([]);
  });
});
