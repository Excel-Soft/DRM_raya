import { Router } from "express";
import { canonicalRoleKeys } from "@shared/legacy-role-keys";
import { z } from "zod";
import { pool } from "../db";
import { projectsRepository } from "../repositories/projects.repository";
import { authMiddleware } from "../middleware/auth.middleware";
import { normalizeRole } from "../utils/role-utils";
import { requireActionPermission } from "./middleware/action-permission";
import { shouldSoftFailDashboard } from "../utils/safe-dashboard-fallback";
import {
    ensureMenuPermissionsTable,
    ensureDrmSettingBotPermission,
    ensurePmsMenuSubUrls,
    fetchLegacyDrmSettingArchive,
    seedMenuPermissionsFromLegacyIfEmpty,
} from "../utils/menu-permissions-bootstrap";
import { ACTION_PERMISSIONS } from "../config/action-permissions";

const router = Router();
const TABLE = "drm.menu_permissions";

// Phase 3 — menu-permission create/update previously read req.body straight
// through with only `!name` checked. Already admin-gated (requirePermsAdmin),
// but add a strict schema so malformed subUrls/permissions/allowedRoleIds
// JSON shapes are rejected before they're persisted.
const subUrlsSchema = z
    .object({
        isRoot: z.boolean().optional(),
        items: z.array(z.string().trim().max(300)).max(200).optional(),
    })
    .strict();

export const permissionCreateSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required").max(200),
        menuIcon: z.string().trim().max(100).optional(),
        permissions: z.array(z.unknown()).max(500).optional(),
        subUrls: subUrlsSchema.optional(),
        allowedRoleIds: z.array(z.string().trim().max(100)).max(200).optional(),
    })
    .strict();

const permissionUpdateSchema = permissionCreateSchema.partial();

// drmRoutes is mounted BEFORE the global auth middleware, so auth must be applied
// locally. Reading the menu-permission config requires an authenticated session;
// mutating it (create / update / toggle / delete) is an admin-only RBAC action.
const requirePermsAdmin = [
    authMiddleware,
    requireActionPermission("drm.permissions.manage", {
        roles: ["admin"],
        message: "You are not authorized to modify permissions.",
    }),
];

// GET /api/drm/delay-projects/departments — legacy department list for filters
router.get("/delay-projects/departments", authMiddleware, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const { rows } = await client.query(
                `SELECT id, name FROM legacy_archive.webxl_department ORDER BY name ASC`,
            );
            res.json(rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error fetching delay departments:", error);
        res.status(500).json({ message: "Failed to fetch departments" });
    }
});

// GET /api/drm/delay-projects/persons — sales / project creators for filter dropdown
router.get("/delay-projects/persons", authMiddleware, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const departmentId =
                typeof req.query.departmentId === "string" && req.query.departmentId !== "all"
                    ? req.query.departmentId
                    : null;

            let sql = `
                SELECT DISTINCT u.user_id AS id, u.name AS name
                FROM legacy_archive.webxl_user u
                WHERE u.user_id IS NOT NULL AND trim(u.user_id) <> ''
                  AND u.name IS NOT NULL AND trim(u.name) <> ''
            `;
            const params: string[] = [];

            if (departmentId) {
                params.push(departmentId);
                sql = `
                    SELECT DISTINCT u.user_id AS id, u.name AS name
                    FROM legacy_archive.webxl_user u
                    INNER JOIN legacy_archive.webxl_create_project cp ON cp.user_id = u.user_id
                    LEFT JOIN legacy_archive.webxl_quotation_services qs ON qs.name = cp.project
                    WHERE u.user_id IS NOT NULL AND trim(u.user_id) <> ''
                      AND u.name IS NOT NULL AND trim(u.name) <> ''
                      AND qs.dep_id = $1
                `;
            }

            sql += ` ORDER BY name ASC`;

            const { rows } = await client.query(sql, params);
            if (rows.length > 0) {
                return res.json(rows);
            }

            const modern = await client.query(
                `SELECT id::text AS id, name FROM drm.users
                 WHERE deleted_at IS NULL AND name IS NOT NULL
                 ORDER BY name ASC`,
            );
            res.json(modern.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error fetching delay persons:", error);
        res.status(500).json({ message: "Failed to fetch persons" });
    }
});

// GET /api/drm/delay-projects
router.get("/delay-projects", authMiddleware, async (req, res) => {
    try {
        const { fetchLegacyDelayProjectsDetailed, fetchLegacyDelaySectionCounts } = await import(
            "../utils/delay-project-legacy"
        );
        if (req.query.counts === "1" || req.query.counts === "true") {
            const counts = await fetchLegacyDelaySectionCounts();
            return res.json({ success: true, counts });
        }
        const section = typeof req.query.section === "string" ? req.query.section : "all";
        const legacy = await fetchLegacyDelayProjectsDetailed({
            section: section as any,
            departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
            userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
            startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
            endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
        });
        if (legacy.total > 0) {
            return res.json({ success: true, ...legacy, source: "legacy" });
        }
        const projects = await projectsRepository.findDelayed();
        res.json({ success: true, data: projects, total: projects.length, source: "modern" });
    } catch (error) {
        console.error("Error fetching delayed projects:", error);
        res.status(500).json({ message: "Failed to fetch delayed projects" });
    }
});

// GET /api/drm/permissions
router.get("/permissions", authMiddleware, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            await ensureMenuPermissionsTable(client);
            await seedMenuPermissionsFromLegacyIfEmpty(client);
            await ensureDrmSettingBotPermission(client);
            await ensurePmsMenuSubUrls(client);
            const result = await client.query(
                `SELECT id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                        allowed_role_ids AS "allowedRoleIds", is_active AS "isActive",
                        legacy_source_id AS "legacySourceId", created_at AS "createdAt", updated_at AS "updatedAt"
                 FROM ${TABLE}
                 ORDER BY name ASC`
            );
            // Old-DRM role labels ("Sales Executive [L25]") -> role keys the sidebar matches on.
            res.json(result.rows.map((r: any) => ({ ...r, allowedRoleIds: canonicalRoleKeys(r.allowedRoleIds) })));
        } finally {
            client.release();
        }
    } catch (error) {
        if (shouldSoftFailDashboard(error, "GET /api/drm/permissions")) {
            return res.json([]);
        }
        console.error("Error fetching permissions:", error);
        res.status(500).json({ message: "Failed to fetch permissions" });
    }
});

// GET /api/drm/permissions/legacy-archive — read-only MySQL-era DRM Setting rows
router.get("/permissions/legacy-archive", authMiddleware, async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const rows = await fetchLegacyDrmSettingArchive(client);
            res.json(rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error fetching legacy DRM permissions:", error);
        res.status(500).json({ message: "Failed to fetch legacy permissions" });
    }
});

// GET /api/drm/permissions/action-rules — PATCH-6 backend action permission registry
router.get("/permissions/action-rules", authMiddleware, async (req, res) => {
    const rules = Object.entries(ACTION_PERMISSIONS).map(([key, policy]) => ({
        key,
        module: policy.module,
        description: policy.description ?? null,
        roles: policy.roles ?? null,
        adminOverride: policy.adminOverride ?? false,
        audit: policy.audit ?? false,
        entityType: policy.entityType ?? null,
        message: policy.message ?? null,
        hasAllowRolePredicate: typeof policy.allowRole === "function",
    }));
    rules.sort((a, b) => a.key.localeCompare(b.key));
    res.json({
        note: "Menu visibility still uses drm.menu_permissions; these keys guard sensitive API writes via requireActionPermission.",
        inlinePolicies: ["drm.permissions.manage (admin only, defined on DRM routes)"],
        rules,
    });
});

// GET /api/drm/permissions/debug
// Diagnostic endpoint: exposes schema + sample row, so it is restricted to
// super_admin/admin AND non-production only. (drmRoutes is mounted before the
// global auth middleware, so authMiddleware is applied locally here.)
router.get("/permissions/debug", authMiddleware, async (req, res) => {
    // Never available in production.
    if (process.env.NODE_ENV === "production") {
        return res.status(404).json({ error: "Not found" });
    }
    const role = normalizeRole(
        ((req.user as any)?.activeRoleId ?? (req.user as any)?.roleId ?? "") as string,
    );
    if (role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        const client = await pool.connect();
        const cols = await client.query(
            `SELECT column_name, data_type FROM information_schema.columns
             WHERE table_schema = 'drm' AND table_name = 'menu_permissions'
             ORDER BY ordinal_position`
        );
        const sample = await client.query(`SELECT * FROM ${TABLE} LIMIT 1`);
        client.release();
        res.json({ columns: cols.rows, sample: sample.rows[0] || null });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/drm/permissions
router.post("/permissions", ...requirePermsAdmin, async (req, res) => {
    try {
        const parsed = permissionCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid request payload", details: parsed.error.errors });
        }
        const { name, menuIcon, permissions: perms, subUrls } = parsed.data;
        // Store role KEYS, never old-DRM labels like "Sales Executive [L25]".
        const allowedRoleIds = parsed.data.allowedRoleIds === undefined ? undefined : canonicalRoleKeys(parsed.data.allowedRoleIds);

        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO ${TABLE} (name, menu_icon, is_active, permissions, sub_urls, allowed_role_ids)
                 VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::text[])
                 RETURNING id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                           allowed_role_ids AS "allowedRoleIds", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
                [
                    name,
                    menuIcon || 'Home',
                    true,
                    JSON.stringify(perms || []),
                    JSON.stringify(subUrls || { isRoot: true, items: [] }),
                    allowedRoleIds || [],
                ]
            );
            client.release();
            res.json(result.rows[0]);
        } catch (innerErr) {
            client.release();
            throw innerErr;
        }
    } catch (error) {
        console.error("Error creating permission:", error);
        res.status(500).json({ message: "Failed to create permission" });
    }
});

// POST /api/drm/permissions/:id/sub-urls
router.post("/permissions/:id/sub-urls", ...requirePermsAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { url } = req.body;

        if (!url) return res.status(400).json({ message: "Url is required" });

        const client = await pool.connect();
        try {
            const current = await client.query(`SELECT sub_urls FROM ${TABLE} WHERE id = $1`, [id]);
            if (!current.rows.length) {
                client.release();
                return res.status(404).json({ message: "Permission not found" });
            }

            const currentSubUrls = current.rows[0].sub_urls || { isRoot: true, items: [] };
            const newItems = url.split(',').map((s: string) => s.trim()).filter(Boolean);
            const updatedItems = Array.from(new Set([...(currentSubUrls.items || []), ...newItems]));
            const updatedSubUrls = { ...currentSubUrls, items: updatedItems };

            const result = await client.query(
                `UPDATE ${TABLE} SET sub_urls = $1::jsonb, updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                           allowed_role_ids AS "allowedRoleIds", is_active AS "isActive"`,
                [JSON.stringify(updatedSubUrls), id]
            );
            client.release();
            res.json(result.rows[0]);
        } catch (innerErr) {
            client.release();
            throw innerErr;
        }
    } catch (error) {
        console.error("Error adding sub urls:", error);
        res.status(500).json({ message: "Failed to add sub urls" });
    }
});

// PUT /api/drm/permissions/:id/toggle
router.put("/permissions/:id/toggle", ...requirePermsAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();
        try {
            const current = await client.query(`SELECT is_active FROM ${TABLE} WHERE id = $1`, [id]);
            if (!current.rows.length) {
                client.release();
                return res.status(404).json({ message: "Permission not found" });
            }

            const result = await client.query(
                `UPDATE ${TABLE} SET is_active = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                           allowed_role_ids AS "allowedRoleIds", is_active AS "isActive"`,
                [!current.rows[0].is_active, id]
            );
            client.release();
            res.json(result.rows[0]);
        } catch (innerErr) {
            client.release();
            throw innerErr;
        }
    } catch (error) {
        console.error("Error toggling permission:", error);
        res.status(500).json({ message: "Failed to toggle status" });
    }
});

// PUT /api/drm/permissions/:id  (full update)
router.put("/permissions/:id", ...requirePermsAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = permissionUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid request payload", details: parsed.error.errors });
        }
        const { name, menuIcon, permissions: perms, subUrls } = parsed.data;
        // Store role KEYS, never old-DRM labels like "Sales Executive [L25]".
        const allowedRoleIds = parsed.data.allowedRoleIds === undefined ? undefined : canonicalRoleKeys(parsed.data.allowedRoleIds);

        const client = await pool.connect();
        try {
            const setParts: string[] = ["updated_at = NOW()"];
            const vals: any[] = [id];

            if (name !== undefined) { vals.push(name); setParts.push(`name = $${vals.length}`); }
            if (menuIcon !== undefined) { vals.push(menuIcon); setParts.push(`menu_icon = $${vals.length}`); }
            if (perms !== undefined) { vals.push(JSON.stringify(perms)); setParts.push(`permissions = $${vals.length}::jsonb`); }
            if (subUrls !== undefined) { vals.push(JSON.stringify(subUrls)); setParts.push(`sub_urls = $${vals.length}::jsonb`); }
            if (allowedRoleIds !== undefined) { vals.push(allowedRoleIds); setParts.push(`allowed_role_ids = $${vals.length}::text[]`); }

            const result = await client.query(
                `UPDATE ${TABLE} SET ${setParts.join(', ')}
                 WHERE id = $1
                 RETURNING id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                           allowed_role_ids AS "allowedRoleIds", is_active AS "isActive"`,
                vals
            );

            if (!result.rows.length) {
                client.release();
                return res.status(404).json({ message: "Permission not found" });
            }

            client.release();
            res.json(result.rows[0]);
        } catch (innerErr) {
            client.release();
            throw innerErr;
        }
    } catch (error) {
        console.error("Error updating permission:", error);
        res.status(500).json({ message: "Failed to update permission" });
    }
});

// DELETE /api/drm/permissions/:id
router.delete("/permissions/:id", ...requirePermsAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const client = await pool.connect();
        await client.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
        client.release();
        res.status(200).json({ message: "Permission deleted" });
    } catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({ message: "Failed to delete permission" });
    }
});

export default router;
