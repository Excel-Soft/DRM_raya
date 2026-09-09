import { db } from "../server/db";
import { roles, permissions, rolePermissions } from "@shared/schema";
import { ROLES } from "../server/utils/role-utils";
import { eq } from "drizzle-orm";

async function seedRBAC() {
    console.log("Seeding RBAC data...");

    // 1. Ensure Roles exist
    // We use the keys from ROLES helper
    const rolesToSeed = [
        { name: ROLES.ADMIN, description: "Administrator with full access" },
        { name: ROLES.SALES_MANAGER, description: "Sales Team Manager" },
        { name: ROLES.SALES_ASSISTANT_MANAGER, description: "Assistant Sales Manager" },
        { name: ROLES.SALES_EXECUTIVE, description: "Sales Executive" },
        { name: ROLES.ACCOUNT_MANAGER, description: "Accounts Department Manager" },
        { name: ROLES.DEVELOPER, description: "Software Developer" },
        // Legacy support
        { name: ROLES.HOD, description: "Head of Department (Legacy)" },
        { name: ROLES.SUPER_HOD, description: "Super HOD (Legacy)" },
    ];

    for (const role of rolesToSeed) {
        // Check if exists
        const existing = await db.select().from(roles).where(eq(roles.name, role.name)).limit(1);
        if (existing.length === 0) {
            await db.insert(roles).values(role);
            console.log(`Created role: ${role.name}`);
        } else {
            console.log(`Role exists: ${role.name}`);
        }
    }

    // 2. Define Permissions
    const permissionDefs = [
        // Users
        { name: "users:read", module: "users", action: "read", description: "View users" },
        { name: "users:write", module: "users", action: "write", description: "Create/Edit users" },
        // RBAC
        { name: "rbac:read", module: "rbac", action: "read", description: "View roles and permissions" },
        { name: "rbac:write", module: "rbac", action: "write", description: "Manage roles and permissions" },
        // Audit
        { name: "audit:read", module: "audit", action: "read", description: "View audit logs" },
        // Sales
        { name: "sales:leads:read", module: "sales", action: "read", description: "View leads" },
        { name: "sales:leads:write", module: "sales", action: "write", description: "Manage leads" },
    ];

    for (const perm of permissionDefs) {
        const existing = await db.select().from(permissions).where(eq(permissions.name, perm.name)).limit(1);
        if (existing.length === 0) {
            await db.insert(permissions).values(perm);
            console.log(`Created permission: ${perm.name}`);
        }
    }

    // 3. Assign Permissions to Roles (Basic Mapping)
    const rolePermissionMap: Record<string, string[]> = {
        [ROLES.ADMIN]: ["users:read", "users:write", "rbac:read", "rbac:write", "audit:read", "sales:leads:read", "sales:leads:write"],
        [ROLES.SALES_MANAGER]: ["sales:leads:read", "sales:leads:write", "users:read"],
        [ROLES.SALES_EXECUTIVE]: ["sales:leads:read", "sales:leads:write"],
        [ROLES.DEVELOPER]: ["users:read"],
    };

    for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
        // Get Role ID
        const roleRecord = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
        if (roleRecord.length === 0) continue;

        for (const permName of permNames) {
            // Get Permission ID
            const permRecord = await db.select().from(permissions).where(eq(permissions.name, permName)).limit(1);
            if (permRecord.length === 0) continue;

            // Check existence
            const existing = await db.select().from(rolePermissions).where(
                eq(rolePermissions.roleId, roleRecord[0].id)
            ).limit(100); // Simple check, ideally check specific pair but dql is verbose

            const exists = existing.some(rp => rp.permissionId === permRecord[0].id);

            if (!exists) {
                await db.insert(rolePermissions).values({
                    roleId: roleRecord[0].id,
                    permissionId: permRecord[0].id
                });
                console.log(`Assigned ${permName} to ${roleName}`);
            }
        }
    }

    console.log("RBAC Seed Complete.");
}

seedRBAC().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
