import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { sendError, ApiError } from "./utils/api-error";
import { AuditLogService } from "./services/audit-log.service";
import { recordAssignment } from "./utils/assignment-history";
import {
  getRequestUserId,
  getRequestRole,
  hasFullAccess,
  getEditableUserIds,
} from "./utils/ownership";
import { isManagerialRole } from "./utils/role-utils";

/**
 * Stage 8 — lead bulk actions: assign, reassign, status update, export.
 *
 * Permission model:
 *  - Assigning/reassigning to ANOTHER user requires a managerial role.
 *  - Non-managerial users may only act on leads they own; out-of-scope ids are
 *    reported as `skipped`, never silently mutated.
 *  - Every change is audited and written to assignment_history (for assign).
 */

const CUSTOMER_STATUSES = ["New", "Renew", "Expire"];

function parseIds(body: any): string[] {
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  return ids.map((x: any) => String(x)).filter(Boolean);
}

async function loadLeadOwners(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query(
    `select id, owner_user_id from drm.customers
       where id::text = any($1::text[]) and coalesce(is_deleted,false)=false`,
    [ids],
  );
  for (const r of rows) map.set(String(r.id), r.owner_user_id ?? null);
  return map;
}

export function registerLeadBulkRoutes(app: Express): void {
  // Shared handler for assign + reassign (semantics identical; both record from->to).
  const assignHandler = async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const ids = parseIds(req.body);
      const toUserId = String(req.body?.toUserId ?? "").trim();
      const reason = String(req.body?.reason ?? "").trim();
      if (ids.length === 0) throw new ApiError(400, "VALIDATION_ERROR", "ids[] is required.");
      if (!toUserId) throw new ApiError(400, "VALIDATION_ERROR", "toUserId is required.");

      const myId = getRequestUserId(req);
      const role = getRequestRole(req);
      const assigningToOthers = toUserId !== myId;
      if (assigningToOthers && !isManagerialRole(role) && !hasFullAccess(role)) {
        throw new ApiError(403, "FORBIDDEN", "Only managers may assign leads to other users.");
      }

      // verify target user exists
      const tgt = await pool.query(`select 1 from drm.users where id::text = $1::text limit 1`, [toUserId]);
      if (tgt.rowCount === 0) throw new ApiError(404, "NOT_FOUND", "Target user not found.");

      const allowed = await getEditableUserIds(req); // null => full access
      const owners = await loadLeadOwners(ids);

      const updated: string[] = [];
      const skipped: { id: string; reason: string }[] = [];
      for (const id of ids) {
        if (!owners.has(id)) {
          skipped.push({ id, reason: "not found" });
          continue;
        }
        const owner = owners.get(id) ?? null;
        // allowed === null => full-access roles; otherwise scope strictly to the
        // caller's editable user ids (own for executives, team for managers).
        const inScope = allowed === null || (owner !== null && allowed.includes(String(owner)));
        if (!inScope) {
          skipped.push({ id, reason: "not permitted" });
          continue;
        }
        await pool.query(
          `update drm.customers set owner_user_id = $1, pool_type = 'Private', updated_at = now()
             where id::text = $2::text`,
          [toUserId, id],
        );
        await recordAssignment({
          entityType: "lead",
          entityId: id,
          fromUserId: owner,
          toUserId,
          reason,
          req,
        });
        await AuditLogService.record({
          actorUserId: myId ?? undefined,
          action: "lead.bulk_assign",
          module: "sales",
          entityType: "lead",
          entityId: id,
          reason: reason || undefined,
          before: { ownerUserId: owner },
          after: { ownerUserId: toUserId },
          req,
        });
        updated.push(id);
      }

      res.json({ success: true, summary: { requested: ids.length, updated: updated.length, skipped: skipped.length }, updated, skipped });
    } catch (err) {
      sendError(res, err);
    }
  };

  app.post("/api/sales/leads/bulk/assign", assignHandler);
  app.post("/api/sales/leads/bulk/reassign", assignHandler);

  // Bulk status update.
  app.post("/api/sales/leads/bulk/status", async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const ids = parseIds(req.body);
      const status = String(req.body?.status ?? "").trim();
      const reason = String(req.body?.reason ?? "").trim();
      if (ids.length === 0) throw new ApiError(400, "VALIDATION_ERROR", "ids[] is required.");
      if (!CUSTOMER_STATUSES.includes(status)) {
        throw new ApiError(400, "VALIDATION_ERROR", `status must be one of: ${CUSTOMER_STATUSES.join(", ")}`);
      }
      // Moving to a contraction state requires a reason.
      if (status === "Expire" && !reason) {
        throw new ApiError(400, "VALIDATION_ERROR", "A reason is required to expire leads.");
      }

      const myId = getRequestUserId(req);
      const role = getRequestRole(req);
      const allowed = await getEditableUserIds(req);
      const owners = await loadLeadOwners(ids);

      const updated: string[] = [];
      const skipped: { id: string; reason: string }[] = [];
      for (const id of ids) {
        if (!owners.has(id)) { skipped.push({ id, reason: "not found" }); continue; }
        const owner = owners.get(id) ?? null;
        // allowed === null => full-access roles; otherwise scope strictly to the
        // caller's editable user ids (own for executives, team for managers).
        const inScope = allowed === null || (owner !== null && allowed.includes(String(owner)));
        if (!inScope) { skipped.push({ id, reason: "not permitted" }); continue; }
        await pool.query(
          `update drm.customers set status = $1, updated_at = now() where id::text = $2::text`,
          [status, id],
        );
        await AuditLogService.recordTransition({
          actorUserId: myId ?? undefined,
          action: "lead.bulk_status",
          module: "sales",
          entityType: "lead",
          entityId: id,
          nextStatus: status,
          reason: reason || undefined,
          req,
        });
        updated.push(id);
      }

      res.json({ success: true, summary: { requested: ids.length, updated: updated.length, skipped: skipped.length }, updated, skipped });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Bulk export (CSV) — scoped to the caller's editable records.
  app.get("/api/sales/leads/bulk/export", async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const allowed = await getEditableUserIds(req);

      const where: string[] = ["coalesce(is_deleted,false)=false"];
      const params: any[] = [];
      if (allowed !== null) {
        params.push(allowed);
        where.push(`owner_user_id::text = any($${params.length}::text[])`);
      }
      if (req.query.status) {
        params.push(String(req.query.status));
        where.push(`status = $${params.length}`);
      }
      if (req.query.grade) {
        params.push(String(req.query.grade));
        where.push(`grade = $${params.length}`);
      }

      const { rows } = await pool.query(
        `select company_name, person_name, email, coalesce(phone, mobile) as phone,
                city, country, grade, status, source, created_at
           from drm.customers
          where ${where.join(" and ")}
          order by created_at desc
          limit 5000`,
        params,
      );

      const headers = ["Company Name","Contact Person","Email","Phone","City","Country","Grade","Status","Source","Created At"];
      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push([
          r.company_name, r.person_name, r.email, r.phone, r.city, r.country,
          r.grade, r.status, r.source, r.created_at ? new Date(r.created_at).toISOString() : "",
        ].map(esc).join(","));
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leads-export.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      sendError(res, err);
    }
  });
}

export default registerLeadBulkRoutes;
