import { z } from "zod";
import type { ToolDefinition } from "../types";

const schema = z.object({
  query: z.string().trim().min(1).max(200),
});

// Verified in M0: no versioned/approved SOP or guidance corpus exists in this
// checkout. `policies` is flat config (no version/approval field);
// `trainingModules` has isActive/publishedAt but no approval or version
// field. Returning content from either and calling it "approved guidance"
// would be fabricating a provenance this system doesn't have — so this tool
// always reports unavailable rather than inventing an SOP.
export const searchApprovedGuidanceTool: ToolDefinition = {
  name: "search_approved_guidance",
  description:
    "Search approved, versioned DRM guidance/SOPs. Currently always unavailable — this system has no approved/versioned guidance corpus to search (see docs/copilot/PROGRESS.md).",
  schema,
  jsonSchema: {
    type: "object",
    properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
    required: ["query"],
  },
  async handler(rawArgs) {
    schema.parse(rawArgs ?? {});
    return {
      ok: false,
      unavailable: "no approved/versioned guidance corpus is configured in this system",
      sourceRefs: [],
    };
  },
};
