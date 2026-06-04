/**
 * Promotion (marketing banner) routes — mounted under /api/drm/promotions.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_hod -> view all, create, edit, delete, approve/reject
 *   - hod               -> view their department, create, edit own, approve/reject
 *   - managerial roles  -> create; view their department; edit/soft-delete own
 *   - everyone else     -> view ONLY their own promotions; create own
 * Cross-scope mutation returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
const HR_ROLES = ["hr", "hr_manager"];

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
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
 * Returns the list of creator user ids this requester may view, or null for "all".
 *   - full access / HR -> null (all)
 *   - HOD / managerial -> their department (+ self)
 *   - everyone else    -> [self]
 */
async function getAllowedCreatorIds(req: Request): Promise<string[] | null> {
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

async function canMutate(req: Request, raw: { createdBy: string | null }): Promise<boolean> {
  const role = getActiveRole(req);
  if (isFullAccess(role)) return true;
  const allowed = await getAllowedCreatorIds(req);
  if (allowed === null) return true;
  return allowed.includes(String(raw.createdBy));
}

export async function ensurePromotionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.promotions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id text,
      package_name text,
      title text NOT NULL,
      sub_title text,
      discount text,
      banner_url text,
      media_type text,
      start_date timestamptz,
      end_date timestamptz,
      is_active boolean NOT NULL DEFAULT true,
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
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_status ON drm.promotions (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_created_by ON drm.promotions (created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_created_at ON drm.promotions (created_at)`);
}

function mapRow(r: any) {
  return {
    id: r.id,
    packageId: r.package_id ?? null,
    packageName: r.package_name ?? null,
    title: r.title,
    subTitle: r.sub_title ?? null,
    discount: r.discount ?? null,
    bannerUrl: r.banner_url ?? null,
    mediaType: r.media_type ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    isActive: r.is_active,
    status: r.status,
    reason: r.reason ?? null,
    approvedBy: r.approved_by ?? null,
    approvedByName: r.approved_by_name ?? null,
    approvedAt: r.approved_at ?? null,
    createdBy: r.created_by ?? null,
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

async function getRaw(id: string): Promise<{ id: string; createdBy: string | null; deletedAt: any } | null> {
  const { rows } = await pool.query(
    `select id, created_by, deleted_at from drm.promotions where id::text = $1::text limit 1`,
    [id],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, createdBy: rows[0].created_by, deletedAt: rows[0].deleted_at };
}

export async function registerPromotionRoutes(app: Express) {
  await ensurePromotionTable();

  // GET /api/drm/promotions — paginated, filtered list (scoped to caller)
  app.get("/api/drm/promotions", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSize = Math.max(1, Number(req.query.pageSize ?? 25) || 25);
      const offset = (page - 1) * pageSize;

      const where: string[] = ["p.deleted_at IS NULL"];
      const params: any[] = [];

      const allowed = await getAllowedCreatorIds(req);
      if (allowed !== null) {
        if (allowed.length === 0) {
          return res.json({ data: [], total: 0, page, pageSize });
        }
        params.push(allowed);
        where.push(`p.created_by::text = ANY($${params.length}::text[])`);
      }

      if (req.query.search) {
        params.push(`%${String(req.query.search).trim()}%`);
        where.push(
          `(p.title ILIKE $${params.length} OR p.sub_title ILIKE $${params.length} OR p.package_name ILIKE $${params.length} OR p.discount ILIKE $${params.length})`,
        );
      }
      if (req.query.status) {
        params.push(String(req.query.status).toLowerCase());
        where.push(`p.status = $${params.length}`);
      }
      if (req.query.is_active !== undefined && req.query.is_active !== "") {
        const val = String(req.query.is_active).toLowerCase();
        params.push(val === "true" || val === "1");
        where.push(`p.is_active = $${params.length}`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countResult = await pool.query(
        `SELECT count(*)::int AS total FROM drm.promotions p ${whereSql}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      const listParams = params.slice();
      listParams.push(pageSize);
      listParams.push(offset);
      const { rows } = await pool.query(
        `SELECT p.*, cu.name AS created_by_name, au.name AS approved_by_name
         FROM drm.promotions p
         LEFT JOIN drm.users cu ON cu.id = p.created_by
         LEFT JOIN drm.users au ON au.id = p.approved_by
         ${whereSql}
         ORDER BY p.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );

      res.json({ data: rows.map(mapRow), total, page, pageSize });
    } catch (err) {
      console.error("[promotion] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch promotions" });
    }
  });

  // POST /api/drm/promotions — create
  app.post("/api/drm/promotions", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const b = req.body ?? {};
      const title = String(b.title ?? "").trim();
      if (!title) return badRequest(res, "title is required");

      const { rows } = await pool.query(
        `INSERT INTO drm.promotions
          (package_id, package_name, title, sub_title, discount, banner_url, media_type,
           start_date, end_date, is_active, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          b.packageId ? String(b.packageId) : null,
          b.packageName ? String(b.packageName) : null,
          title,
          b.subTitle ? String(b.subTitle) : null,
          b.discount ? String(b.discount) : null,
          b.bannerUrl ? String(b.bannerUrl) : null,
          b.mediaType ? String(b.mediaType) : null,
          b.startDate && !isNaN(new Date(String(b.startDate)).getTime()) ? String(b.startDate) : null,
          b.endDate && !isNaN(new Date(String(b.endDate)).getTime()) ? String(b.endDate) : null,
          b.isActive === undefined ? true : Boolean(b.isActive),
          getUserId(req) ?? null,
        ],
      );
      res.status(201).json({ success: true, promotion: mapRow(rows[0]) });
    } catch (err) {
      console.error("[promotion] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create promotion" });
    }
  });

  // PATCH /api/drm/promotions/:id — edit fields incl. is_active toggle
  app.patch("/api/drm/promotions/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Promotion not found" });
      if (!(await canMutate(req, raw))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to edit this promotion" });
      }

      const b = req.body ?? {};
      if (b.title !== undefined && !String(b.title).trim()) {
        return badRequest(res, "title cannot be empty");
      }
      if (b.startDate !== undefined && b.startDate !== null && b.startDate !== "" && isNaN(new Date(String(b.startDate)).getTime())) {
        return badRequest(res, "startDate must be a valid date");
      }
      if (b.endDate !== undefined && b.endDate !== null && b.endDate !== "" && isNaN(new Date(String(b.endDate)).getTime())) {
        return badRequest(res, "endDate must be a valid date");
      }

      const sets: string[] = [];
      const params: any[] = [];
      const addSet = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.packageId !== undefined) addSet("package_id", b.packageId ? String(b.packageId) : null);
      if (b.packageName !== undefined) addSet("package_name", b.packageName ? String(b.packageName) : null);
      if (b.title !== undefined) addSet("title", String(b.title).trim());
      if (b.subTitle !== undefined) addSet("sub_title", b.subTitle ? String(b.subTitle) : null);
      if (b.discount !== undefined) addSet("discount", b.discount ? String(b.discount) : null);
      if (b.bannerUrl !== undefined) addSet("banner_url", b.bannerUrl ? String(b.bannerUrl) : null);
      if (b.mediaType !== undefined) addSet("media_type", b.mediaType ? String(b.mediaType) : null);
      if (b.startDate !== undefined) addSet("start_date", b.startDate ? String(b.startDate) : null);
      if (b.endDate !== undefined) addSet("end_date", b.endDate ? String(b.endDate) : null);
      if (b.isActive !== undefined) addSet("is_active", Boolean(b.isActive));

      if (sets.length === 0) {
        return badRequest(res, "No fields to update");
      }
      sets.push("updated_at = now()");
      params.push(id);

      const { rows } = await pool.query(
        `UPDATE drm.promotions SET ${sets.join(", ")} WHERE id::text = $${params.length}::text RETURNING *`,
        params,
      );
      res.json({ success: true, promotion: mapRow(rows[0]) });
    } catch (err) {
      console.error("[promotion] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update promotion" });
    }
  });

  // PATCH /api/drm/promotions/:id/approve — full-access + HOD only
  app.patch("/api/drm/promotions/:id/approve", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canDecide(role)) {
        return res.status(403).json({ error: "Forbidden", message: "Only HOD/admin can approve promotions" });
      }
      const id = String(req.params.id);
      const raw = await getRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Promotion not found" });
      if (!(await canMutate(req, raw))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this promotion" });
      }

      const { rows } = await pool.query(
        `UPDATE drm.promotions
         SET status = 'approved', approved_by = $1, approved_at = now(), reason = NULL, updated_at = now()
         WHERE id::text = $2::text RETURNING *`,
        [getUserId(req) ?? null, id],
      );
      res.json({ success: true, promotion: mapRow(rows[0]) });
    } catch (err) {
      console.error("[promotion] approve error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to approve promotion" });
    }
  });

  // PATCH /api/drm/promotions/:id/reject — full-access + HOD only
  app.patch("/api/drm/promotions/:id/reject", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canDecide(role)) {
        return res.status(403).json({ error: "Forbidden", message: "Only HOD/admin can reject promotions" });
      }
      const id = String(req.params.id);
      const raw = await getRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Promotion not found" });
      if (!(await canMutate(req, raw))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to decide this promotion" });
      }

      const reason = req.body?.reason ? String(req.body.reason) : null;
      const { rows } = await pool.query(
        `UPDATE drm.promotions
         SET status = 'rejected', approved_by = $1, approved_at = now(), reason = $2, updated_at = now()
         WHERE id::text = $3::text RETURNING *`,
        [getUserId(req) ?? null, reason, id],
      );
      res.json({ success: true, promotion: mapRow(rows[0]) });
    } catch (err) {
      console.error("[promotion] reject error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to reject promotion" });
    }
  });

  // DELETE /api/drm/promotions/:id — soft delete
  app.delete("/api/drm/promotions/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Promotion not found" });
      if (!(await canMutate(req, raw))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to delete this promotion" });
      }
      await pool.query(
        `UPDATE drm.promotions SET deleted_at = now(), updated_at = now() WHERE id::text = $1::text`,
        [id],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[promotion] delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete promotion" });
    }
  });
}
