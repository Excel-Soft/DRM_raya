/**
 * Team Report → LINK REPORT routes.
 *
 * Real, DB-backed. Mounted AFTER auth + IP + URL-permission middleware, so all
 * routes require an authenticated user. Access is additionally scoped here:
 *   - admin / super_hod        -> all users
 *   - hod / managerial roles   -> own department (+ self)
 *   - everyone else (executive)-> self only, and cannot verify commission
 *
 * Base path:  /api/team-report/link-report
 * Alias path: /api/posting-data/link-report   (compatibility with the page URL)
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import {
  listUsersForReport,
  listLinkReport,
  getVerification,
  verifyCommission,
  createLinkReport,
} from "./services/link-report.service";
import { ActivityLogService } from "./services/activity-service";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}
function isFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}
function isHod(role: string): boolean {
  return role === "hod";
}
/**
 * Who may verify commission: full-access, HOD, and managerial roles (not
 * executives). Exported (P02-002) so it can be tested directly against
 * `report-permission.ts`'s `link_report` matrix entry, the same way
 * `project-report-routes.ts` already exports `canViewProjectReport` for that
 * purpose — proves the two can't silently drift again, rather than just
 * asserting they currently happen to agree.
 */
export function canVerify(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isManagerialRole(role);
}

async function getDepartment(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select department from drm.users where id::text = $1::text limit 1`,
      [userId],
    );
    return rows[0]?.department ?? null;
  } catch {
    return null;
  }
}

/** Returns the list of user ids this requester may view, or null for "all". */
async function getAllowedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFullAccess(role)) return null;

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
  return [String(myId)];
}

function canViewUser(allowed: string[] | null, userId: string): boolean {
  if (allowed === null) return true;
  return allowed.includes(String(userId));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

function registerLinkReportRoutes(app: Express, base: string) {
  // GET users for the dropdown (scoped).
  app.get(`${base}/users`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const allowed = await getAllowedUserIds(req);
      const users = await listUsersForReport(allowed);
      res.json({ users });
    } catch (err) {
      console.error("[link-report] /users error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch users" });
    }
  });

  // GET the link report for a user + date range.
  app.get(`${base}`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      const myId = getUserId(req);
      const allowed = await getAllowedUserIds(req);

      // Self-only callers always view their own report.
      let userId = req.query.userId ? String(req.query.userId) : "";
      if (allowed !== null && allowed.length === 1 && allowed[0] === String(myId)) {
        userId = String(myId);
      }
      if (!userId) return badRequest(res, "userId is required");
      if (!canViewUser(allowed, userId)) {
        return res.status(403).json({ error: "Forbidden", message: "You cannot view this user's report" });
      }

      const startDate = req.query.startDate ? String(req.query.startDate) : "";
      const endDate = req.query.endDate ? String(req.query.endDate) : "";
      if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        return badRequest(res, "startDate and endDate are required (YYYY-MM-DD)");
      }
      if (startDate > endDate) {
        return badRequest(res, "startDate must be on or before endDate");
      }

      const rows = await listLinkReport(userId, startDate, endDate);
      const verification = await getVerification(userId, startDate, endDate);

      res.json({
        filters: { userId, startDate, endDate },
        rows,
        summary: {
          total: rows.length,
          reward: verification ? Number(verification.reward) : 0,
          commissionVerified: !!verification,
          verificationId: verification ? verification.id : null,
        },
        canVerify: canVerify(role),
      });
    } catch (err) {
      console.error("[link-report] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch link report" });
    }
  });

  // POST verify commission for a user + date range.
  app.post(`${base}/verify-commission`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canVerify(role)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to verify commission" });
      }
      const myId = getUserId(req);
      const allowed = await getAllowedUserIds(req);

      const userId = req.body?.userId ? String(req.body.userId) : "";
      const startDate = req.body?.startDate ? String(req.body.startDate) : "";
      const endDate = req.body?.endDate ? String(req.body.endDate) : "";
      const linkReportIds: string[] = Array.isArray(req.body?.linkReportIds)
        ? req.body.linkReportIds.map(String)
        : [];

      if (!userId) return badRequest(res, "userId is required");
      if (!canViewUser(allowed, userId)) {
        return res.status(403).json({ error: "Forbidden", message: "You cannot verify this user's report" });
      }
      if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        return badRequest(res, "startDate and endDate are required (YYYY-MM-DD)");
      }
      if (startDate > endDate) {
        return badRequest(res, "startDate must be on or before endDate");
      }

      const result = await verifyCommission({
        userId,
        verifiedByUserId: String(myId),
        startDate,
        endDate,
        linkReportIds,
      });
      // Audit fix (P00): verify-commission is a financial approval-like action
      // that previously had no audit trail at all.
      void ActivityLogService.log({
        userId: String(myId),
        action: "link_report.verify_commission",
        resourceType: "link_report_verification",
        resourceId: result?.id ? String(result.id) : userId,
        details: JSON.stringify({ forUserId: userId, startDate, endDate, linkReportIds }),
      });
      res.json({ success: true, verification: result });
    } catch (err: any) {
      if (err?.statusCode === 400) return badRequest(res, err.message);
      console.error("[link-report] verify-commission error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to verify commission" });
    }
  });

  // POST create a manual link report row (optional).
  app.post(`${base}`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const myId = getUserId(req);
      const linkUrl = req.body?.linkUrl ? String(req.body.linkUrl) : "";
      const companyName = req.body?.companyName ? String(req.body.companyName) : "";
      if (!linkUrl) return badRequest(res, "linkUrl is required");
      const created = await createLinkReport({
        submittedByUserId: String(myId),
        companyName,
        linkUrl,
        companyId: req.body?.companyId ? String(req.body.companyId) : null,
      });
      res.status(201).json({ ok: true, ...created });
    } catch (err) {
      console.error("[link-report] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create link report" });
    }
  });
}

export function registerTeamReportLinkReportRoutes(app: Express) {
  registerLinkReportRoutes(app, "/api/team-report/link-report");
  registerLinkReportRoutes(app, "/api/posting-data/link-report");
}
