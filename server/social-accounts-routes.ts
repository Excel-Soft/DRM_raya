/**
 * DRM Social Accounts routes — mounted under /api/drm/social-accounts.
 *
 * MUST be registered AFTER authMiddleware and the URL-permission middleware in
 * server/routes.ts so the API is never public.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_admin / super_hod  -> view all, create, edit, verify, delete
 *   - hr / hr_manager                  -> view all
 *   - hod / managerial roles           -> view their department (+self), create,
 *                                         edit/verify/delete within scope
 *   - everyone else                    -> view + manage ONLY their own records
 * Cross-scope mutation returns 403.
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
    resourceType: "drm_social_account",
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
 * Returns the list of creator user-ids this requester may view/manage, or null
 * for "all".
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

function canManageRow(req: Request, allowed: string[] | null, createdBy: any): boolean {
  if (allowed === null) return true;
  if (createdBy == null) return false;
  return allowed.includes(String(createdBy));
}

const STATUSES = ["active", "inactive"];

const SELECT_COLS = `
  sa.id,
  sa.owner_name      as "ownerName",
  sa.platform,
  sa.account_name    as "accountName",
  sa.url,
  sa.customer_id     as "customerId",
  c.company_name     as "customerName",
  sa.project_id      as "projectId",
  sa.status,
  sa.is_verified     as "isVerified",
  sa.verified_by     as "verifiedBy",
  vb.name            as "verifiedByName",
  sa.verified_at     as "verifiedAt",
  sa.created_by      as "createdBy",
  cb.name            as "createdByName",
  sa.created_at      as "createdAt",
  sa.updated_at      as "updatedAt"
`;

const FROM_JOINS = `
  from drm.social_accounts sa
  left join drm.customers c on c.id = sa.customer_id
  left join drm.users vb on vb.id = sa.verified_by
  left join drm.users cb on cb.id = sa.created_by
`;

async function ensureSocialAccountsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.social_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_name text,
      platform text NOT NULL,
      account_name text,
      url text,
      customer_id uuid REFERENCES drm.customers(id) ON DELETE SET NULL,
      project_id text,
      status text NOT NULL DEFAULT 'active',
      is_verified boolean NOT NULL DEFAULT false,
      verified_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      verified_at timestamptz,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_social_accounts_created_by ON drm.social_accounts (created_by)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON drm.social_accounts (platform)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON drm.social_accounts (status)`,
  );
}

async function getRowById(id: string): Promise<any | null> {
  const { rows } = await pool.query(
    `select ${SELECT_COLS}, sa.deleted_at as "deletedAt" ${FROM_JOINS} where sa.id = $1 limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function registerSocialAccountsRoutes(app: Express) {
  await ensureSocialAccountsTable();

  // GET /api/drm/social-accounts — paginated, filtered list (scoped to caller)
  app.get("/api/drm/social-accounts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize ?? 25) || 25));
      const offset = (page - 1) * pageSize;

      const search = req.query.search ? String(req.query.search).trim() : "";
      const platform = req.query.platform ? String(req.query.platform).trim() : "";
      const status = req.query.status ? String(req.query.status).trim() : "";
      const isVerifiedRaw = req.query.is_verified ?? req.query.isVerified;

      const allowed = await getAllowedCreatorIds(req);

      const where: string[] = ["sa.deleted_at IS NULL"];
      const params: any[] = [];

      if (allowed !== null) {
        if (allowed.length === 0) {
          return res.json({ data: [], total: 0, page, pageSize });
        }
        params.push(allowed);
        where.push(`sa.created_by = ANY($${params.length}::uuid[])`);
      }

      if (search) {
        params.push(`%${search}%`);
        const p = `$${params.length}`;
        where.push(
          `(sa.owner_name ILIKE ${p} OR sa.account_name ILIKE ${p} OR sa.platform ILIKE ${p} OR sa.url ILIKE ${p} OR c.company_name ILIKE ${p})`,
        );
      }
      if (platform) {
        params.push(platform);
        where.push(`sa.platform = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`sa.status = $${params.length}`);
      }
      if (isVerifiedRaw !== undefined && isVerifiedRaw !== "") {
        const verified = String(isVerifiedRaw) === "true" || String(isVerifiedRaw) === "1";
        params.push(verified);
        where.push(`sa.is_verified = $${params.length}`);
      }

      const whereSql = where.length ? `where ${where.join(" AND ")}` : "";

      const countRes = await pool.query(
        `select count(*)::int as total ${FROM_JOINS} ${whereSql}`,
        params,
      );
      const total = countRes.rows[0]?.total ?? 0;

      const listParams = params.slice();
      listParams.push(pageSize);
      listParams.push(offset);
      const { rows } = await pool.query(
        `select ${SELECT_COLS} ${FROM_JOINS} ${whereSql}
         order by sa.created_at desc
         limit $${listParams.length - 1} offset $${listParams.length}`,
        listParams,
      );

      res.json({ data: rows, total, page, pageSize });
    } catch (err) {
      console.error("[social-accounts] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch social accounts" });
    }
  });

  // POST /api/drm/social-accounts — create
  app.post("/api/drm/social-accounts", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const b = req.body ?? {};

      const platform = String(b.platform ?? "").trim();
      if (!platform) return badRequest(res, "platform is required");

      const url = b.url !== undefined && b.url !== null ? String(b.url).trim() : "";
      if (url && !isHttpUrl(url)) {
        return badRequest(res, "url must be a valid http(s) URL");
      }

      let status = b.status !== undefined ? String(b.status).trim() : "active";
      if (!STATUSES.includes(status)) {
        return badRequest(res, `status must be one of ${STATUSES.join(", ")}`);
      }

      const { rows } = await pool.query(
        `insert into drm.social_accounts
           (owner_name, platform, account_name, url, customer_id, project_id, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          b.ownerName ? String(b.ownerName) : null,
          platform,
          b.accountName ? String(b.accountName) : null,
          url || null,
          b.customerId ? String(b.customerId) : null,
          b.projectId ? String(b.projectId) : null,
          status,
          String(getUserId(req)),
        ],
      );
      const created = await getRowById(String(rows[0].id));
      await audit(req, "drm.social_account.create", rows[0]?.id, { platform, status });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error("[social-accounts] create error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create social account" });
    }
  });

  // PATCH /api/drm/social-accounts/:id — edit (incl. status toggle)
  app.patch("/api/drm/social-accounts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const row = await getRowById(id);
      if (!row || row.deletedAt) return res.status(404).json({ error: "NotFound", message: "Social account not found" });

      const allowed = await getAllowedCreatorIds(req);
      if (!canManageRow(req, allowed, row.createdBy)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to edit this social account" });
      }

      const b = req.body ?? {};

      if (b.platform !== undefined && !String(b.platform).trim()) {
        return badRequest(res, "platform cannot be empty");
      }
      if (b.url !== undefined && b.url !== null && String(b.url).trim() && !isHttpUrl(String(b.url).trim())) {
        return badRequest(res, "url must be a valid http(s) URL");
      }
      if (b.status !== undefined && !STATUSES.includes(String(b.status).trim())) {
        return badRequest(res, `status must be one of ${STATUSES.join(", ")}`);
      }

      const sets: string[] = [];
      const params: any[] = [];
      const add = (col: string, val: any) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (b.ownerName !== undefined) add("owner_name", b.ownerName ? String(b.ownerName) : null);
      if (b.platform !== undefined) add("platform", String(b.platform).trim());
      if (b.accountName !== undefined) add("account_name", b.accountName ? String(b.accountName) : null);
      if (b.url !== undefined) add("url", b.url && String(b.url).trim() ? String(b.url).trim() : null);
      if (b.customerId !== undefined) add("customer_id", b.customerId ? String(b.customerId) : null);
      if (b.projectId !== undefined) add("project_id", b.projectId ? String(b.projectId) : null);
      if (b.status !== undefined) add("status", String(b.status).trim());

      if (sets.length === 0) {
        return badRequest(res, "No editable fields provided");
      }
      sets.push(`updated_at = now()`);

      params.push(id);
      await pool.query(
        `update drm.social_accounts set ${sets.join(", ")} where id = $${params.length}`,
        params,
      );
      const updated = await getRowById(id);
      await audit(req, "drm.social_account.update", id, {
        changed: sets.filter((s) => !s.startsWith("updated_at")).map((s) => s.split(" = ")[0]),
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("[social-accounts] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update social account" });
    }
  });

  // PATCH /api/drm/social-accounts/:id/verify — mark verified
  app.patch("/api/drm/social-accounts/:id/verify", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const row = await getRowById(id);
      if (!row || row.deletedAt) return res.status(404).json({ error: "NotFound", message: "Social account not found" });

      const allowed = await getAllowedCreatorIds(req);
      if (!canManageRow(req, allowed, row.createdBy)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to verify this social account" });
      }

      await pool.query(
        `update drm.social_accounts
            set is_verified = true, verified_by = $1, verified_at = now(), updated_at = now()
          where id = $2`,
        [String(getUserId(req)), id],
      );
      const updated = await getRowById(id);
      await audit(req, "drm.social_account.verify", id, { verified: true });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("[social-accounts] verify error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to verify social account" });
    }
  });

  // DELETE /api/drm/social-accounts/:id — soft delete
  app.delete("/api/drm/social-accounts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const row = await getRowById(id);
      if (!row || row.deletedAt) return res.status(404).json({ error: "NotFound", message: "Social account not found" });

      const allowed = await getAllowedCreatorIds(req);
      if (!canManageRow(req, allowed, row.createdBy)) {
        return res.status(403).json({ error: "Forbidden", message: "You are not authorized to delete this social account" });
      }

      await pool.query(
        `update drm.social_accounts set deleted_at = now(), updated_at = now() where id = $1`,
        [id],
      );
      await audit(req, "drm.social_account.delete", id, { softDeleted: true });
      res.json({ success: true });
    } catch (err) {
      console.error("[social-accounts] delete error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete social account" });
    }
  });
}
