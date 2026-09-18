import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { branchesRepository } from "../repositories/branches.repository";
import { requireRole } from "../middleware/auth.middleware";

// Dynamic, admin-manageable company branch/office list. Single source of
// truth for "Office" everywhere — reads are open to any authenticated user
// (e.g. IT Asset Management needs to populate its Office picker/tabs
// regardless of role); writes are restricted to HOD-tier and above.
const BRANCH_WRITE_ROLES = ["admin", "super_admin", "super_hod", "hod"];

const branchInputSchema = z
  .object({
    name: z.string().trim().min(1, "Branch name is required").max(200),
    code: z.string().trim().max(50).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .strict();

const branchUpdateSchema = branchInputSchema.partial();

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });
    const includeInactive = String(req.query.includeInactive) === "true";
    const branches = await branchesRepository.list(includeInactive);
    return res.json({ success: true, data: branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return res.status(500).json({ error: "Failed to fetch branches" });
  }
});

router.post("/", requireRole(...BRANCH_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = branchInputSchema.parse(req.body);
    const existing = await branchesRepository.findByName(parsed.name);
    if (existing) {
      return res.status(409).json({ error: "A branch with this name already exists" });
    }
    const branch = await branchesRepository.create(parsed, actorId(req));
    return res.status(201).json({ success: true, data: branch });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid branch data", details: error.errors });
    }
    console.error("Error creating branch:", error);
    return res.status(500).json({ error: "Failed to create branch" });
  }
});

router.patch("/:id", requireRole(...BRANCH_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const parsed = branchUpdateSchema.parse(req.body);
    if (parsed.name) {
      const existing = await branchesRepository.findByName(parsed.name);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: "A branch with this name already exists" });
      }
    }
    const branch = await branchesRepository.update(req.params.id, parsed, actorId(req));
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    return res.json({ success: true, data: branch });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid branch data", details: error.errors });
    }
    console.error("Error updating branch:", error);
    return res.status(500).json({ error: "Failed to update branch" });
  }
});

router.delete("/:id", requireRole(...BRANCH_WRITE_ROLES), async (req: Request, res: Response) => {
  try {
    const deleted = await branchesRepository.softDelete(req.params.id, actorId(req));
    if (!deleted) return res.status(404).json({ error: "Branch not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return res.status(500).json({ error: "Failed to delete branch" });
  }
});

export default router;
