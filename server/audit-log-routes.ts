import { Router } from "express";
import { pool } from "./db";
import { requireRole } from "./auth.middleware";

/**
 * Audit Log viewer (Stage 10, section G).
 *
 * Read-only window over the existing `drm.activity_logs` table (no schema
 * change). Restricted to admin / super_admin / super_hod — these logs can
 * contain sensitive financial / HR actions, so the viewer is gated and the
 * `details` JSON is returned as-is (writers are responsible for never storing
 * secrets, per audit-log.service.ts).
 *
 * Filters (all optional, AND-combined): actor (user_id), module (matched inside
 * the details JSON), entityType, entityId, action, dateFrom, dateTo.
 * Paginated with page / pageSize (capped). All values are parameterized.
 */

const router = Router();

const ROLES = ["admin", "super_admin", "super_hod"] as const;

router.get("/", requireRole(...ROLES), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSizeRaw = parseInt(String(req.query.pageSize ?? "50"), 10) || 50;
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: any[] = [];
    const add = (clause: string, value: any) => {
      params.push(value);
      where.push(clause.replace("$?", `$${params.length}`));
    };

    const actor = (req.query.actor as string)?.trim();
    const moduleName = (req.query.module as string)?.trim();
    const entityType = (req.query.entityType as string)?.trim();
    const entityId = (req.query.entityId as string)?.trim();
    const action = (req.query.action as string)?.trim();
    const dateFrom = (req.query.dateFrom as string)?.trim();
    const dateTo = (req.query.dateTo as string)?.trim();

    const parseDate = (v?: string): Date | null | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const from = parseDate(dateFrom);
    const to = parseDate(dateTo);
    if (from === null || to === null) {
      return res.status(400).json({ error: "Invalid dateFrom/dateTo. Use an ISO date." });
    }

    if (actor) add("a.user_id = $?", actor);
    if (moduleName) add("a.details ILIKE $?", `%"module":"${moduleName}"%`);
    if (entityType) add("a.resource_type = $?", entityType);
    if (entityId) add("a.resource_id = $?", entityId);
    if (action) add("a.action ILIKE $?", `%${action}%`);
    if (from) add("a.created_at >= $?", from.toISOString());
    if (to) add("a.created_at <= $?", to.toISOString());

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM drm.activity_logs a ${whereSql}`,
      params,
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const listResult = await pool.query(
      `SELECT a.id, a.user_id, a.action, a.resource_type, a.resource_id,
              a.details, a.created_at,
              u.name AS actor_name, u.full_name AS actor_full_name,
              u.email AS actor_email, u.role_id AS actor_role
       FROM drm.activity_logs a
       LEFT JOIN drm.users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    const items = listResult.rows.map((r: any) => {
      let module: string | undefined;
      let reason: string | undefined;
      let parsedDetails: any = undefined;
      if (r.details) {
        try {
          parsedDetails = JSON.parse(r.details);
          module = parsedDetails?.module;
          reason = parsedDetails?.reason;
        } catch {
          parsedDetails = r.details;
        }
      }
      return {
        id: r.id,
        actorId: r.user_id,
        actorName: r.actor_full_name || r.actor_name || null,
        actorEmail: r.actor_email || null,
        actorRole: r.actor_role || null,
        action: r.action,
        entityType: r.resource_type,
        entityId: r.resource_id,
        module: module ?? null,
        reason: reason ?? null,
        details: parsedDetails ?? null,
        createdAt: r.created_at,
      };
    });

    res.json({ items, total, page, pageSize });
  } catch (error) {
    console.error("[audit-logs] list failed:", error);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});

export default router;
