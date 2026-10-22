/**
 * Penalty permission source — the SINGLE, authoritative place that decides who
 * may create / decide / void / view penalties and which employees' penalties a
 * requester may see.
 *
 * Why this is NOT the static REPORT_PERMISSION_MATRIX `penalty_report` entry:
 * penalty access is *row-aware*. It depends on managerial role detection
 * (`isManagerialRole`) AND on the requester's department vs. the penalised
 * employee's department (row-level scope). The flat role->page matrix cannot
 * express "managerial roles may act, but only on their own department's rows",
 * so penalty keeps its own cohesive source. These helpers are a verbatim,
 * behaviour-preserving extraction of what previously lived inline in
 * penalty-routes.ts — do not change the role sets or scoping rules here without
 * management confirmation.
 */
import type { Request } from "express";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";

export const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
export const HR_ROLES = ["hr", "hr_manager"];

export function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
export function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}
export function isFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}
export function isHr(role: string): boolean {
  return HR_ROLES.includes(role) || role.includes("hr");
}
export function isHod(role: string): boolean {
  return role === "hod";
}

// Who can create a penalty: full-access, HOD, and managerial roles.
export function canCreate(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isManagerialRole(role);
}
// Who can approve/reject: full-access and HOD only.
export function canDecide(role: string): boolean {
  return isFullAccess(role) || isHod(role);
}
// Who can void: same authority as approve/reject. Voiding reverses an approval
// decision, so a managerial creator must NOT be able to void (only delete their
// own still-PENDING penalties). Full-access + HOD (dept-scoped) only.
export function canVoid(role: string): boolean {
  return canDecide(role);
}
// Who can see reports: full-access, HOD, HR.
export function canViewReports(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isHr(role);
}

export async function getDepartment(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(`select department from drm.users where id::text = $1::text limit 1`, [userId]);
    return rows[0]?.department ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the list of employee_ids this requester may view, or null for "all".
 *   - full access / HR -> null (all)
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 */
export async function getAllowedEmployeeIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFullAccess(role) || isHr(role)) return null;

  if (isHod(role) || isManagerialRole(role)) {
    const dept = await getDepartment(String(myId));
    if (!dept) return [String(myId)];
    try {
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
  // employee / executive / default: own penalties only
  return [String(myId)];
}

export async function canViewEmployee(req: Request, employeeId: string): Promise<boolean> {
  const allowed = await getAllowedEmployeeIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(employeeId));
}
