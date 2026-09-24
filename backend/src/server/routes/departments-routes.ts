import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { departmentsRepository } from "../repositories/departments.repository";
import { requireRole } from "../middleware/auth.middleware";

// Dynamic, admin-manageable department list. Single source of truth for
// "Department" everywhere (Allowed Department(s) / Project Department on
// the service catalog, department labels on PMS approvals, etc.) — reads
// are open to any authenticated user (those pickers appear well outside the
// admin-only Attributes page); writes are restricted to HOD-tier and above,
// same as Company Branch.
const DEPARTMENT_WRITE_ROLES = ["admin", "super_admin", "super_hod", "hod"];

function slugifyCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const departmentInputSchema = z
  .object({
    name: z.string().trim().min(1, "Department name is required").max(200),
    code: z.string().trim().max(50).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .strict();

const departmentUpdateSchema = departmentInputSchema.partial();

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });
    const includeInactive = String(req.query.includeInactive) === "true";
    const departments = await departmentsRepository.list(includeInactive);
    return res.json({ success: true, data: departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.post("/", requireRole(...DEPARTMENT_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = departmentInputSchema.parse(req.body);
    const code = slugifyCode(parsed.code || parsed.name);
    if (!code) {
      return res.status(400).json({ error: "Could not derive a department code from the given name" });
    }
    const [existingName, existingCode] = await Promise.all([
      departmentsRepository.findByName(parsed.name),
      departmentsRepository.findByCode(code),
    ]);
    if (existingName) {
      return res.status(409).json({ error: "A department with this name already exists" });
    }
    if (existingCode) {
      return res.status(409).json({ error: "A department with this code already exists" });
    }
    const department = await departmentsRepository.create({ ...parsed, code }, actorId(req));
    return res.status(201).json({ success: true, data: department });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid department data", details: error.errors });
    }
    console.error("Error creating department:", error);
    return res.status(500).json({ error: "Failed to create department" });
  }
});

router.patch("/:id", requireRole(...DEPARTMENT_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = departmentUpdateSchema.parse(req.body);
    if (parsed.name) {
      const existing = await departmentsRepository.findByName(parsed.name);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: "A department with this name already exists" });
      }
    }
    const nextCode = parsed.code != null ? slugifyCode(parsed.code) : undefined;
    if (nextCode) {
      const existing = await departmentsRepository.findByCode(nextCode);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: "A department with this code already exists" });
      }
    }
    const { code: _ignoredCode, ...rest } = parsed;
    const department = await departmentsRepository.update(
      req.params.id,
      { ...rest, ...(nextCode ? { code: nextCode } : {}) },
      actorId(req),
    );
    if (!department) return res.status(404).json({ error: "Department not found" });
    return res.json({ success: true, data: department });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid department data", details: error.errors });
    }
    console.error("Error updating department:", error);
    return res.status(500).json({ error: "Failed to update department" });
  }
});

router.delete("/:id", requireRole(...DEPARTMENT_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const existing = await departmentsRepository.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Department not found" });

    const refCount = await departmentsRepository.countServiceReferences(existing.code);
    if (refCount > 0) {
      return res.status(409).json({
        error: `This department is still used by ${refCount} service catalog ${refCount === 1 ? "entry" : "entries"}. Remove it from those services first, or deactivate it instead of deleting.`,
      });
    }

    const deleted = await departmentsRepository.softDelete(req.params.id, actorId(req));
    if (!deleted) return res.status(404).json({ error: "Department not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return res.status(500).json({ error: "Failed to delete department" });
  }
});

export default router;
