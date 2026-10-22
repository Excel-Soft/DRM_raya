import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { isCustomerInScope } from "../identity";
import { customersRepository } from "../../../repositories/customers.repository";

const schema = z.object({
  customerId: z.string().uuid(),
});

export const getCustomerSummaryTool: ToolDefinition = {
  name: "get_customer_summary",
  description:
    "Authorised customer detail: profile, recent follow-ups, and linked GM entries. Only works for a customer the current user owns or is authorised to view.",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      customerId: { type: "string", format: "uuid", description: "Customer record id." },
    },
    required: ["customerId"],
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});
    const inScope = await isCustomerInScope(ctx.identity, args.customerId);
    if (!inScope) {
      return { ok: false, unavailable: "not authorised to view this customer", sourceRefs: [] };
    }

    const customer = await customersRepository.findById(args.customerId);
    if (!customer) {
      return { ok: false, unavailable: "customer not found", sourceRefs: [] };
    }

    const [followUps, gmEntries] = await Promise.all([
      customersRepository.getFollowUpDetails(args.customerId),
      customersRepository.getCustomerGmEntries(args.customerId),
    ]);
    const followUpList = Array.isArray(followUps) ? followUps.slice(0, 10) : [];
    const gmList = Array.isArray(gmEntries) ? gmEntries.slice(0, 10) : [];

    return {
      ok: true,
      data: {
        customer: {
          id: customer.id,
          companyName: (customer as any).companyName,
          status: (customer as any).status,
          grade: (customer as any).grade,
          region: (customer as any).region,
        },
        recentFollowUps: followUpList.map((f: any) => ({
          id: f.id,
          serviceName: f.serviceName ?? null,
          note: f.note ?? null,
          createdAt: f.createdAt,
        })),
        gmEntries: gmList.map((g: any) => ({
          id: g.id,
          package: g.package ?? null,
          status: g.status,
          hodStatus: g.hodStatus ?? null,
          paymentStatus: g.paymentStatus ?? null,
        })),
      },
      sourceRefs: [
        { type: "customer", id: String(customer.id), label: (customer as any).companyName, route: `/customers/attribute/${customer.id}`, retrievedAt: nowIso() },
        ...gmList.map((g: any) => ({ type: "gm_entry", id: String(g.id), route: "/account/gm-entries", retrievedAt: nowIso() })),
      ],
    };
  },
};
