import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { customersRepository } from "../../../repositories/customers.repository";

const MAX_RESULTS = 15;

const schema = z.object({
  query: z.string().trim().min(1).max(120),
  page: z.number().int().min(1).optional().default(1),
});

export const searchAuthorisedCustomersTool: ToolDefinition = {
  name: "search_authorised_customers",
  description:
    "Scoped customer lookup by name/company/email. Returns only customers the current user is authorised to see, with minimal fields.",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 120, description: "Search text (company/contact/email)." },
      page: { type: "integer", minimum: 1, description: "Page number (default 1)." },
    },
    required: ["query"],
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});
    const { customers, total } = await customersRepository.findByUserId(
      ctx.identity.userId,
      { search: args.query, page: args.page, pageSize: MAX_RESULTS },
      ctx.identity.role,
    );

    const rows = customers.slice(0, MAX_RESULTS).map((c: any) => ({
      id: c.id,
      companyName: c.companyName ?? c.company_name ?? null,
      status: c.status ?? null,
      grade: c.grade ?? null,
      ownerUserId: c.ownerUserId ?? c.owner_user_id ?? null,
    }));

    return {
      ok: true,
      data: { customers: rows, total, page: args.page },
      sourceRefs: rows.map((c) => ({
        type: "customer",
        id: String(c.id),
        label: c.companyName ?? undefined,
        route: `/customers/attribute/${c.id}`,
        retrievedAt: nowIso(),
      })),
    };
  },
};
