import { Router } from "express";
import { db } from "../db";
import { attributes } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { requireActionPermission } from "./middleware/action-permission.middleware";
import { AuditLogService } from "./services/audit-log.service";

const router = Router();

const categorySchema = z.string().trim().min(1).max(100);
const createSchema = z.object({
    category: z.string().trim().min(1).max(100),
    // 200 was too tight once this table started holding Q&A answer text
    // (full sentences/paragraphs), not just short option names.
    name: z.string().trim().min(1).max(2000),
    // Set only when this row is a child of another attribute in the same
    // category (e.g. an answer under a Q&A question) — omitted/null for a
    // normal top-level entry.
    parentId: z.string().uuid().nullable().optional(),
    // Set only for categories that carry a default numeric value alongside
    // the name (e.g. "Penalty Head" rows each have a standard deduction
    // amount) — omitted/null everywhere else.
    amount: z.coerce.number().nullable().optional(),
    // Free-text date label ("Govt Leave": "DD Mon"; "Account Monthly Task":
    // a bare day-of-month) — omitted/null everywhere else.
    dateLabel: z.string().trim().max(50).nullable().optional(),
    // Office branch a recurring "Account Monthly Task" line belongs to —
    // omitted/null everywhere else.
    branch: z.string().trim().max(100).nullable().optional(),
    // Contact info on a "Buyer Detail" child row (a reference/contact under
    // a top-level buyer) — omitted/null everywhere else.
    email: z.string().trim().max(255).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
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
            // Oldest-first — this page is a reference/master list (options
            // meant to be selected from elsewhere), not an activity feed, so
            // items should display in the order they were entered rather than
            // reshuffling to newest-first every time one is added.
            const entries = await db
                .select()
                .from(attributes)
                .where(eq(attributes.category, category))
                .orderBy(asc(attributes.createdAt));

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
            const { category, name, parentId, amount, dateLabel, branch, email, phone } = parsed.data;

            const [newEntry] = await db
                .insert(attributes)
                .values({
                    category,
                    name,
                    parentId: parentId ?? null,
                    amount: amount != null ? String(amount) : null,
                    dateLabel: dateLabel ?? null,
                    branch: branch ?? null,
                    email: email ?? null,
                    phone: phone ?? null,
                })
                .returning();

            await AuditLogService.record({
                actorUserId: actorId(req),
                action: "attributes.create",
                module: "attributes",
                entityType: "Attribute",
                entityId: String(newEntry?.id ?? ""),
                after: { category, name, parentId: parentId ?? null, amount: amount ?? null, dateLabel: dateLabel ?? null, branch: branch ?? null, email: email ?? null, phone: phone ?? null },
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
