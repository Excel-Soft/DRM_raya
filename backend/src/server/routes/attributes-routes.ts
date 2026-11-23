import { Router } from "express";
import { db } from "../db";
import { attributes } from "@shared/schema";
import { eq, asc, inArray } from "drizzle-orm";
import {
    deleteLegacyAbPackageRow,
    deleteLegacyAttributeRow,
    deleteLegacyBuyerRow,
    deleteLegacyDepartmentRow,
    deleteLegacyPenaltyHeadRow,
    deleteLegacyPortfolioCatRow,
    deleteLegacyQuestionRow,
    deleteLegacyWhatsappRow,
    fetchAlibabaPackagesTree,
    fetchCompanyBusinessCategoryTree,
    fetchLegacyAttributesForCategory,
    fetchLegacyDepartmentRows,
    fetchPortfolioCategoriesTree,
    filterModernRowsForSidebar,
    mergeAttributeLists,
    parseLegacyAbPackageId,
    parseLegacyAttributeId,
    parseLegacyBuyerId,
    parseLegacyDepartmentId,
    parseLegacyPenaltyId,
    parseLegacyPortfolioCatId,
    parseLegacyQuestionId,
    parseLegacyWhatsappId,
    resolveAttributeStorageCategory,
    resolveAttributeUiSources,
} from "../utils/attribute-legacy";
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

// Company Business Type — legacy hierarchical catalog (webxl_category, uae=type + nested tags).
router.get(
    "/attributes/company-business-type/tree",
    requireActionPermission("attributes.view"),
    async (_req, res) => {
        try {
            const tree = await fetchCompanyBusinessCategoryTree();
            res.json(tree);
        } catch (error) {
            console.error("Error fetching company business category tree:", error);
            res.status(500).json({ error: "Failed to fetch company business types" });
        }
    },
);

router.get(
    "/attributes/legacy-departments",
    requireActionPermission("attributes.view"),
    async (_req, res) => {
        try {
            res.json(await fetchLegacyDepartmentRows());
        } catch (error) {
            console.error("Error fetching legacy departments:", error);
            res.status(500).json({ error: "Failed to fetch departments" });
        }
    },
);

router.get(
    "/attributes/alibaba-packages/tree",
    requireActionPermission("attributes.view"),
    async (_req, res) => {
        try {
            res.json(await fetchAlibabaPackagesTree());
        } catch (error) {
            console.error("Error fetching alibaba packages tree:", error);
            res.status(500).json({ error: "Failed to fetch alibaba packages" });
        }
    },
);

router.get(
    "/attributes/portfolio-categories/tree",
    requireActionPermission("attributes.view"),
    async (_req, res) => {
        try {
            res.json(await fetchPortfolioCategoriesTree());
        } catch (error) {
            console.error("Error fetching portfolio categories tree:", error);
            res.status(500).json({ error: "Failed to fetch portfolio categories" });
        }
    },
);

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
            const { modernCategories } = resolveAttributeUiSources(category);

            let entries: (typeof attributes.$inferSelect)[] = [];
            if (modernCategories.length) {
                entries = await db
                    .select()
                    .from(attributes)
                    .where(inArray(attributes.category, modernCategories))
                    .orderBy(asc(attributes.createdAt));
                entries = await filterModernRowsForSidebar(category, entries);
            }

            const legacyRows = await fetchLegacyAttributesForCategory(category);
            const merged = mergeAttributeLists(category, entries as any, legacyRows);

            res.json(merged);
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
            const storageCategory = resolveAttributeStorageCategory(category);

            const [newEntry] = await db
                .insert(attributes)
                .values({
                    category: storageCategory,
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
            const legacyAttrPk = parseLegacyAttributeId(id);
            if (legacyAttrPk) {
                const deleted = await deleteLegacyAttributeRow(legacyAttrPk);
                if (!deleted) {
                    return res.status(404).json({ error: "Legacy attribute not found" });
                }
                await AuditLogService.record({
                    actorUserId: actorId(req),
                    action: "attributes.delete",
                    module: "attributes",
                    entityType: "LegacyAttribute",
                    entityId: legacyAttrPk,
                    before: { legacySource: "legacy_archive.webxl_attribute" },
                    req,
                });
                return res.json({ success: true });
            }
            const legacyQuestionPk = parseLegacyQuestionId(id);
            if (legacyQuestionPk) {
                const deleted = await deleteLegacyQuestionRow(legacyQuestionPk);
                if (!deleted) {
                    return res.status(404).json({ error: "Legacy Q&A row not found" });
                }
                await AuditLogService.record({
                    actorUserId: actorId(req),
                    action: "attributes.delete",
                    module: "attributes",
                    entityType: "LegacyQuestion",
                    entityId: legacyQuestionPk,
                    before: { legacySource: "legacy_archive.webxl_questions" },
                    req,
                });
                return res.json({ success: true });
            }

            const legacyArchiveDeletes: Array<{
                pk: string | null;
                remove: (id: string) => Promise<boolean>;
                entityType: string;
                legacySource: string;
            }> = [
                { pk: parseLegacyWhatsappId(id), remove: deleteLegacyWhatsappRow, entityType: "LegacyWhatsapp", legacySource: "legacy_archive.webxl_whatsapp" },
                { pk: parseLegacyPenaltyId(id), remove: deleteLegacyPenaltyHeadRow, entityType: "LegacyPenalty", legacySource: "legacy_archive.webxl_penalty_head" },
                { pk: parseLegacyBuyerId(id), remove: deleteLegacyBuyerRow, entityType: "LegacyBuyer", legacySource: "legacy_archive.webxl_dollar_buyer" },
                { pk: parseLegacyDepartmentId(id), remove: deleteLegacyDepartmentRow, entityType: "LegacyDepartment", legacySource: "legacy_archive.webxl_department" },
                { pk: parseLegacyAbPackageId(id), remove: deleteLegacyAbPackageRow, entityType: "LegacyAbPackage", legacySource: "legacy_archive.webxl_ab_packages" },
                { pk: parseLegacyPortfolioCatId(id), remove: deleteLegacyPortfolioCatRow, entityType: "LegacyPortfolioCategory", legacySource: "legacy_archive.webxl_portfolio_categories" },
            ];
            for (const entry of legacyArchiveDeletes) {
                if (!entry.pk) continue;
                const deleted = await entry.remove(entry.pk);
                if (!deleted) {
                    return res.status(404).json({ error: "Legacy row not found" });
                }
                await AuditLogService.record({
                    actorUserId: actorId(req),
                    action: "attributes.delete",
                    module: "attributes",
                    entityType: entry.entityType,
                    entityId: entry.pk,
                    before: { legacySource: entry.legacySource },
                    req,
                });
                return res.json({ success: true });
            }

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
