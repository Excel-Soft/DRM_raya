import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { servicesRepository, type ServiceInput } from "../repositories/services.repository";
import { requireRole } from "../middleware/auth.middleware";

// "Service for Quotation" catalogue — the 3-level Service -> Sub-Service ->
// Sub-Sub-Service hierarchy shown on /drm/attributes. Reads are open to any
// authenticated user (the invoice/quotation product picker at
// /api/sales/services already relies on this data being broadly readable).
// Writes: admin/super_hod/hod — every other Attributes category is actually
// unguarded today (their requireActionPermission() middleware is a stub that
// always passes through), so restricting this one category to less than hod
// would make it the odd one out rather than "consistent with the rest of
// the page".
const SERVICE_WRITE_ROLES = ["admin", "super_hod", "hod"];

// Department codes are free text (matching projects.departmentType elsewhere
// in this schema) — not an enum, so any string is accepted here and the
// curated multi-select list lives client-side only.
const serviceInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(300),
    description: z.string().trim().max(2000).nullable().optional(),
    price: z.coerce.number().nullable().optional(),
    discount: z.coerce.number().nullable().optional(),
    minDay: z.coerce.number().int().nullable().optional(),
    maxDay: z.coerce.number().int().nullable().optional(),
    depId: z.coerce.number().int().nullable().optional(),
    routeDepartments: z.array(z.string().trim().min(1)).nullable().optional(),
    // Single department a project routes to once an invoice for this line
    // is approved — unlike routeDepartments (who may USE the service), this
    // is exactly one value.
    projectDepartment: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const serviceUpdateSchema = serviceInputSchema.partial();

function toServiceInput(parsed: z.infer<typeof serviceInputSchema>): ServiceInput {
  return {
    name: parsed.name,
    description: parsed.description ?? null,
    price: parsed.price ?? null,
    discount: parsed.discount ?? null,
    minDay: parsed.minDay ?? null,
    maxDay: parsed.maxDay ?? null,
    depId: parsed.depId ?? null,
    routeDepartments: parsed.routeDepartments ?? null,
    projectDepartment: parsed.projectDepartment ?? null,
  };
}

// PATCH bodies are partial (serviceUpdateSchema) — a field the caller didn't
// send must stay untouched in the DB, not get coerced to null the way
// toServiceInput() deliberately does for a full create. buildSetClause()
// only writes keys that are !== undefined, so passing the parsed partial
// through as-is (instead of defaulting every missing field to null) is what
// makes a PATCH actually partial.
function toServicePatch(parsed: z.infer<typeof serviceUpdateSchema>): Partial<ServiceInput> {
  return parsed;
}

const router = Router();

// ── Level 1: services ──────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });
    const list = await servicesRepository.listActiveWithSubservices();
    return res.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching services catalogue:", error);
    return res.status(500).json({ error: "Failed to fetch services" });
  }
});

router.post("/", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceInputSchema.parse(req.body);
    const created = await servicesRepository.createService(toServiceInput(parsed));
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid service data", details: error.errors });
    }
    console.error("Error creating service:", error);
    return res.status(500).json({ error: "Failed to create service" });
  }
});

router.patch("/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceUpdateSchema.parse(req.body);
    const updated = await servicesRepository.updateService(req.params.id, toServicePatch(parsed));
    if (!updated) return res.status(404).json({ error: "Service not found" });
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid service data", details: error.errors });
    }
    console.error("Error updating service:", error);
    return res.status(500).json({ error: "Failed to update service" });
  }
});

router.delete("/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const deleted = await servicesRepository.softDeleteService(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Service not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(500).json({ error: "Failed to delete service" });
  }
});

// ── Level 2: sub-services ─────────────────────────────────────────────
router.post("/:serviceId/subservices", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceInputSchema.parse(req.body);
    const parent = await servicesRepository.findServiceRowById(req.params.serviceId);
    if (!parent) return res.status(404).json({ error: "Parent service not found" });
    const created = await servicesRepository.createSubservice(req.params.serviceId, toServiceInput(parsed));
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid sub-service data", details: error.errors });
    }
    console.error("Error creating sub-service:", error);
    return res.status(500).json({ error: "Failed to create sub-service" });
  }
});

router.patch("/subservices/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceUpdateSchema.parse(req.body);
    const updated = await servicesRepository.updateSubservice(req.params.id, toServicePatch(parsed));
    if (!updated) return res.status(404).json({ error: "Sub-service not found" });
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid sub-service data", details: error.errors });
    }
    console.error("Error updating sub-service:", error);
    return res.status(500).json({ error: "Failed to update sub-service" });
  }
});

router.delete("/subservices/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const deleted = await servicesRepository.softDeleteSubservice(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Sub-service not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting sub-service:", error);
    return res.status(500).json({ error: "Failed to delete sub-service" });
  }
});

// ── Level 3: sub-sub-services ─────────────────────────────────────────
router.post("/subservices/:subserviceId/sub-subservices", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceInputSchema.parse(req.body);
    const parent = await servicesRepository.findSubserviceRowById(req.params.subserviceId);
    if (!parent) return res.status(404).json({ error: "Parent sub-service not found" });
    const created = await servicesRepository.createSubSubservice(req.params.subserviceId, toServiceInput(parsed));
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid sub-sub-service data", details: error.errors });
    }
    console.error("Error creating sub-sub-service:", error);
    return res.status(500).json({ error: "Failed to create sub-sub-service" });
  }
});

router.patch("/sub-subservices/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = serviceUpdateSchema.parse(req.body);
    const updated = await servicesRepository.updateSubSubservice(req.params.id, toServicePatch(parsed));
    if (!updated) return res.status(404).json({ error: "Sub-sub-service not found" });
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid sub-sub-service data", details: error.errors });
    }
    console.error("Error updating sub-sub-service:", error);
    return res.status(500).json({ error: "Failed to update sub-sub-service" });
  }
});

router.delete("/sub-subservices/:id", requireRole(...SERVICE_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const deleted = await servicesRepository.softDeleteSubSubservice(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Sub-sub-service not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting sub-sub-service:", error);
    return res.status(500).json({ error: "Failed to delete sub-sub-service" });
  }
});

export default router;
