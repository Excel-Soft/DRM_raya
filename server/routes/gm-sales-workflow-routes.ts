/**
 * Patch 5 — GM/Sales workflow configuration API.
 *
 *   GET   /api/gm-sales-workflow/config   (admin) — read effective config
 *   PATCH /api/gm-sales-workflow/config   (admin) — update config keys
 *
 * Admin-only, not public. All responses use the Patch 5 error envelope. Config
 * changes are audited (best-effort). Mounted under the global /api auth
 * middleware, so every request is already authenticated.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { ROLES, normalizeRole } from "../utils/role-utils";
import { sendError, sendSuccess, zodIssues } from "../utils/api-response";
import { getConfig, patchConfig } from "../services/gm-sales-config.service";
import { recordGmSalesAudit, GM_SALES_AUDIT_ACTIONS } from "../services/gm-sales-audit";
import type { GmSalesConfig } from "../../shared/gm-sales-constants";

export const gmSalesWorkflowRouter = Router();

/** Enveloped admin guard (keeps all responses on this router in Patch 5 shape). */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
  }
  const u = req.user as { activeRoleId?: string; roleId?: string; roles?: string[] };
  const primary = normalizeRole(u.activeRoleId ?? u.roleId ?? "");
  const roles = (u.roles ?? []).map((r) => normalizeRole(r));
  if (primary !== ROLES.ADMIN && !roles.includes(ROLES.ADMIN)) {
    return sendError(res, 403, "FORBIDDEN", "Admin access required");
  }
  return next();
}

gmSalesWorkflowRouter.get("/config", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { config, meta } = await getConfig();
    return sendSuccess(res, { config, meta });
  } catch {
    return sendError(res, 500, "CONFIG_READ_FAILED", "Failed to read workflow configuration");
  }
});

gmSalesWorkflowRouter.patch("/config", requireAdmin, async (req: Request, res: Response) => {
  try {
    const before = (await getConfig()).config;
    const { updatedKeys, config } = await patchConfig(
      req.body,
      (req.user as { userId?: string } | undefined)?.userId,
    );

    const beforeSubset: Record<string, unknown> = {};
    const afterSubset: Record<string, unknown> = {};
    for (const k of updatedKeys) {
      beforeSubset[k] = (before as Record<string, unknown>)[k];
      afterSubset[k] = (config as unknown as Record<string, unknown>)[k];
    }

    await recordGmSalesAudit({
      req,
      action: GM_SALES_AUDIT_ACTIONS.CONFIG_UPDATE,
      module: "gm_sales_config",
      entityType: "gm_sales_workflow_config",
      entityId: "singleton",
      before: beforeSubset,
      after: afterSubset,
    });

    return sendSuccess(res, { updatedKeys, config: config as GmSalesConfig });
  } catch (err) {
    if (err instanceof ZodError) {
      return sendError(
        res,
        400,
        "CONFIG_VALIDATION_FAILED",
        "Invalid configuration update",
        zodIssues(err),
      );
    }
    return sendError(res, 500, "CONFIG_UPDATE_FAILED", "Failed to update workflow configuration");
  }
});

export default gmSalesWorkflowRouter;
