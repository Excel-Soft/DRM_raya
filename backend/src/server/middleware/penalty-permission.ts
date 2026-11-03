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
// Account Manager and HOD create/view penalties for any employee
// company-wide — explicit product request — rather than being scoped to
// their own department like the other managerial roles below. This does
// NOT widen canDecide/canVoid: HOD keeps department-scoped decide/void
// authority (see the `purpose` param below) so a HOD can flag a penalty
// against anyone company-wide, but can only approve/reject/void one that's
// in their own department.
export const COMPANY_WIDE_VIEW_ROLES = ["account_manager", "hod"];

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

/** Legacy add-penalty.php: Edit/Delete on pending rows — admin, super HOD, HOD, account manager only. */
export function canEditOrDeletePenalty(role: string): boolean {
  return isFullAccess(role) || role === "hod" || role === "account_manager";
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
 *   - account_manager / HOD, purpose="view" -> null (all) — company-wide carve-out
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 *
 * `purpose` distinguishes "view/create" scope (where HOD is company-wide)
 * from "decide/void" scope (where HOD stays department-only — approving or
 * voiding someone else's department's penalty is a different, narrower
 * authority than merely being allowed to flag one against them).
 */
export async function getAllowedEmployeeIds(req: Request, purpose: "view" | "decide" = "view"): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFullAccess(role) || isHr(role)) return null;
  if (purpose === "view" && COMPANY_WIDE_VIEW_ROLES.includes(role)) return null;

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

export async function canViewEmployee(req: Request, employeeId: string, purpose: "view" | "decide" = "view"): Promise<boolean> {
  const allowed = await getAllowedEmployeeIds(req, purpose);
  if (allowed === null) return true;
  return allowed.includes(String(employeeId));
}
