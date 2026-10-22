import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { servicesRepository } from "../../../repositories/services.repository";

const schema = z.object({});

export const getApprovedServiceOptionsTool: ToolDefinition = {
  name: "get_approved_service_options",
  description:
    "Active service catalogue: plan, duration, and price. 'is_active' is the closest thing this system has to an approval flag — data is never labeled approved beyond that.",
  schema,
  jsonSchema: { type: "object", properties: {} },
  async handler(_rawArgs, _ctx) {
    const services = await servicesRepository.listActiveWithSubservices();
    const rows = services.slice(0, 50).map((s: any) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      price: s.price,
      minDay: s.minDay,
      maxDay: s.maxDay,
      subServices: Array.isArray(s.subServices)
        ? s.subServices.slice(0, 10).map((sub: any) => ({ id: sub.id, code: sub.code, name: sub.name, price: sub.price }))
        : [],
    }));
    return {
      ok: true,
      data: { services: rows },
      sourceRefs: rows.map((s) => ({ type: "service", id: String(s.id), label: s.name, route: "/sales/quotation", retrievedAt: nowIso() })),
    };
  },
};
