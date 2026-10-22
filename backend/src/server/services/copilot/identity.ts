// Server-side identity/scope resolution for Copilot. This is the ONLY place
// a tool or route should derive "who is asking and what can they see" — never
// from req.body, never from a client-supplied role/department/screenData.
// (Brief §4: "The browser's userRole, userId, department, x-acting-role and
// screenData must never grant authority.")
import type { Request } from "express";
import { pool } from "../../db";
import { normalizeRole, isManagerialRole } from "../../utils/role-utils";

export interface CopilotIdentity {
  userId: string;
  email: string | null;
  role: string;
  isFullAccess: boolean;
  isManagerial: boolean;
  department: string | null;
  branch: string | null;
  impersonatorId: string | null;
}

const FULL_ACCESS_ROLES = ["admin", "super_admin", "super_hod"];

/**
 * Resolves identity strictly from `req.user` (set by authMiddleware from a
 * verified JWT) plus a DB lookup for department/branch. Never reads
 * `req.body`, `req.headers["x-acting-role"]`, or anything UI-supplied.
 */
export async function resolveCopilotIdentity(req: Request): Promise<CopilotIdentity | null> {
  const user = req.user as any;
  if (!user?.userId) return null;

  const role = normalizeRole(user.activeRoleId || user.roleId || "");
  const { rows } = await pool.query(
    `select department, branch from drm.users where id::text = $1::text limit 1`,
    [String(user.userId)],
  );
  const department = rows[0]?.department ?? null;
  const branch = rows[0]?.branch ?? (user.branch ?? null);

  return {
    userId: String(user.userId),
    email: user.email ?? null,
    role,
    isFullAccess: FULL_ACCESS_ROLES.includes(role),
    isManagerial: isManagerialRole(role),
    department,
    branch,
    impersonatorId: user.impersonatorId ? String(user.impersonatorId) : null,
  };
}

/**
 * The record-scope a given identity is allowed to read: `null` means
 * "unrestricted" (full-access roles only); otherwise an explicit list of
 * employee/owner ids. Mirrors the access model already enforced by
 * CustomersRepository.findByUserId — reused here, not reinvented.
 */
/**
 * Independent ownership check for a single customer record. The live HTTP
 * detail routes (GET /api/sales/customers/:id and friends) only check
 * `req.user` truthiness today (see docs/copilot/PROGRESS.md M0 gap) — Copilot
 * does NOT reuse that under-scoped path; it applies the same rule
 * `findByUserId` already enforces (owner_user_id/created_by, or department for
 * managerial roles, or unrestricted for full-access).
 */
export async function isCustomerInScope(identity: CopilotIdentity, customerId: string): Promise<boolean> {
  if (identity.isFullAccess) return true;
  const { rows } = await pool.query(
    `select owner_user_id, created_by from drm.customers where id::text = $1::text limit 1`,
    [customerId],
  );
  if (!rows[0]) return false;
  const ownerId = rows[0].owner_user_id ? String(rows[0].owner_user_id) : null;
  const creatorId = rows[0].created_by ? String(rows[0].created_by) : null;
  const effectiveOwner = ownerId ?? creatorId;
  if (effectiveOwner === identity.userId) return true;
  if (identity.isManagerial && identity.department) {
    const owner = await pool.query(`select department from drm.users where id::text = $1::text limit 1`, [
      effectiveOwner,
    ]);
    return owner.rows[0]?.department === identity.department;
  }
  return false;
}

export async function resolveAllowedEmployeeIds(identity: CopilotIdentity): Promise<string[] | null> {
  if (identity.isFullAccess) return null;
  if (identity.isManagerial) {
    if (!identity.department) return [identity.userId];
    const { rows } = await pool.query(
      `select id from drm.users where department = $1 or id::text = $2::text`,
      [identity.department, identity.userId],
    );
    return Array.from(new Set(rows.map((r) => String(r.id)).concat(identity.userId)));
  }
  return [identity.userId];
}
