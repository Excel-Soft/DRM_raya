import { db } from "../db";
import { usersRepository } from "../repositories/users.repository";
import { normalizeRole, type RoleKey, ROLES } from "../utils/role-utils";
import { eq } from "drizzle-orm";

export class ImpersonationService {

    /**
     * Logs the start of an impersonation session.
     * Non-fatal: if audit table doesn't exist, just console-log.
     */
    async logImpersonationStart(adminId: string, targetRole: string, ip?: string, agent?: string) {
        if (!adminId) return;
        console.log(`[IMPERSONATE] START adminId=${adminId} targetRole=${targetRole} ip=${ip}`);
        try {
            const { pool } = await import("../db");
            await pool.query(
                `INSERT INTO impersonation_audit_logs (admin_user_id, target_role, action, ip_address, user_agent) VALUES ($1, $2, 'start', $3, $4)`,
                [adminId, targetRole, ip || null, agent || null]
            );
        } catch (e: any) {
            console.warn("[IMPERSONATE] Could not write audit log (non-fatal):", e?.message);
        }
    }

    /**
     * Logs the stop of an impersonation session.
     * Non-fatal: if audit table doesn't exist, just console-log.
     */
    async logImpersonationStop(adminId: string, targetRole: string, ip?: string, agent?: string) {
        if (!adminId) return;
        console.log(`[IMPERSONATE] STOP adminId=${adminId} targetRole=${targetRole}`);
        try {
            const { pool } = await import("../db");
            await pool.query(
                `INSERT INTO impersonation_audit_logs (admin_user_id, target_role, action, ip_address, user_agent) VALUES ($1, $2, 'stop', $3, $4)`,
                [adminId, targetRole, ip || null, agent || null]
            );
        } catch (e: any) {
            console.warn("[IMPERSONATE] Could not write audit log (non-fatal):", e?.message);
        }
    }

    /**
     * Helper to verify if a user CAN impersonate (must be admin).
     * Checks ALL role fields from DB directly via raw SQL.
     */
    async canImpersonate(userId: string): Promise<boolean> {
        try {
            // Use raw SQL to get all role-related fields directly from DB
            // Use drm.users explicitly to avoid search_path issues on pooled connections
            const { pool } = await import("../db");
            const result = await pool.query(
                `SELECT role, role_id, roles FROM drm.users WHERE id = $1 LIMIT 1`,
                [userId]
            );

            if (!result.rows.length) return false;

            const row = result.rows[0];
            const adminKeys = ['admin', 'super_admin', 'administrator', 'adm'];

            // Check role column
            const roleNorm = (row.role || "").toLowerCase().replace(/\s+/g, "_");
            const roleIdNorm = (row.role_id || "").toLowerCase().replace(/\s+/g, "_");

            const isRoleAdmin = adminKeys.includes(roleNorm) || adminKeys.includes(roleIdNorm) || roleNorm.includes('admin') || roleIdNorm.includes('admin') || roleNorm === 'super_hod';

            console.log(`[IMPERSONATE] DB check for userId=${userId}: role="${row.role}", role_id="${row.role_id}", roles=${JSON.stringify(row.roles)}`);

            if (isRoleAdmin) {
                console.log(`[IMPERSONATE] ✅ Admin confirmed via role/role_id`);
                return true;
            }

            // Check roles[] array (multi-role users)
            const rolesArr: string[] = Array.isArray(row.roles) ? row.roles : [];
            const hasAdminInRoles = rolesArr.some(r =>
                adminKeys.includes((r || "").toLowerCase().replace(/\s+/g, "_"))
            );

            if (hasAdminInRoles) {
                console.log(`[IMPERSONATE] ✅ Admin confirmed via roles[] array`);
                return true;
            }

            console.log(`[IMPERSONATE] ❌ Not an admin`);
            return false;
        } catch (err) {
            console.error("[IMPERSONATE] canImpersonate error:", err);
            return false;
        }
    }
}

export const impersonationService = new ImpersonationService();
