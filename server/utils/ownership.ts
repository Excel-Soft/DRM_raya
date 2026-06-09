import type { Request } from "express";
import { pool } from "../db";
import { ApiError } from "./api-error";
import { normalizeRole, isManagerialRole } from "./role-utils";

/**
 * Stage 8 — shared ownership / record-level access control for CRM records
 * (customers, leads, follow-ups, bulk actions).
 *
 * Model (mirrors the department-scoped access already used by performance-routes):
 *  - admin / super_admin / super_hod  -> full access (edit any record)
 *  - hod / managerial roles           -> their OWN DEPARTMENT (team), plus self
 *  - executive / default              -> only records they own
 *
 * There is no team-hierarchy column on drm.users and role normalization is lossy,
 * so a manager's "team" is scoped by `department` (a reliable column that never
 * leaks across departments) — at worst a superset of the strict team, never a
 * cross-department leak.
 */

/** Roles that may edit ANY record regardless of owner/department. */
export const FULL_ACCESS_ROLES = ["admin", "super_admin", "super_hod"];

export function getRequestUserId(req: Request): string | null {
  const u = req.user as any;
  return u?.id ? String(u.id) : u?.userId ? String(u.userId) : null;
}

export function getRequestRole(req: Request): string {
  const u = req.user as any;
  return normalizeRole(u?.activeRoleId || u?.roleId || u?.role || "");
}

export function hasFullAccess(role?: string | null): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  if (FULL_ACCESS_ROLES.includes(n)) return true;
  return FULL_ACCESS_ROLES.includes((role || "").toLowerCase().trim());
}

/**
 * Resolve the set of user ids whose records the caller may edit.
 * Returns `null` when the caller has full (unrestricted) access.
 */
export async function getEditableUserIds(req: Request): Promise<string[] | null> {
  const myId = getRequestUserId(req);
  if (!myId) return [];
  const role = getRequestRole(req);

  if (hasFullAccess(role)) return null;

  if (role === "hod" || isManagerialRole(role)) {
    try {
      const me = await pool.query(
        `select department from drm.users where id::text = $1::text limit 1`,
        [myId],
      );
      const dept = me.rows[0]?.department ?? null;
      if (!dept) return [String(myId)];
      const { rows } = await pool.query(
        `select id from drm.users where department = $1 or id::text = $2::text`,
        [dept, myId],
      );
      const ids = rows.map((r) => String(r.id));
      ids.push(String(myId));
      return Array.from(new Set(ids));
    } catch {
      return [String(myId)];
    }
  }

  // executive / default: self only
  return [String(myId)];
}

/**
 * True when the caller may edit a record owned by `ownerUserId`.
 * Records with no owner (null) are editable by managerial+ roles and the
 * unrestricted roles, but not by plain executives.
 */
export async function canEditOwnedRecord(
  req: Request,
  ownerUserId: string | null | undefined,
): Promise<boolean> {
  const allowed = await getEditableUserIds(req);
  if (allowed === null) return true; // full access
  if (!ownerUserId) {
    // Unowned (e.g. Public pool) — only managerial roles may take action.
    return isManagerialRole(getRequestRole(req));
  }
  return allowed.includes(String(ownerUserId));
}

/** Throw a 403 ApiError when the caller may not edit the given record. */
export async function assertCanEditOwnedRecord(
  req: Request,
  ownerUserId: string | null | undefined,
  resource = "record",
): Promise<void> {
  const ok = await canEditOwnedRecord(req, ownerUserId);
  if (!ok) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      `You are not authorized to modify this ${resource}.`,
    );
  }
}

/**
 * Look up the owner of a customer/lead row (both live in drm.customers) and
 * assert the caller may edit it. Returns the owner id for convenience.
 * Throws 404 when the row does not exist, 403 when not permitted.
 */
export async function assertCanEditCustomer(
  req: Request,
  customerId: string,
  resource = "customer",
): Promise<string | null> {
  const { rows } = await pool.query(
    `select owner_user_id from drm.customers
       where id::text = $1::text and coalesce(is_deleted, false) = false
       limit 1`,
    [customerId],
  );
  if (rows.length === 0) {
    throw new ApiError(404, "NOT_FOUND", `${resource} not found.`);
  }
  const owner = rows[0].owner_user_id ?? null;
  await assertCanEditOwnedRecord(req, owner, resource);
  return owner;
}
