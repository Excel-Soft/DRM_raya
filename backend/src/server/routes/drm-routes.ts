import { Router } from "express";
import { pool } from "../db";
import { projectsRepository } from "../repositories/projects.repository";
import { authMiddleware } from "../middleware/auth.middleware";
import { normalizeRole } from "../utils/role-utils";
import { requireActionPermission } from "../middleware/action-permission";

const router = Router();
const TABLE = "drm.menu_permissions";

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

// GET /api/drm/delay-projects
router.get("/delay-projects", authMiddleware, async (req, res) => {
    try {
        const projects = await projectsRepository.findDelayed();
        res.json({ success: true, data: projects });
    } catch (error) {
        console.error("Error fetching delayed projects:", error);
        res.status(500).json({ message: "Failed to fetch delayed projects" });
    }
});

// GET /api/drm/permissions
router.get("/permissions", authMiddleware, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
            `SELECT id, name, menu_icon AS "menuIcon", permissions, sub_urls AS "subUrls",
                    allowed_role_ids AS "allowedRoleIds", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
             FROM ${TABLE}
             ORDER BY created_at ASC`
        );
        client.release();
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching permissions:", error);
        res.status(500).json({ message: "Failed to fetch permissions" });
    }
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
        const { name, menuIcon, permissions: perms, subUrls, allowedRoleIds } = req.body;
        if (!name) return res.status(400).json({ message: "Name is required" });

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
        const { name, menuIcon, permissions: perms, subUrls, allowedRoleIds } = req.body;

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
