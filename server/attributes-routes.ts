import { Router } from "express";
import { db } from "./db";
import { attributes } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireActionPermission } from "./middleware/action-permission.middleware";
import { AuditLogService } from "./services/audit-log.service";

const router = Router();

const categorySchema = z.string().trim().min(1).max(100);
const createSchema = z.object({
    category: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
});

function actorId(req: any): string | undefined {
    return req.user?.userId ?? req.user?.id ?? req.user?.user_id;
}

// GET /api/attributes/:category — authenticated-only (feeds dropdowns app-wide).
router.get(
    "/attributes/:category",
    requireActionPermission("attributes.view"),
    async (req, res) => {
        try {
            const parsed = categorySchema.safeParse(req.params.category);
            if (!parsed.success) {
                return res.status(400).json({ error: "Invalid category" });
            }
            const category = parsed.data;
            const entries = await db
                .select()
                .from(attributes)
                .where(eq(attributes.category, category))
                .orderBy(desc(attributes.createdAt));

            res.json(entries);
        } catch (error) {
            console.error("Error fetching attributes:", error);
            res.status(500).json({ error: "Failed to fetch attributes" });
        }
    },
);

// POST /api/attributes — admin / super_hod only (audited).
router.post(
    "/attributes",
    requireActionPermission("attributes.create"),
    async (req, res) => {
        try {
            const parsed = createSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: "Category and Name are required" });
            }
            const { category, name } = parsed.data;

            const [newEntry] = await db
                .insert(attributes)
                .values({ category, name })
                .returning();

            await AuditLogService.record({
                actorUserId: actorId(req),
                action: "attributes.create",
                module: "attributes",
                entityType: "Attribute",
                entityId: String(newEntry?.id ?? ""),
                after: { category, name },
                req,
            });

            res.status(201).json(newEntry);
        } catch (error) {
            console.error("Error creating attribute:", error);
            res.status(500).json({ error: "Failed to create attribute" });
        }
    },
);

// DELETE /api/attributes/:id — admin / super_hod only (audited).
router.delete(
    "/attributes/:id",
    requireActionPermission("attributes.delete"),
    async (req, res) => {
        try {
            const id = String(req.params.id);

            const [existing] = await db
                .select()
                .from(attributes)
                .where(eq(attributes.id, id));

            await db.delete(attributes).where(eq(attributes.id, id));

            await AuditLogService.record({
                actorUserId: actorId(req),
                action: "attributes.delete",
                module: "attributes",
                entityType: "Attribute",
                entityId: id,
                before: existing
                    ? { category: existing.category, name: existing.name }
                    : undefined,
                req,
            });

            res.json({ success: true });
        } catch (error) {
            console.error("Error deleting attribute:", error);
            res.status(500).json({ error: "Failed to delete attribute" });
        }
    },
);

export default router;
