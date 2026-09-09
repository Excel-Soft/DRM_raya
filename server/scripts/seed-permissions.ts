
import { db, pool } from "../db";
import { urlPermissions, insertUrlPermissionSchema } from "@shared/schema";
import { sql } from "drizzle-orm";

const mockData = [
    {
        path: "users",
        name: "Users",
        menuIcon: "Users",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["add-users", "users-list", "groups"] },
        allowedRoleIds: ["14", "32"],
        isActive: true,
    },
    {
        path: "attendance",
        name: "Attendance",
        menuIcon: "CalendarCheck",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
            { name: "Reception Department", type: "default" },
            { name: "Project Department", type: "default" },
            { name: "SEO/SMM Department", type: "default" },
            { name: "Product Posting", type: "default" },
            { name: "D&D Department", type: "default" },
            { name: "Internship & Trainee", type: "default" },
            { name: "Accounts Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["attendance-check", "leave-form", "over-time", "to-do-list", "advance-salary", "user-profile"] },
        allowedRoleIds: ["14", "48"],
        isActive: true,
    },
    {
        path: "customer",
        name: "Customer",
        menuIcon: "TrendingUp",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
            { name: "Reception Department", type: "default" },
            { name: "IT Department", type: "default" },
            { name: "QA Department", type: "default" },
            { name: "Verification Department", type: "default" },
            { name: "Head of Department", type: "default" },
            { name: "Lead Department", type: "default" },
            { name: "Trade Assurance", type: "default" },
            { name: "Software Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["duplication", "add-customer", "temp-contact", "private-pool", "service-pool", "gm-bv-pool", "in-service-report", "public-pool"] },
        allowedRoleIds: ["14", "2", "25"],
        isActive: true,
    },
    {
        path: "drm-setting",
        name: "DRM Setting",
        menuIcon: "Settings",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
            { name: "Head of Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["drm-attributes", "drm-permission", "add-promotion", "project-delay-filter", "related-customer", "pms-project-assign", "bot-system", "form-created", "fb-post"] },
        allowedRoleIds: ["14", "32", "48"],
        isActive: true,
    },
    {
        path: "account",
        name: "Account",
        menuIcon: "DollarSign",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["create-gm", "create-tem-gm", "refund-list", "donations", "make-invoice", "company-ledger"] },
        allowedRoleIds: ["14", "32"],
        isActive: true,
    },
    {
        path: "office-account",
        name: "Office Account",
        menuIcon: "Briefcase",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
            { name: "Super HOD", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["trial-balance-report", "old-expense-report", "chart-of-account", "expense-head", "business-customer", "office-vas", "expenses-report", "cheque-system"] },
        allowedRoleIds: ["14", "32", "73"],
        isActive: true,
    },
    {
        path: "target-system",
        name: "Target System",
        menuIcon: "Target",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
            { name: "Head of Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["target-create", "target-set", "target-view", "target-day", "kwa-add", "kwa-history"] },
        allowedRoleIds: ["14", "32", "48"],
        isActive: true,
    },
    {
        path: "reports",
        name: "Reports",
        menuIcon: "FileText",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Accounts Department", type: "default" },
            { name: "Head of Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["bv-pending-report", "advance-salary", "salary-create", "salary-report", "attendance-report", "vas-report", "gm-report", "bv-report", "gmbv-person", "in-service-report", "diagnose-report", "follow-report", "project-report", "target-report", "link-report", "dep-report", "event-report", "reception-report", "edit-att", "create-all-salary", "salary-only", "daily-gm-record"] },
        allowedRoleIds: ["14", "48", "32"],
        isActive: true,
    },
    {
        path: "domain-hosting",
        name: "Domain Hosting",
        menuIcon: "Server",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "IT Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["server-settings", "domain-list", "domain-backup"] },
        allowedRoleIds: ["14", "48", "45", "46"],
        isActive: true,
    },
    {
        path: "pms",
        name: "PMS",
        menuIcon: "ClipboardList",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
            { name: "Product Posting", type: "default" },
            { name: "SEO/SMM Department", type: "default" },
            { name: "D&D Department", type: "default" },
            { name: "Software Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["pms-projects", "pms-task-create", "pms-running-project", "pms-pending-project", "pms-project-task", "work-spaces", "dep-report"] },
        allowedRoleIds: ["14", "48"],
        isActive: true,
    },
    {
        path: "portfolio",
        name: "Portfolio",
        menuIcon: "Image",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "D&D Department", type: "default" },
            { name: "Lead Department", type: "default" },
            { name: "Verification Department", type: "default" },
            { name: "Complaint Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["portfolio-add", "portfolio-view"] },
        allowedRoleIds: ["14", "48", "58", "59"],
        isActive: true,
    },
    {
        path: "posting-data",
        name: "Posting Data",
        menuIcon: "Database",
        permissions: [
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
            { name: "Product Posting", type: "default" },
            { name: "D&D Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["add-posting-products", "add-posting-keywords", "view-posting-keywords", "view-posting-product", "data-verify", "link-report", "restricted-keywords"] },
        allowedRoleIds: ["14", "48", "35", "36", "37"],
        isActive: true,
    },
    {
        path: "notice",
        name: "Notice",
        menuIcon: "Bell",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
            { name: "Reception Department", type: "default" },
            { name: "IT Department", type: "default" },
            { name: "QA Department", type: "default" },
            { name: "Verification Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["pms-noteboard", "drm-policies", "project-delay-filter", "verification-step"] },
        allowedRoleIds: ["14", "48", "30"],
        isActive: true,
    },
    {
        path: "user-report",
        name: "User Report",
        menuIcon: "FileText",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Service Department", type: "default" },
            { name: "Product Posting", type: "default" },
            { name: "D&D Department", type: "default" },
            { name: "Trade Assurance", type: "default" },
            { name: "Reception Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["advance-salary", "vas-report", "gm-report", "bv-report"] },
        allowedRoleIds: ["14", "48"],
        isActive: true,
    },
    {
        path: "verification-report",
        name: "Verification Report",
        menuIcon: "ShieldAlert",
        permissions: [
            { name: "Verification Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["related-customer"] },
        allowedRoleIds: [],
        isActive: false,
    },
    {
        path: "events",
        name: "Events",
        menuIcon: "PartyPopper",
        permissions: [
            { name: "Marketing Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["add-event", "event-menu", "event-duty-planner"] },
        allowedRoleIds: ["14", "48", "60"],
        isActive: true,
    },
    {
        path: "training",
        name: "Training",
        menuIcon: "Video",
        permissions: [
            { name: "Sales Department", type: "sales" },
            { name: "Admin", type: "admin" },
            { name: "Service Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["training-video"] },
        allowedRoleIds: ["14", "48"],
        isActive: true,
    },
    {
        path: "allowed-ip",
        name: "Allowed IP",
        menuIcon: "Shield",
        permissions: [
            { name: "Admin", type: "admin" },
        ],
        subUrls: { isRoot: true, items: ["drm-allowed-ip"] },
        allowedRoleIds: ["14"],
        isActive: true,
    },
    {
        path: "daily-reports",
        name: "Daily Reports",
        menuIcon: "FileText",
        permissions: [
            { name: "Admin", type: "admin" },
        ],
        subUrls: { isRoot: true, items: ["daily-gm-record"] },
        allowedRoleIds: ["14"],
        isActive: true,
    },
    {
        path: "social-media-posting",
        name: "Social Media Posting",
        menuIcon: "Share2",
        permissions: [
            { name: "Marketing Department", type: "default" },
            { name: "Media Department", type: "default" },
            { name: "Head of Department", type: "default" },
        ],
        subUrls: { isRoot: true, items: ["today-posts"] },
        allowedRoleIds: ["14", "48", "60", "61"],
        isActive: true,
    },
];

async function seedPermissions() {
    console.log("Seeding permissions...");

    // Force recreate table
    console.log("Dropping and recreating url_permissions table...");
    try {
        await pool.query(`DROP TABLE IF EXISTS drm.url_permissions CASCADE`);
        await pool.query(`
        CREATE TABLE drm.url_permissions (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            path text NOT NULL UNIQUE,
            name text NOT NULL,
            menu_icon text,
            allowed_role_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
            permissions jsonb DEFAULT '[]'::jsonb,
            sub_urls jsonb,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp DEFAULT now() NOT NULL,
            updated_at timestamp DEFAULT now() NOT NULL
        )
        `);
        console.log("Table recreated.");
    } catch (e) {
        console.error("Error recreating table:", e);
        process.exit(1);
    }

    try {
        await pool.query('SET search_path TO drm, public');
        const cols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'drm' AND table_name = 'url_permissions'
        `);
        console.log(`Table columns: ${cols.rows.map(r => r.column_name).join(', ')}`);

        for (const item of mockData) {
            console.log(`Processing: ${item.path}...`);
            const validated = insertUrlPermissionSchema.parse(item);

            // Raw SQL check and insert/update
            const exists = await pool.query(`SELECT id FROM drm.url_permissions WHERE path = $1`, [validated.path]);

            if (exists.rows.length > 0) {
                await pool.query(`
                    UPDATE drm.url_permissions SET 
                        name = $1, menu_icon = $2, allowed_role_ids = $3, 
                        permissions = $4, sub_urls = $5, is_active = $6, updated_at = NOW()
                    WHERE path = $7
                `, [
                    validated.name, validated.menuIcon, validated.allowedRoleIds,
                    JSON.stringify(validated.permissions), JSON.stringify(validated.subUrls),
                    validated.isActive, validated.path
                ]);
                console.log(`Updated: ${item.path}`);
            } else {
                await pool.query(`
                    INSERT INTO drm.url_permissions (
                        path, name, menu_icon, allowed_role_ids, permissions, sub_urls, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    validated.path, validated.name, validated.menuIcon,
                    validated.allowedRoleIds, JSON.stringify(validated.permissions),
                    JSON.stringify(validated.subUrls), validated.isActive
                ]);
                console.log(`Inserted: ${item.path}`);
            }
        }
    } catch (err: any) {
        console.error("Seeding failed with error:", err?.message || err);
        if (err.detail) console.error("Detail:", err.detail);
        if (err.where) console.error("Where:", err.where);
        process.exit(1);
    }
    console.log(`Processed ${mockData.length} permissions.`);

    process.exit(0);
}

seedPermissions().catch((err) => {
    console.error("Error seeding permissions:", err);
    process.exit(1);
});
