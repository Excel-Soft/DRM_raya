import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { saveDraft } from "../persistence";

const schema = z.object({
  draftType: z.enum(["followup_message", "quotation_proposal", "task_plan", "internal_summary"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
  relatedCustomerId: z.string().uuid().optional(),
  relatedProjectId: z.string().min(1).max(64).optional(),
  missingFields: z.array(z.string().max(120)).max(20).optional().default([]),
});

export const prepareDraftTool: ToolDefinition = {
  name: "prepare_draft",
  description:
    "Save a follow-up message, quotation proposal, task plan, or internal summary as a DRAFT in Copilot's own storage. This NEVER issues an invoice, GM, or quotation, and never sends anything — it only saves a draft the user can review and act on manually elsewhere in the app. List all genuinely missing required fields in one call via missingFields rather than asking one at a time.",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      draftType: { type: "string", enum: ["followup_message", "quotation_proposal", "task_plan", "internal_summary"] },
      title: { type: "string", minLength: 1, maxLength: 160 },
      body: { type: "string", minLength: 1, maxLength: 8000 },
      relatedCustomerId: { type: "string", format: "uuid" },
      relatedProjectId: { type: "string", minLength: 1, maxLength: 64 },
      missingFields: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 20 },
    },
    required: ["draftType", "title", "body"],
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});
    const sourceRefs = [
      ...(args.relatedCustomerId
        ? [{ type: "customer", id: args.relatedCustomerId, route: `/customers/attribute/${args.relatedCustomerId}`, retrievedAt: nowIso() }]
        : []),
      ...(args.relatedProjectId
        ? [{ type: "project", id: args.relatedProjectId, route: "/pms/running-projects", retrievedAt: nowIso() }]
        : []),
    ];

    const draft = await saveDraft({
      conversationId: ctx.conversationId,
      userId: ctx.identity.userId,
      draftType: args.draftType,
      content: { title: args.title, body: args.body },
      sourceRefs,
      missingFields: args.missingFields,
    });

    return {
      ok: true,
      data: {
        draftId: draft.id,
        status: "DRAFT",
        draftType: args.draftType,
        title: args.title,
        missingFields: args.missingFields,
      },
      sourceRefs,
    };
  },
};
