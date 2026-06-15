/**
 * Commission Verification routes — mounted under /api/drm/commission-verifications.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_admin / super_hod  -> view all, create, approve/reject
 *   - hod / managerial roles           -> view their department (+ self)
 *   - hr / hr_manager                  -> view all
 *   - everyone else                    -> view ONLY their own records
 * approve/reject restricted to full-access + HOD. Cross-scope access returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { ActivityLogService } from "./services/activity-service";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
const HR_ROLES = ["hr", "hr_manager"];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}
// Best-effort audit trail (never throws — ActivityLogService swallows failures).
async function audit(req: Request, action: string, resourceId: unknown, details?: Record<string, unknown>) {
  await ActivityLogService.log({
    userId: getUserId(req),
    action,
    resourceType: "drm_commission_verification",
    resourceId: String(resourceId ?? ""),
    details: details && Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
  });
}
function isFullAccess(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}
function isHr(role: string): boolean {
  return HR_ROLES.includes(role) || role.includes("hr");
}
function isHod(role: string): boolean {
  return role === "hod";
}
// Who can approve/reject: full-access and HOD only.
function canDecide(role: string): boolean {
  return isFullAccess(role) || isHod(role);
}
// Who can create a commission-verification record: full-access, HOD, managerial.
function canCreate(role: string): boolean {
  return isFullAccess(role) || isHod(role) || isManagerialRole(role);
}

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
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

/**
 * Returns the list of user_ids this requester may view, or null for "all".
 *   - full access / HR -> null (all)
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 */
async function getAllowedUserIds(req: Request): Promise<string[] | null> {
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
  return [String(myId)];
}

async function canViewUser(req: Request, userId: string | null): Promise<boolean> {
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  if (!userId) return false;
  return allowed.includes(String(userId));
}

const SELECT_COLS = `
  cv.id,
  cv.user_id          as "userId",
  coalesce(u.full_name, u.name, u.email) as "name",
  u.department        as "department",
  cv.period,
  cv.package_name     as "packageName",
  cv.amount,
  cv.commission_pct   as "commissionPct",
  cv.commission,
  cv.reward,
  cv.team_reward      as "teamReward",
  cv.pay,
  cv.status,
  cv.reason,
  cv.approved_by      as "approvedBy",
  cv.approved_at      as "approvedAt",
  cv.created_by       as "createdBy",
  cv.created_at       as "createdAt",
  cv.updated_at       as "updatedAt"
`;

export async function ensureCommissionVerificationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.commission_verifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      period text,
      package_name text,
      amount numeric(12,2),
      commission_pct numeric(6,2),
      commission numeric(12,2),
      reward numeric(12,2),
      team_reward numeric(12,2),
      pay numeric(12,2),
      status text NOT NULL DEFAULT 'pending',
      reason text,
      approved_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      approved_at timestamptz,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_commission_verifications_user_id ON drm.commission_verifications (user_id)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_commission_verifications_status ON drm.commission_verifications (status)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_commission_verifications_period ON drm.commission_verifications (period)`,
  );
}

export async function registerCommissionVerificationRoutes(app: Express) {
  await ensureCommissionVerificationTable();

  // GET /api/drm/commission-verifications — paginated, filtered, scoped list
  app.get("/api/drm/commission-verifications", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSize = Math.max(1, Number(req.query.pageSize ?? 25) || 25);
      const offset = (page - 1) * pageSize;

      const where: string[] = ["cv.deleted_at IS NULL"];
      const params: any[] = [];

      const allowed = await getAllowedUserIds(req);
      if (allowed !== null) {
        if (allowed.length === 0) {
          return res.json({ data: [], total: 0, page, pageSize });
        }
        params.push(allowed);
        where.push(`cv.user_id::text = ANY($${params.length}::text[])`);
      }

      const search = req.query.search ? String(req.query.search).trim() : "";
      if (search) {
        params.push(`%${search}%`);
        const i = params.length;
        where.push(
          `(coalesce(u.full_name, u.name, u.email) ilike $${i} or cv.package_name ilike $${i} or cv.period ilike $${i})`,
        );
      }

      // status filter — supports tab "approved" / "not approved"
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : "";
      if (status) {
        if (status === "not approved" || status === "not-approved" || status === "notapproved") {
          where.push(`cv.status <> 'approved'`);
        } else {
          params.push(status);
          where.push(`cv.status = $${params.length}`);
        }
      }

      const userId = req.query.userId ? String(req.query.userId) : "";
      if (userId) {
        params.push(userId);
        where.push(`cv.user_id::text = $${params.length}::text`);
      }

      const period = req.query.period ? String(req.query.period) : "";
      if (period) {
        params.push(period);
        where.push(`cv.period = $${params.length}`);
      }

      const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : "";
      if (dateFrom && !isNaN(new Date(dateFrom).getTime())) {
        params.push(dateFrom);
        where.push(`cv.created_at >= $${params.length}`);
      }
      const dateTo = req.query.dateTo ? String(req.query.dateTo) : "";
      if (dateTo && !isNaN(new Date(dateTo).getTime())) {
        params.push(dateTo);
        where.push(`cv.created_at <= $${params.length}`);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;
      const joinSql = `FROM drm.commission_verifications cv LEFT JOIN drm.users u ON u.id = cv.user_id`;

      const countResult = await pool.query(
        `SELECT count(*)::int AS total ${joinSql} ${whereSql}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      params.push(pageSize);
      params.push(offset);
      const dataResult = await pool.query(
        `SELECT ${SELECT_COLS} ${joinSql} ${whereSql}
         ORDER BY cv.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      res.json({ data: dataResult.rows, total, page, pageSize });
    } catch (err) {
      console.error("[commission-verification] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch commission verifications" });
    }
  });

  // POST /api/drm/commission-verifications — create
  app.post("/api/drm/commission-verifications", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!canCreate(getActiveRole(req))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to create commission verification records" });
      }
      const b = req.body ?? {};

      const userId = b.userId ? String(b.userId) : null;
      if (userId) {
        const { rows } = await pool.query(
          `select id from drm.users where id::text = $1::text limit 1`,
          [userId],
        );
        if (rows.length === 0) {
          return res.status(404).json({ error: "NotFound", message: "User not found" });
        }
        if (!(await canViewUser(req, userId))) {
          return res.status(403).json({ error: "Forbidden", message: "You are not authorized to create a record for this user" });
        }
      }

      const numericFields = ["amount", "commissionPct", "commission", "reward", "teamReward", "pay"];
      for (const f of numericFields) {
        if (b[f] !== undefined && b[f] !== null && b[f] !== "" && isNaN(Number(b[f]))) {
          return badRequest(res, `${f} must be a number`);
        }
      }

      const numOrNull = (v: any) =>
        v === undefined || v === null || v === "" ? null : Number(v);

      const { rows } = await pool.query(
        `INSERT INTO drm.commission_verifications
          (user_id, period, package_name, amount, commission_pct, commission, reward, team_reward, pay, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
         RETURNING id`,
        [
          userId,
          b.period ? String(b.period) : null,
          b.packageName ? String(b.packageName) : null,
          numOrNull(b.amount),
          numOrNull(b.commissionPct),
          numOrNull(b.commission),
          numOrNull(b.reward),
          numOrNull(b.teamReward),
          numOrNull(b.pay),
          String(getUserId(req)),
        ],
      );

      const created = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM drm.commission_verifications cv LEFT JOIN drm.users u ON u.id = cv.user_id
         WHERE cv.id = $1`,
        [rows[0].id],
      );
      await audit(req, "drm.commission_verification.create", rows[0]?.id, { targetUserId: userId, status: "pending" });
      res.status(201).json({ success: true, commissionVerification: created.rows[0] });
    } catch (err) {
      console.error("[commission-verification] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create commission verification" });
    }
  });

  // PATCH /api/drm/commission-verifications/:id/approve
  app.patch("/api/drm/commission-verifications/:id/approve", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canDecide(role)) {
        return res.status(403).json({ error: "Forbidden", message: "Only HOD/admin can approve commission verifications" });
      }
      const id = String(req.params.id);
      const { rows } = await pool.query(
        `select user_id, status, deleted_at from drm.commission_verifications where id = $1`,
        [id],
      );
      const raw = rows[0];
      if (!raw || raw.deleted_at) return res.status(404).json({ error: "NotFound", message: "Commission verification not found" });
      if (!(await canViewUser(req, raw.user_id))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this record" });
      }
      if (raw.status !== "pending") {
        return res.status(409).json({ error: "Conflict", message: "Only pending records can be approved" });
      }

      await pool.query(
        `UPDATE drm.commission_verifications
         SET status = 'approved', approved_by = $1, approved_at = now(), reason = NULL, updated_at = now()
         WHERE id = $2`,
        [String(getUserId(req)), id],
      );
      const updated = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM drm.commission_verifications cv LEFT JOIN drm.users u ON u.id = cv.user_id
         WHERE cv.id = $1`,
        [id],
      );
      await audit(req, "drm.commission_verification.approve", id, { status: "approved" });
      res.json({ success: true, commissionVerification: updated.rows[0] });
    } catch (err) {
      console.error("[commission-verification] approve error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to approve commission verification" });
    }
  });

  // PATCH /api/drm/commission-verifications/:id/reject
  app.patch("/api/drm/commission-verifications/:id/reject", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canDecide(role)) {
        return res.status(403).json({ error: "Forbidden", message: "Only HOD/admin can reject commission verifications" });
      }
      const id = String(req.params.id);
      const reason = req.body?.reason ? String(req.body.reason).trim() : "";
      if (!reason) return badRequest(res, "reason is required");

      const { rows } = await pool.query(
        `select user_id, status, deleted_at from drm.commission_verifications where id = $1`,
        [id],
      );
      const raw = rows[0];
      if (!raw || raw.deleted_at) return res.status(404).json({ error: "NotFound", message: "Commission verification not found" });
      if (!(await canViewUser(req, raw.user_id))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this record" });
      }
      if (raw.status !== "pending") {
        return res.status(409).json({ error: "Conflict", message: "Only pending records can be rejected" });
      }

      await pool.query(
        `UPDATE drm.commission_verifications
         SET status = 'rejected', reason = $1, approved_by = $2, approved_at = now(), updated_at = now()
         WHERE id = $3`,
        [reason, String(getUserId(req)), id],
      );
      const updated = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM drm.commission_verifications cv LEFT JOIN drm.users u ON u.id = cv.user_id
         WHERE cv.id = $1`,
        [id],
      );
      await audit(req, "drm.commission_verification.reject", id, { status: "rejected", reason });
      res.json({ success: true, commissionVerification: updated.rows[0] });
    } catch (err) {
      console.error("[commission-verification] reject error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to reject commission verification" });
    }
  });
}
