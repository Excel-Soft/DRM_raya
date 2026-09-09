/**
 * D&D Manager → Project Report routes.
 *
 * Real, DB-backed. Mounted AFTER auth + IP + URL-permission middleware, so all
 * routes require an authenticated user. Access is additionally gated here: only
 * managerial roles (admin / super_hod / hod / dd_manager / product_posting_manager
 * / software_manager / qa_manager / verification_manager / ...) may view the
 * manager report; executives receive 403.
 *
 * Primary path:        /api/dd-manager/project-report
 * Compatibility paths: /api/reports/projects
 * (The /api/pms/project-report alias delegates to the same service from
 *  server/pms-routes.ts.)
 */
import type { Express, Request, Response } from "express";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { listProjectReport } from "./services/project-report.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_LIMITS = [10, 25, 50, 100];

/**
 * True only for a real calendar date in YYYY-MM-DD form. The regex alone lets
 * impossible dates like 2026-99-99 or 2026-02-31 through, which would otherwise
 * blow up at the SQL ::date cast and surface as a 500 instead of a clean 400.
 */
function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}

/** Managerial roles may view the project report; executives may not. */
export function canViewProjectReport(role: string): boolean {
  return isManagerialRole(role);
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

/**
 * Shared handler used by every project-report route alias.
 * Returns { filters, rows, pagination }.
 */
export async function handleProjectReport(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const role = getActiveRole(req);
    if (!canViewProjectReport(role)) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: "You are not authorized to view the project report" });
    }

    const companyName = req.query.companyName ? String(req.query.companyName).trim() : "";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const startDate = req.query.startDate ? String(req.query.startDate) : "";
    const endDate = req.query.endDate ? String(req.query.endDate) : "";

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return badRequest(res, "startDate and endDate are required (YYYY-MM-DD)");
    }
    if (startDate > endDate) {
      return badRequest(res, "startDate must be on or before endDate");
    }

    let page = parseInt(String(req.query.page ?? "1"), 10);
    if (!Number.isFinite(page) || page < 1) page = 1;

    let limit = parseInt(String(req.query.limit ?? "10"), 10);
    if (!ALLOWED_LIMITS.includes(limit)) limit = 10;

    const { rows, total } = await listProjectReport({
      companyName,
      startDate,
      endDate,
      search,
      page,
      limit,
    });

    res.json({
      filters: { companyName, startDate, endDate, search },
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("[project-report] list error", err);
    res.status(500).json({ error: "InternalError", message: "Failed to fetch project report" });
  }
}

export function registerProjectReportRoutes(app: Express) {
  app.get("/api/dd-manager/project-report", handleProjectReport);
  app.get("/api/reports/projects", handleProjectReport);
}
