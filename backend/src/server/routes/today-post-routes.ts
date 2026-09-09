/**
 * Today Post routes — mounted under /api/drm/today-posts.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_hod              -> view all, create, edit, complete
 *   - hr / hr_manager                -> view all
 *   - hod / managerial roles         -> view their department (+ self), create,
 *                                       edit/complete within scope
 *   - everyone else                  -> view ONLY their own posts; create their own
 * Cross-scope mutation returns 403.
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import { ActivityLogService } from "../services/activity-service";

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
    resourceType: "drm_today_post",
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

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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
 * Returns the list of user ids whose posts this requester may view, or null for
 * "all".
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

async function canMutate(req: Request, postedBy: string | null): Promise<boolean> {
  const role = getActiveRole(req);
  if (isFullAccess(role)) return true;
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  if (postedBy && allowed.includes(String(postedBy))) return true;
  return false;
}

export async function ensureTodayPostsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.today_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      platform text NOT NULL,
      entity text,
      post_url text NOT NULL,
      title text,
      customer_id uuid REFERENCES drm.customers(id) ON DELETE SET NULL,
      project_id text,
      social_account_id uuid,
      status text NOT NULL DEFAULT 'pending',
      notes text,
      posted_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      posted_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS today_posts_posted_by_idx ON drm.today_posts (posted_by)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS today_posts_status_idx ON drm.today_posts (status)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS today_posts_created_at_idx ON drm.today_posts (created_at)`,
  );
}

const SELECT_COLUMNS = `
  tp.id,
  tp.platform,
  tp.entity,
  tp.post_url        AS "postUrl",
  tp.title,
  tp.customer_id     AS "customerId",
  tp.project_id      AS "projectId",
  tp.social_account_id AS "socialAccountId",
  tp.status,
  tp.notes,
  tp.posted_by       AS "postedBy",
  tp.posted_at       AS "postedAt",
  tp.completed_at    AS "completedAt",
  tp.created_at      AS "createdAt",
  tp.updated_at      AS "updatedAt",
  u.name             AS "postedByName",
  c.company_name     AS "customerName"
`;

async function getPostRaw(id: string): Promise<any | null> {
  const { rows } = await pool.query(
    `select id, posted_by as "postedBy", status, deleted_at as "deletedAt"
       from drm.today_posts where id::text = $1::text limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function registerTodayPostRoutes(app: Express) {
  await ensureTodayPostsTable();

  // GET /api/drm/today-posts — paginated, filtered list (scoped to caller)
  app.get("/api/drm/today-posts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = Number(req.query.page ?? 1) || 1;
      const pageSize = Number(req.query.pageSize ?? 25) || 25;
      const offset = (page - 1) * pageSize;

      const where: string[] = ["tp.deleted_at IS NULL"];
      const params: any[] = [];

      const allowed = await getAllowedUserIds(req);
      if (allowed !== null) {
        if (allowed.length === 0) {
          return res.json({ data: [], total: 0, page, pageSize });
        }
        params.push(allowed);
        where.push(`tp.posted_by::text = ANY($${params.length}::text[])`);
      }

      if (req.query.platform) {
        params.push(String(req.query.platform));
        where.push(`tp.platform = $${params.length}`);
      }
      if (req.query.entity) {
        params.push(String(req.query.entity));
        where.push(`tp.entity = $${params.length}`);
      }
      if (req.query.status) {
        params.push(String(req.query.status));
        where.push(`tp.status = $${params.length}`);
      }
      if (req.query.dateFrom) {
        params.push(String(req.query.dateFrom));
        where.push(`tp.created_at >= $${params.length}::timestamptz`);
      }
      if (req.query.dateTo) {
        params.push(String(req.query.dateTo));
        where.push(`tp.created_at <= $${params.length}::timestamptz`);
      }
      if (req.query.search) {
        params.push(`%${String(req.query.search)}%`);
        const p = params.length;
        where.push(
          `(tp.title ILIKE $${p} OR tp.post_url ILIKE $${p} OR tp.platform ILIKE $${p} OR tp.entity ILIKE $${p} OR tp.notes ILIKE $${p})`,
        );
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const countResult = await pool.query(
        `select count(*)::int AS total from drm.today_posts tp ${whereSql}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      const listParams = [...params, pageSize, offset];
      const { rows } = await pool.query(
        `select ${SELECT_COLUMNS}
           from drm.today_posts tp
           left join drm.users u on u.id = tp.posted_by
           left join drm.customers c on c.id = tp.customer_id
           ${whereSql}
           order by tp.created_at desc
           limit $${listParams.length - 1} offset $${listParams.length}`,
        listParams,
      );

      res.json({ data: rows, total, page, pageSize });
    } catch (err) {
      console.error("[today-post] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch today posts" });
    }
  });

  // POST /api/drm/today-posts — create
  app.post("/api/drm/today-posts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const b = req.body ?? {};

      const platform = String(b.platform ?? "").trim();
      const postUrl = String(b.postUrl ?? b.post_url ?? "").trim();

      if (!platform) return badRequest(res, "platform is required");
      if (!postUrl) return badRequest(res, "post_url is required");
      if (!isHttpUrl(postUrl)) return badRequest(res, "post_url must be a valid http(s) URL");

      const status = String(b.status ?? "pending").toLowerCase();
      if (!["pending", "completed"].includes(status)) {
        return badRequest(res, "status must be pending or completed");
      }

      const postedBy = String(getUserId(req));
      const completedAt = status === "completed" ? "now()" : null;

      const { rows } = await pool.query(
        `insert into drm.today_posts
           (platform, entity, post_url, title, customer_id, project_id,
            social_account_id, status, notes, posted_by, posted_at, completed_at)
         values
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), ${completedAt ? "now()" : "NULL"})
         returning id`,
        [
          platform,
          b.entity ? String(b.entity) : null,
          postUrl,
          b.title ? String(b.title) : null,
          b.customerId ?? b.customer_id ?? null,
          b.projectId ? String(b.projectId) : (b.project_id ? String(b.project_id) : null),
          b.socialAccountId ?? b.social_account_id ?? null,
          status,
          b.notes ? String(b.notes) : null,
          postedBy,
        ],
      );

      const created = await pool.query(
        `select ${SELECT_COLUMNS}
           from drm.today_posts tp
           left join drm.users u on u.id = tp.posted_by
           left join drm.customers c on c.id = tp.customer_id
           where tp.id = $1`,
        [rows[0].id],
      );
      await audit(req, "drm.today_post.create", rows[0]?.id, { platform, status });
      res.status(201).json({ success: true, post: created.rows[0] });
    } catch (err) {
      console.error("[today-post] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create today post" });
    }
  });

  // PATCH /api/drm/today-posts/:id — edit
  app.patch("/api/drm/today-posts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getPostRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Today post not found" });
      if (!(await canMutate(req, raw.postedBy))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to edit this post" });
      }

      const b = req.body ?? {};
      const sets: string[] = [];
      const params: any[] = [];

      const addSet = (col: string, value: any) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.platform !== undefined) {
        if (!String(b.platform).trim()) return badRequest(res, "platform cannot be empty");
        addSet("platform", String(b.platform).trim());
      }
      if (b.entity !== undefined) addSet("entity", b.entity ? String(b.entity) : null);
      if (b.postUrl !== undefined || b.post_url !== undefined) {
        const newUrl = String(b.postUrl ?? b.post_url ?? "").trim();
        if (!newUrl) return badRequest(res, "post_url cannot be empty");
        if (!isHttpUrl(newUrl)) return badRequest(res, "post_url must be a valid http(s) URL");
        addSet("post_url", newUrl);
      }
      if (b.title !== undefined) addSet("title", b.title ? String(b.title) : null);
      if (b.customerId !== undefined || b.customer_id !== undefined) {
        addSet("customer_id", b.customerId ?? b.customer_id ?? null);
      }
      if (b.projectId !== undefined || b.project_id !== undefined) {
        const pid = b.projectId ?? b.project_id;
        addSet("project_id", pid ? String(pid) : null);
      }
      if (b.socialAccountId !== undefined || b.social_account_id !== undefined) {
        addSet("social_account_id", b.socialAccountId ?? b.social_account_id ?? null);
      }
      if (b.notes !== undefined) addSet("notes", b.notes ? String(b.notes) : null);
      if (b.status !== undefined) {
        const status = String(b.status).toLowerCase();
        if (!["pending", "completed"].includes(status)) {
          return badRequest(res, "status must be pending or completed");
        }
        addSet("status", status);
        sets.push(status === "completed" ? `completed_at = COALESCE(completed_at, now())` : `completed_at = NULL`);
      }

      if (sets.length === 0) return badRequest(res, "No fields to update");

      sets.push(`updated_at = now()`);
      params.push(id);
      await pool.query(
        `update drm.today_posts set ${sets.join(", ")} where id = $${params.length}`,
        params,
      );

      const updated = await pool.query(
        `select ${SELECT_COLUMNS}
           from drm.today_posts tp
           left join drm.users u on u.id = tp.posted_by
           left join drm.customers c on c.id = tp.customer_id
           where tp.id = $1`,
        [id],
      );
      await audit(req, "drm.today_post.update", id, {
        changed: sets.filter((s) => !s.startsWith("updated_at")).map((s) => s.split(" = ")[0]),
      });
      res.json({ success: true, post: updated.rows[0] });
    } catch (err) {
      console.error("[today-post] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update today post" });
    }
  });

  // PATCH /api/drm/today-posts/:id/complete — mark completed
  app.patch("/api/drm/today-posts/:id/complete", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getPostRaw(id);
      if (!raw || raw.deletedAt) return res.status(404).json({ error: "NotFound", message: "Today post not found" });
      if (!(await canMutate(req, raw.postedBy))) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to complete this post" });
      }

      await pool.query(
        `update drm.today_posts
           set status = 'completed', completed_at = now(), updated_at = now()
         where id = $1`,
        [id],
      );

      const updated = await pool.query(
        `select ${SELECT_COLUMNS}
           from drm.today_posts tp
           left join drm.users u on u.id = tp.posted_by
           left join drm.customers c on c.id = tp.customer_id
           where tp.id = $1`,
        [id],
      );
      await audit(req, "drm.today_post.complete", id, { status: "completed" });
      res.json({ success: true, post: updated.rows[0] });
    } catch (err) {
      console.error("[today-post] complete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to complete today post" });
    }
  });
}
