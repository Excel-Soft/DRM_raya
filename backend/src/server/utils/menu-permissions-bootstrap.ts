import type { PoolClient } from "pg";
import { normalizeRole } from "./role-utils";

const MENU_ICON_BY_TITLE: Record<string, string> = {
    Users: "Users",
    Customer: "TrendingUp",
    Attendance: "CalendarCheck",
    PMS: "ClipboardList",
    Portfolio: "Image",
    "User Report": "FileText",
    Reports: "BarChart3",
    "Daily Reports": "Activity",
    Training: "Book",
    Notice: "Bell",
    Account: "DollarSign",
    "Office Account": "Briefcase",
    "Target System": "Target",
    "DRM Setting": "Settings",
    Events: "CalendarCheck",
    "Social Media Posting": "Megaphone",
    "Posting Data": "Database",
    "Allowed IP": "Shield",
    "Verification Report": "FileSearch",
    "Domain Hosting": "Server",
};

function menuIconFor(title: string, legacyIcon: string | null): string {
    const t = title.trim();
    if (MENU_ICON_BY_TITLE[t]) return MENU_ICON_BY_TITLE[t];
  const icon = (legacyIcon || "").toLowerCase();
    if (icon.includes("user")) return "Users";
    if (icon.includes("calendar") || icon.includes("store")) return "CalendarCheck";
    if (icon.includes("cog")) return "Settings";
    if (icon.includes("file")) return "FileText";
    if (icon.includes("receipt") || icon.includes("briefcase")) return "Briefcase";
    return "Home";
}

function parseCsv(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function zipSubUrls(urlSlugs: string[], urlTitles: string[]): string[] {
    const items: string[] = [];
    const max = Math.max(urlSlugs.length, urlTitles.length);
    for (let i = 0; i < max; i++) {
        const slug = urlSlugs[i] || urlSlugs[urlSlugs.length - 1] || "";
        const title = urlTitles[i] || slug;
        if (!slug && !title) continue;
        if (title && slug && title !== slug) {
            items.push(`${title} → ${slug}`);
        } else {
            items.push(slug || title);
        }
    }
    return Array.from(new Set(items));
}

export async function ensureMenuPermissionsTable(client: PoolClient): Promise<void> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS drm.menu_permissions (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name text NOT NULL UNIQUE,
            menu_icon text,
            is_active boolean NOT NULL DEFAULT true,
            permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
            sub_urls jsonb NOT NULL DEFAULT '{"isRoot":true,"items":[]}'::jsonb,
            allowed_role_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
            legacy_source_id text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    `);
}

const PMS_SUB_URL_ITEMS = [
    "Task System → pms-task-create",
    "Project Report → pms-projects",
    "Overall Projects → pms-overall-projects",
    "Running Projects → pms-running-project",
    "Pending Project → pms-pending-project",
    "Task Complete → pms-project-task",
    "Complete and Closed Project → pms-complete-closed",
    "Team Workspace → work-spaces",
    "Project Report → dep-report",
];

/** Keep PMS permission row sub-URLs in sync with the live sidebar (DRM Permission UI). */
export async function ensurePmsMenuSubUrls(client: PoolClient): Promise<void> {
    const row = await client.query(
        `SELECT id, sub_urls FROM drm.menu_permissions WHERE name = 'PMS' LIMIT 1`,
    );
    if (!row.rows.length) return;

    const subUrls = row.rows[0].sub_urls || { isRoot: true, items: [] };
    const items: string[] = Array.isArray(subUrls.items) ? [...subUrls.items] : [];
    const next = Array.from(new Set([...items, ...PMS_SUB_URL_ITEMS]));
    if (next.length === items.length && items.every((v, i) => v === next[i])) return;

    await client.query(`UPDATE drm.menu_permissions SET sub_urls = $1::jsonb, updated_at = now() WHERE id = $2`, [
        JSON.stringify({ ...subUrls, isRoot: subUrls.isRoot !== false, items: next }),
        row.rows[0].id,
    ]);
}

/** Ensure DRM Setting submenu includes Bot system (for permission UI + parity with legacy). */
export async function ensureDrmSettingBotPermission(client: PoolClient): Promise<void> {
    const row = await client.query(
        `SELECT id, sub_urls FROM drm.menu_permissions WHERE name = 'DRM Setting' LIMIT 1`,
    );
    if (!row.rows.length) return;

    const subUrls = row.rows[0].sub_urls || { isRoot: true, items: [] };
    const items: string[] = Array.isArray(subUrls.items) ? [...subUrls.items] : [];
  const botEntry = "Bot system → bot-system";
    const hasBot =
        items.some((i) => /bot/i.test(String(i))) ||
        items.some((i) => String(i).includes("bot-system"));
    if (!hasBot) {
        items.push(botEntry);
        await client.query(`UPDATE drm.menu_permissions SET sub_urls = $1::jsonb, updated_at = now() WHERE id = $2`, [
            JSON.stringify({ ...subUrls, isRoot: subUrls.isRoot !== false, items }),
            row.rows[0].id,
        ]);
    }
}

export async function seedMenuPermissionsFromLegacyIfEmpty(client: PoolClient): Promise<number> {
    const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM drm.menu_permissions`);
    if ((countRes.rows[0]?.n ?? 0) > 0) return 0;

    const archiveExists = await client.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_drm_setting'
        LIMIT 1
    `);
    if (!archiveExists.rows.length) return 0;

    const legacyRows = await client.query(`
        SELECT id, menu_title, icon, url, url_title, dep, allowed_role, status
        FROM legacy_archive.webxl_drm_setting
        ORDER BY id::int ASC NULLS LAST, id ASC
    `);

    const deptRows = await client.query(`SELECT id, name FROM legacy_archive.webxl_department`);
    const deptById = new Map<string, string>();
    for (const row of deptRows.rows) {
        deptById.set(String(row.id), String(row.name));
    }

    const roleRows = await client.query(`SELECT id, name FROM legacy_archive.webxl_role`);
    const roleNameById = new Map<string, string>();
    for (const row of roleRows.rows) {
        roleNameById.set(String(row.id), String(row.name));
    }

    const usedNames = new Set<string>();
    let inserted = 0;

    for (const row of legacyRows.rows) {
        const legacyId = String(row.id);
        let name = String(row.menu_title || "").trim() || `Menu ${legacyId}`;
        if (usedNames.has(name)) {
            name = `${name} [L${legacyId}]`;
        }
        usedNames.add(name);

        const deptIds = parseCsv(row.dep);
        const permissions = deptIds
            .map((id) => deptById.get(id))
            .filter(Boolean)
            .map((deptName) => ({ name: deptName as string, type: "default" }));

        const roleIds = parseCsv(row.allowed_role);
        const allowedRoleIds = Array.from(
            new Set(
                roleIds
                    .map((id) => roleNameById.get(id) || id)
                    .map((label) => normalizeRole(label))
                    .filter(Boolean),
            ),
        );

        const subItems = zipSubUrls(parseCsv(row.url), parseCsv(row.url_title));
        const subUrls = { isRoot: true, items: subItems };
        const isActive = String(row.status || "active").toLowerCase() !== "inactive";
        const menuIcon = menuIconFor(String(row.menu_title || name), row.icon);

        await client.query(
            `INSERT INTO drm.menu_permissions
                (name, menu_icon, is_active, permissions, sub_urls, allowed_role_ids, legacy_source_id)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::text[], $7)
             ON CONFLICT (name) DO NOTHING`,
            [
                name,
                menuIcon,
                isActive,
                JSON.stringify(permissions),
                JSON.stringify(subUrls),
                allowedRoleIds,
                legacyId,
            ],
        );
        inserted += 1;
    }

    return inserted;
}

export interface LegacyDrmSettingRow {
    id: string;
    menuTitle: string;
    icon: string | null;
    url: string | null;
    urlTitle: string | null;
    departments: string[];
    allowedRoles: string[];
    status: string | null;
    isActive: boolean;
}

export async function fetchLegacyDrmSettingArchive(client: PoolClient): Promise<LegacyDrmSettingRow[]> {
    const archiveExists = await client.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_drm_setting'
        LIMIT 1
    `);
    if (!archiveExists.rows.length) return [];

    const legacyRows = await client.query(`
        SELECT id, menu_title, icon, url, url_title, dep, allowed_role, status
        FROM legacy_archive.webxl_drm_setting
        ORDER BY id::int ASC NULLS LAST, id ASC
    `);

    const deptRows = await client.query(`SELECT id, name FROM legacy_archive.webxl_department`);
    const deptById = new Map<string, string>();
    for (const row of deptRows.rows) {
        deptById.set(String(row.id), String(row.name));
    }

    const roleRows = await client.query(`SELECT id, name FROM legacy_archive.webxl_role`);
    const roleNameById = new Map<string, string>();
    for (const row of roleRows.rows) {
        roleNameById.set(String(row.id), String(row.name));
    }

    return legacyRows.rows.map((row) => {
        const deptIds = parseCsv(row.dep);
        const roleIds = parseCsv(row.allowed_role);
        const status = row.status ? String(row.status) : null;
        return {
            id: String(row.id),
            menuTitle: String(row.menu_title || ""),
            icon: row.icon ? String(row.icon) : null,
            url: row.url ? String(row.url) : null,
            urlTitle: row.url_title ? String(row.url_title) : null,
            departments: deptIds.map((id) => deptById.get(id) || `Dept #${id}`),
            allowedRoles: roleIds.map((id) => roleNameById.get(id) || `Role #${id}`),
            status,
            isActive: String(status || "active").toLowerCase() !== "inactive",
        };
    });
}
