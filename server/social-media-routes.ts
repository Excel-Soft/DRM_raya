/**
 * Social Media Posting routes — Patch 4 Stage 5 (ISS-03).
 *
 * Mounted in server/routes.ts AFTER authMiddleware + the URL-permission middleware
 * (registerSocialMediaRoutes), so the API is never public. The URL-permission
 * middleware default-ALLOWS unmapped paths, therefore the per-route handler guards
 * below are the REAL enforcement.
 *
 * Surface:
 *   /api/social-media/accounts*  -> ALIAS of the canonical /api/drm/social-accounts
 *                                   handlers (no duplication, no HTTP proxying).
 *   /api/social-media/posts*     -> full posting lifecycle backed by
 *                                   drm.social_media_posts.
 *
 * Lifecycle (both status machines enforced server-side):
 *   approval_status   : DRAFT -> PENDING -> APPROVED | REJECTED  (REJECTED -> PENDING)
 *   publishing_status : DRAFT -> READY -> SCHEDULED -> PUBLISHED  (+ FAILED | CANCELLED)
 *
 * Publishing is INTERNAL / MANUAL only — there is NO external provider integration.
 * "Publish" records an internal, manually-confirmed publication and never claims a
 * post was pushed to Facebook/Instagram/LinkedIn/etc.
 *
 * Access control (enforced on the backend, never trusted from the client):
 *   - admin / super_hod (FULL)       -> everything (global), incl. publish without
 *                                       approval; may approve own posts
 *   - posting/social managers        -> create, and MANAGE (edit/schedule/submit/
 *     (product_posting_manager,         publish-when-APPROVED/cancel/delete) posts
 *      dd_manager, marketing_manager,   within their DEPARTMENT. NOT approvers.
 *      seo_smm_manager)
 *   - hod                            -> approve/reject (not own) posts within their
 *                                       DEPARTMENT; view dept scope; manages only OWN
 *   - everyone else (executives...)  -> create/edit/submit/cancel/delete OWN; view own
 *   Two scopes back this: VIEW scope = getAllowedUserIds (FULL/HR=all, HOD/managerial=
 *   dept, else self), used by list/get/approve/reject; MANAGEMENT scope =
 *   getManagedUserIds (FULL=all, posting-manager=dept, else self), used by edit/
 *   schedule/submit/cancel/delete. Approve/reject/get-by-id re-verify scope per row.
 */
import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { AuditLogService } from "./services/audit-log.service";
import { NotificationService } from "./services/notification-service";
import {
  ensureSocialAccountsTable,
  registerSocialAccountHandlers,
} from "./social-accounts-routes";

const FULL_ACCESS_ROLES = ["admin", "super_hod"]; // super_admin normalizes to admin
const HR_ROLES = ["hr", "hr_manager"];
const POSTING_MANAGER_ROLES = [
  "product_posting_manager",
  "dd_manager",
  "marketing_manager",
  "seo_smm_manager",
];

const APPROVAL_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
const PUBLISHING_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

const MAX_CONTENT = 5000;
const MAX_TITLE = 300;
const TARGET_URL = "/social-media";

// ---------------------------------------------------------------------------
// Identity / role helpers
// ---------------------------------------------------------------------------
function getUserId(req: Request): string | undefined {
  return (req.user as any)?.userId || (req.user as any)?.id;
}
function getActiveRole(req: Request): string {
  return normalizeRole((req.user as any)?.activeRoleId || (req.user as any)?.roleId);
}
function isFull(role: string): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}
function isHr(role: string): boolean {
  return HR_ROLES.includes(role) || role.includes("hr");
}
function isHod(role: string): boolean {
  return role === "hod";
}
function isPostingManager(role: string): boolean {
  return POSTING_MANAGER_ROLES.includes(role);
}
// Who may approve/reject: FULL + hod only (per the signed-off permission model).
// Posting/social managers create/edit/schedule/submit/publish — they do NOT approve.
function isApprover(role: string): boolean {
  return isFull(role) || isHod(role);
}
// Who may publish / schedule: FULL + posting/social managers.
function canPublish(role: string): boolean {
  return isFull(role) || isPostingManager(role);
}
function canSchedule(role: string): boolean {
  return isFull(role) || isPostingManager(role);
}

// ---------------------------------------------------------------------------
// Response / validation helpers
// ---------------------------------------------------------------------------
function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: "BadRequest", message });
}
function forbidden(res: Response, message = "You do not have permission for this action") {
  return res.status(403).json({ error: "Forbidden", message });
}
function notFound(res: Response, message = "Post not found") {
  return res.status(404).json({ error: "NotFound", message });
}
function conflict(res: Response, message: string) {
  return res.status(409).json({ error: "Conflict", message });
}
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function audit(
  req: Request,
  action: string,
  id: unknown,
  opts?: { before?: unknown; after?: unknown; reason?: string },
) {
  await AuditLogService.record({
    actorUserId: getUserId(req),
    action,
    module: "social_media",
    entityType: "drm_social_media_post",
    entityId: String(id ?? ""),
    before: opts?.before,
    after: opts?.after,
    reason: opts?.reason,
    req,
  });
}

async function auditTransition(
  req: Request,
  action: string,
  id: unknown,
  previousStatus: string,
  nextStatus: string,
  reason?: string,
) {
  await AuditLogService.recordTransition({
    actorUserId: getUserId(req),
    action,
    module: "social_media",
    entityType: "drm_social_media_post",
    entityId: String(id ?? ""),
    previousStatus,
    nextStatus,
    reason,
    req,
  });
}

// ---------------------------------------------------------------------------
// Scoping (mirrors today-post-routes / social-accounts-routes)
// ---------------------------------------------------------------------------
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

/** user ids whose posts the caller may view, or null for "all". */
async function getAllowedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFull(role) || isHr(role)) return null;

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

/** Can the caller VIEW a row created by createdBy? Mirrors the list query scope. */
async function canViewRow(req: Request, createdBy: string | null): Promise<boolean> {
  const allowed = await getAllowedUserIds(req);
  if (allowed === null) return true;
  return !!createdBy && allowed.includes(String(createdBy));
}

/**
 * user ids whose posts the caller may MANAGE (edit/submit/schedule/cancel/delete),
 * or null for "all". Management is NARROWER than view scope: only FULL (all),
 * posting/social managers (their own department) and the owner themselves. HOD and
 * other managerial roles can only manage their OWN posts — their elevated rights are
 * approve/reject, which is handled separately (isApprover) and must not leak into
 * write access via the broader view scope.
 */
async function getManagedUserIds(req: Request): Promise<string[] | null> {
  const myId = getUserId(req);
  if (!myId) return [];
  const role = getActiveRole(req);
  if (isFull(role)) return null;
  if (isPostingManager(role)) {
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

/** Can the caller manage (edit/submit/schedule/cancel/delete) a row created by createdBy? */
async function canManageRow(req: Request, createdBy: string | null): Promise<boolean> {
  const allowed = await getManagedUserIds(req);
  if (allowed === null) return true;
  return !!createdBy && allowed.includes(String(createdBy));
}

// ---------------------------------------------------------------------------
// SQL projection
// ---------------------------------------------------------------------------
const SELECT_COLS = `
  p.id,
  p.platform,
  p.social_account_id as "socialAccountId",
  sa.account_name as "socialAccountName",
  sa.platform as "socialAccountPlatform",
  p.title,
  p.content,
  p.media_url as "mediaUrl",
  p.media_name as "mediaName",
  p.linked_customer_id as "linkedCustomerId",
  c.company_name as "linkedCustomerName",
  p.linked_project_id as "linkedProjectId",
  p.scheduled_at as "scheduledAt",
  p.published_at as "publishedAt",
  p.approval_status as "approvalStatus",
  p.publishing_status as "publishingStatus",
  p.failure_reason as "failureReason",
  p.rejection_reason as "rejectionReason",
  p.cancel_reason as "cancelReason",
  p.external_ref as "externalRef",
  p.created_by as "createdBy",
  cb.name as "createdByName",
  p.approved_by as "approvedBy",
  ab.name as "approvedByName",
  p.published_by as "publishedBy",
  pb.name as "publishedByName",
  p.created_at as "createdAt",
  p.updated_at as "updatedAt"
`;
const FROM_JOINS = `
  from drm.social_media_posts p
  left join drm.social_accounts sa on sa.id = p.social_account_id
  left join drm.customers c on c.id = p.linked_customer_id
  left join drm.users cb on cb.id = p.created_by
  left join drm.users ab on ab.id = p.approved_by
  left join drm.users pb on pb.id = p.published_by
`;

type RawRow = {
  id: string;
  created_by: string | null;
  approval_status: string;
  publishing_status: string;
  title: string | null;
  deleted_at: string | null;
};

async function getRawRow(id: string): Promise<RawRow | null> {
  const { rows } = await pool.query(
    `select id, created_by, approval_status, publishing_status, title, deleted_at
       from drm.social_media_posts where id::text = $1::text limit 1`,
    [id],
  );
  return (rows[0] as RawRow) ?? null;
}

async function getFullRow(id: string) {
  const { rows } = await pool.query(
    `select ${SELECT_COLS} ${FROM_JOINS} where p.id::text = $1::text limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Table DDL (runtime source of truth — db:push is broken repo-wide)
// ---------------------------------------------------------------------------
export async function ensureSocialMediaPostsTable(): Promise<void> {
  // FK target must exist first.
  await ensureSocialAccountsTable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.social_media_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      platform text NOT NULL,
      social_account_id uuid REFERENCES drm.social_accounts(id) ON DELETE SET NULL,
      title text,
      content text NOT NULL,
      media_url text,
      media_name text,
      linked_customer_id uuid REFERENCES drm.customers(id) ON DELETE SET NULL,
      linked_project_id text,
      scheduled_at timestamptz,
      published_at timestamptz,
      approval_status text NOT NULL DEFAULT 'DRAFT',
      publishing_status text NOT NULL DEFAULT 'DRAFT',
      failure_reason text,
      rejection_reason text,
      cancel_reason text,
      external_ref text,
      created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      approved_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      published_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_created_by_idx ON drm.social_media_posts (created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_account_idx ON drm.social_media_posts (social_account_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_approval_idx ON drm.social_media_posts (approval_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_publishing_idx ON drm.social_media_posts (publishing_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_scheduled_idx ON drm.social_media_posts (scheduled_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS smp_deleted_idx ON drm.social_media_posts (deleted_at)`);
}

// ---------------------------------------------------------------------------
// Shared list query builder (used by GET /posts and GET /posts/export)
// ---------------------------------------------------------------------------
async function buildListQuery(req: Request) {
  const allowed = await getAllowedUserIds(req);
  const where: string[] = ["p.deleted_at IS NULL"];
  const params: any[] = [];
  let i = 1;

  if (allowed !== null) {
    if (allowed.length === 0) {
      where.push("false");
    } else {
      where.push(`p.created_by::text = ANY($${i}::text[])`);
      params.push(allowed.map(String));
      i++;
    }
  }

  const platform = String(req.query.platform ?? "").trim();
  if (platform && platform !== "all") {
    where.push(`lower(p.platform) = lower($${i})`);
    params.push(platform);
    i++;
  }

  const accountId = String(req.query.socialAccountId ?? req.query.account ?? "").trim();
  if (accountId && accountId !== "all") {
    where.push(`p.social_account_id::text = $${i}::text`);
    params.push(accountId);
    i++;
  }

  const approval = String(req.query.approvalStatus ?? "").trim().toUpperCase();
  if (approval && approval !== "ALL" && APPROVAL_STATUSES.includes(approval)) {
    where.push(`p.approval_status = $${i}`);
    params.push(approval);
    i++;
  }

  const publishing = String(req.query.publishingStatus ?? "").trim().toUpperCase();
  if (publishing && publishing !== "ALL" && PUBLISHING_STATUSES.includes(publishing)) {
    where.push(`p.publishing_status = $${i}`);
    params.push(publishing);
    i++;
  }

  const createdBy = String(req.query.createdBy ?? "").trim();
  if (createdBy && createdBy !== "all") {
    where.push(`p.created_by::text = $${i}::text`);
    params.push(createdBy);
    i++;
  }

  const from = String(req.query.scheduledFrom ?? "").trim();
  if (from) {
    where.push(`p.scheduled_at >= $${i}`);
    params.push(from);
    i++;
  }
  const to = String(req.query.scheduledTo ?? "").trim();
  if (to) {
    where.push(`p.scheduled_at <= $${i}`);
    params.push(to);
    i++;
  }

  const search = String(req.query.search ?? "").trim();
  if (search) {
    where.push(
      `(p.title ILIKE $${i} OR p.content ILIKE $${i} OR p.platform ILIKE $${i})`,
    );
    params.push(`%${search}%`);
    i++;
  }

  return { whereSql: where.join(" AND "), params, nextIndex: i };
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export async function registerSocialMediaRoutes(app: Express) {
  await ensureSocialMediaPostsTable();

  // Accounts alias — reuse the canonical social-account handlers verbatim.
  registerSocialAccountHandlers(app, "/api/social-media/accounts");

  const POSTS = "/api/social-media/posts";

  // GET /posts/export — CSV export honoring the same filters (must precede /:id).
  app.get(`${POSTS}/export`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { whereSql, params } = await buildListQuery(req);
      const { rows } = await pool.query(
        `select ${SELECT_COLS} ${FROM_JOINS} where ${whereSql} order by p.created_at desc limit 5000`,
        params,
      );

      const headers = [
        "id",
        "platform",
        "account",
        "title",
        "content",
        "approvalStatus",
        "publishingStatus",
        "scheduledAt",
        "publishedAt",
        "createdBy",
        "createdAt",
      ];
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = [headers.join(",")];
      for (const r of rows as any[]) {
        lines.push(
          [
            r.id,
            r.platform,
            r.socialAccountName ?? "",
            r.title ?? "",
            r.content ?? "",
            r.approvalStatus,
            r.publishingStatus,
            r.scheduledAt ?? "",
            r.publishedAt ?? "",
            r.createdByName ?? r.createdBy ?? "",
            r.createdAt ?? "",
          ]
            .map(esc)
            .join(","),
        );
      }
      await audit(req, "social_post.export", "", { after: { count: rows.length } });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="social-media-posts-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("[social-media] export failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to export posts" });
    }
  });

  // GET /posts — paginated, filtered, scoped list.
  app.get(POSTS, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25) || 25));
      const offset = (page - 1) * pageSize;

      const { whereSql, params, nextIndex } = await buildListQuery(req);

      const countResult = await pool.query(
        `select count(*)::int as total from drm.social_media_posts p where ${whereSql}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      const listParams = [...params, pageSize, offset];
      const { rows } = await pool.query(
        `select ${SELECT_COLS} ${FROM_JOINS} where ${whereSql}
           order by p.created_at desc
           limit $${nextIndex} offset $${nextIndex + 1}`,
        listParams,
      );

      res.json({ data: rows, total, page, pageSize });
    } catch (err) {
      console.error("[social-media] list failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch posts" });
    }
  });

  // GET /dashboard/summary — honest, caller-scoped aggregate counts (NOT paginated).
  // Reuses buildListQuery so the same RBAC scope and the same filters
  // (platform/account/approval/publishing/createdBy/scheduled-range/search) as
  // GET /posts apply. Counts come straight from the real table; never fabricated.
  app.get("/api/social-media/dashboard/summary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { whereSql, params } = await buildListQuery(req);
      const { rows } = await pool.query(
        `select
           count(*)::int as "total",
           count(*) filter (where p.approval_status = 'DRAFT')::int     as "apDraft",
           count(*) filter (where p.approval_status = 'PENDING')::int   as "apPending",
           count(*) filter (where p.approval_status = 'APPROVED')::int  as "apApproved",
           count(*) filter (where p.approval_status = 'REJECTED')::int  as "apRejected",
           count(*) filter (where p.publishing_status = 'DRAFT')::int     as "puDraft",
           count(*) filter (where p.publishing_status = 'SCHEDULED')::int as "puScheduled",
           count(*) filter (where p.publishing_status = 'READY')::int     as "puReady",
           count(*) filter (where p.publishing_status = 'PUBLISHED')::int as "puPublished",
           count(*) filter (where p.publishing_status = 'FAILED')::int    as "puFailed",
           count(*) filter (where p.publishing_status = 'CANCELLED')::int as "puCancelled",
           count(*) filter (where p.publishing_status = 'SCHEDULED' and p.scheduled_at >= now())::int as "upcoming"
         from drm.social_media_posts p
        where ${whereSql}`,
        params,
      );
      const r: Record<string, number> = rows[0] ?? {};
      res.json({
        total: r.total ?? 0,
        approval: {
          DRAFT: r.apDraft ?? 0,
          PENDING: r.apPending ?? 0,
          APPROVED: r.apApproved ?? 0,
          REJECTED: r.apRejected ?? 0,
        },
        publishing: {
          DRAFT: r.puDraft ?? 0,
          SCHEDULED: r.puScheduled ?? 0,
          READY: r.puReady ?? 0,
          PUBLISHED: r.puPublished ?? 0,
          FAILED: r.puFailed ?? 0,
          CANCELLED: r.puCancelled ?? 0,
        },
        upcomingScheduled: r.upcoming ?? 0,
      });
    } catch (err) {
      console.error("[social-media] summary failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to load summary" });
    }
  });

  // GET /posts/:id — single post (scoped).
  app.get(`${POSTS}/:id`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (!(await canViewRow(req, raw.created_by))) {
        return forbidden(res, "You cannot view this post");
      }
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] get failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch post" });
    }
  });

  // POST /posts — create a DRAFT (any authenticated user, owned by self).
  app.post(POSTS, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const myId = getUserId(req);
      if (!myId) return res.status(401).json({ error: "Unauthorized" });
      const b = req.body ?? {};

      const platform = String(b.platform ?? "").trim();
      if (!platform) return badRequest(res, "platform is required");

      const socialAccountId = String(b.socialAccountId ?? "").trim();
      if (!socialAccountId) return badRequest(res, "account is required");
      const acc = await pool.query(
        `select id from drm.social_accounts where id::text = $1::text and deleted_at is null limit 1`,
        [socialAccountId],
      );
      if (acc.rows.length === 0) return badRequest(res, "selected account does not exist");

      const content = String(b.content ?? "").trim();
      if (!content) return badRequest(res, "content is required");
      if (content.length > MAX_CONTENT)
        return badRequest(res, `content must be at most ${MAX_CONTENT} characters`);

      const title = b.title != null ? String(b.title).trim() : null;
      if (title && title.length > MAX_TITLE)
        return badRequest(res, `title must be at most ${MAX_TITLE} characters`);

      const mediaUrl = b.mediaUrl != null ? String(b.mediaUrl).trim() : null;
      if (mediaUrl && !isHttpUrl(mediaUrl))
        return badRequest(res, "mediaUrl must be a valid http(s) URL");
      const mediaName = b.mediaName != null ? String(b.mediaName).trim() : null;

      const linkedCustomerId = b.linkedCustomerId ? String(b.linkedCustomerId).trim() : null;
      const linkedProjectId = b.linkedProjectId ? String(b.linkedProjectId).trim() : null;

      let scheduledAt: Date | null = null;
      if (b.scheduledAt) {
        const d = new Date(String(b.scheduledAt));
        if (isNaN(d.getTime())) return badRequest(res, "scheduledAt must be a valid date/time");
        if (d.getTime() <= Date.now())
          return badRequest(res, "scheduledAt cannot be in the past");
        scheduledAt = d;
      }

      const { rows } = await pool.query(
        `insert into drm.social_media_posts
           (platform, social_account_id, title, content, media_url, media_name,
            linked_customer_id, linked_project_id, scheduled_at,
            approval_status, publishing_status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT','DRAFT',$10)
         returning id`,
        [
          platform,
          socialAccountId,
          title,
          content,
          mediaUrl,
          mediaName,
          linkedCustomerId,
          linkedProjectId,
          scheduledAt,
          myId,
        ],
      );
      const id = rows[0].id;
      await audit(req, "social_post.create", id, { after: { platform, socialAccountId } });
      const row = await getFullRow(id);
      res.status(201).json(row);
    } catch (err) {
      console.error("[social-media] create failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create post" });
    }
  });

  // PATCH /posts/:id — edit (DRAFT/REJECTED only, unless FULL).
  app.patch(`${POSTS}/:id`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);

      const role = getActiveRole(req);
      if (!isFull(role) && !(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot edit this post");
      if (!isFull(role) && !["DRAFT", "REJECTED"].includes(raw.approval_status))
        return conflict(res, "Only draft or rejected posts can be edited");

      const b = req.body ?? {};
      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (b.platform !== undefined) {
        const platform = String(b.platform ?? "").trim();
        if (!platform) return badRequest(res, "platform cannot be empty");
        sets.push(`platform = $${i++}`);
        params.push(platform);
      }
      if (b.socialAccountId !== undefined) {
        const socialAccountId = String(b.socialAccountId ?? "").trim();
        if (!socialAccountId) return badRequest(res, "account cannot be empty");
        const acc = await pool.query(
          `select id from drm.social_accounts where id::text = $1::text and deleted_at is null limit 1`,
          [socialAccountId],
        );
        if (acc.rows.length === 0) return badRequest(res, "selected account does not exist");
        sets.push(`social_account_id = $${i++}`);
        params.push(socialAccountId);
      }
      if (b.title !== undefined) {
        const title = b.title != null ? String(b.title).trim() : null;
        if (title && title.length > MAX_TITLE)
          return badRequest(res, `title must be at most ${MAX_TITLE} characters`);
        sets.push(`title = $${i++}`);
        params.push(title);
      }
      if (b.content !== undefined) {
        const content = String(b.content ?? "").trim();
        if (!content) return badRequest(res, "content is required");
        if (content.length > MAX_CONTENT)
          return badRequest(res, `content must be at most ${MAX_CONTENT} characters`);
        sets.push(`content = $${i++}`);
        params.push(content);
      }
      if (b.mediaUrl !== undefined) {
        const mediaUrl = b.mediaUrl != null ? String(b.mediaUrl).trim() : null;
        if (mediaUrl && !isHttpUrl(mediaUrl))
          return badRequest(res, "mediaUrl must be a valid http(s) URL");
        sets.push(`media_url = $${i++}`);
        params.push(mediaUrl);
      }
      if (b.mediaName !== undefined) {
        sets.push(`media_name = $${i++}`);
        params.push(b.mediaName != null ? String(b.mediaName).trim() : null);
      }
      if (b.linkedCustomerId !== undefined) {
        sets.push(`linked_customer_id = $${i++}`);
        params.push(b.linkedCustomerId ? String(b.linkedCustomerId).trim() : null);
      }
      if (b.linkedProjectId !== undefined) {
        sets.push(`linked_project_id = $${i++}`);
        params.push(b.linkedProjectId ? String(b.linkedProjectId).trim() : null);
      }

      if (sets.length === 0) return badRequest(res, "No editable fields supplied");
      sets.push(`updated_at = now()`);
      params.push(id);
      await pool.query(
        `update drm.social_media_posts set ${sets.join(", ")} where id::text = $${i}::text`,
        params,
      );
      await audit(req, "social_post.update", id, { after: { fields: sets.length - 1 } });
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] update failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update post" });
    }
  });

  // POST /posts/:id/submit-approval — DRAFT/REJECTED -> PENDING.
  app.post(`${POSTS}/:id/submit-approval`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (!(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot submit this post");
      if (!["DRAFT", "REJECTED"].includes(raw.approval_status))
        return conflict(res, "Only draft or rejected posts can be submitted for approval");

      await pool.query(
        `update drm.social_media_posts
            set approval_status = 'PENDING', publishing_status = 'DRAFT',
                rejection_reason = null, updated_at = now()
          where id::text = $1::text`,
        [id],
      );
      await auditTransition(req, "social_post.submit", id, raw.approval_status, "PENDING");
      await NotificationService.notifyRole(
        "hod",
        `Social post submitted for approval: "${raw.title ?? id}"`,
        "INFO",
        { targetUrl: TARGET_URL },
      );
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] submit failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to submit post" });
    }
  });

  // POST /posts/:id/approve — PENDING -> APPROVED (publishing READY). No self-approval unless FULL.
  app.post(`${POSTS}/:id/approve`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!isApprover(role)) return forbidden(res, "You cannot approve posts");
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (raw.approval_status !== "PENDING")
        return conflict(res, "Only posts pending approval can be approved");
      if (!isFull(role) && raw.created_by && String(raw.created_by) === String(getUserId(req)))
        return forbidden(res, "You cannot approve your own post");
      if (!isFull(role) && !(await canViewRow(req, raw.created_by)))
        return forbidden(res, "You can only approve posts within your department");

      await pool.query(
        `update drm.social_media_posts
            set approval_status = 'APPROVED', publishing_status = 'READY',
                approved_by = $2, rejection_reason = null, updated_at = now()
          where id::text = $1::text`,
        [id, getUserId(req)],
      );
      await auditTransition(req, "social_post.approve", id, "PENDING", "APPROVED");
      if (raw.created_by) {
        await NotificationService.notify({
          userId: String(raw.created_by),
          message: `Your social post "${raw.title ?? id}" was approved`,
          type: "SUCCESS",
          targetUrl: TARGET_URL,
        });
      }
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] approve failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to approve post" });
    }
  });

  // POST /posts/:id/reject — PENDING -> REJECTED (reason required).
  app.post(`${POSTS}/:id/reject`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!isApprover(role)) return forbidden(res, "You cannot reject posts");
      const id = String(req.params.id);
      const reason = String((req.body ?? {}).reason ?? "").trim();
      if (!reason) return badRequest(res, "A rejection reason is required");
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (raw.approval_status !== "PENDING")
        return conflict(res, "Only posts pending approval can be rejected");
      if (!isFull(role) && !(await canViewRow(req, raw.created_by)))
        return forbidden(res, "You can only reject posts within your department");

      await pool.query(
        `update drm.social_media_posts
            set approval_status = 'REJECTED', publishing_status = 'DRAFT',
                rejection_reason = $2, updated_at = now()
          where id::text = $1::text`,
        [id, reason],
      );
      await auditTransition(req, "social_post.reject", id, "PENDING", "REJECTED", reason);
      if (raw.created_by) {
        await NotificationService.notify({
          userId: String(raw.created_by),
          message: `Your social post "${raw.title ?? id}" was rejected: ${reason}`,
          type: "WARNING",
          targetUrl: TARGET_URL,
        });
      }
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] reject failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to reject post" });
    }
  });

  // POST /posts/:id/schedule — APPROVED + READY/SCHEDULED -> SCHEDULED (future date).
  app.post(`${POSTS}/:id/schedule`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canSchedule(role)) return forbidden(res, "You cannot schedule posts");
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (!isFull(role) && !(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot schedule this post");

      const value = String((req.body ?? {}).scheduledAt ?? "").trim();
      if (!value) return badRequest(res, "scheduledAt is required");
      const d = new Date(value);
      if (isNaN(d.getTime())) return badRequest(res, "scheduledAt must be a valid date/time");
      if (d.getTime() <= Date.now()) return badRequest(res, "scheduledAt cannot be in the past");

      if (raw.approval_status !== "APPROVED")
        return conflict(res, "Only approved posts can be scheduled");
      if (!["READY", "SCHEDULED"].includes(raw.publishing_status))
        return conflict(res, "Post is not in a schedulable state");

      await pool.query(
        `update drm.social_media_posts
            set publishing_status = 'SCHEDULED', scheduled_at = $2, updated_at = now()
          where id::text = $1::text`,
        [id, d],
      );
      await auditTransition(req, "social_post.schedule", id, raw.publishing_status, "SCHEDULED");
      if (raw.created_by) {
        await NotificationService.notify({
          userId: String(raw.created_by),
          message: `Your social post "${raw.title ?? id}" was scheduled for ${d.toLocaleString()}`,
          type: "INFO",
          targetUrl: TARGET_URL,
        });
      }
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] schedule failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to schedule post" });
    }
  });

  // POST /posts/:id/publish — INTERNAL/MANUAL publish. Requires explicit confirmation.
  // Must be APPROVED unless caller is FULL (override). NEVER claims external posting.
  app.post(`${POSTS}/:id/publish`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const role = getActiveRole(req);
      if (!canPublish(role)) return forbidden(res, "You cannot publish posts");
      const id = String(req.params.id);
      const b = req.body ?? {};
      if (b.confirmManual !== true && b.confirm !== true)
        return badRequest(
          res,
          "Manual publish requires explicit confirmation (confirmManual: true)",
        );
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (!isFull(role) && !(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot publish this post");

      if (raw.publishing_status === "PUBLISHED")
        return conflict(res, "Post is already published");
      if (["CANCELLED", "FAILED"].includes(raw.publishing_status) && !isFull(role))
        return conflict(res, `Cannot publish a ${raw.publishing_status.toLowerCase()} post`);
      if (raw.approval_status !== "APPROVED" && !isFull(role))
        return conflict(res, "Post must be approved before publishing");
      if (!isFull(role) && !["READY", "SCHEDULED"].includes(raw.publishing_status))
        return conflict(res, "Post is not in a publishable state");

      await pool.query(
        `update drm.social_media_posts
            set publishing_status = 'PUBLISHED', published_by = $2, published_at = now(),
                failure_reason = null, external_ref = null, updated_at = now()
          where id::text = $1::text`,
        [id, getUserId(req)],
      );
      await auditTransition(
        req,
        "social_post.publish",
        id,
        raw.publishing_status,
        "PUBLISHED",
        "Manual/Internal publish (no external provider configured)",
      );
      if (raw.created_by) {
        await NotificationService.notify({
          userId: String(raw.created_by),
          message: `Your social post "${raw.title ?? id}" was marked Manually/Internally Published`,
          type: "SUCCESS",
          targetUrl: TARGET_URL,
        });
      }
      const row = await getFullRow(id);
      res.json({
        ...row,
        publishMode: "MANUAL_INTERNAL",
        publishNote:
          "Manual/Internal Published — recorded internally; not posted to any external platform.",
      });
    } catch (err) {
      console.error("[social-media] publish failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to publish post" });
    }
  });

  // POST /posts/:id/cancel — cancel a non-published post (reason required).
  app.post(`${POSTS}/:id/cancel`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const reason = String((req.body ?? {}).reason ?? "").trim();
      if (!reason) return badRequest(res, "A cancellation reason is required");
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);

      if (!(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot cancel this post");

      if (raw.publishing_status === "PUBLISHED")
        return conflict(res, "A published post cannot be cancelled");
      if (raw.publishing_status === "CANCELLED")
        return conflict(res, "Post is already cancelled");

      await pool.query(
        `update drm.social_media_posts
            set publishing_status = 'CANCELLED', cancel_reason = $2, updated_at = now()
          where id::text = $1::text`,
        [id, reason],
      );
      await auditTransition(
        req,
        "social_post.cancel",
        id,
        raw.publishing_status,
        "CANCELLED",
        reason,
      );
      if (raw.created_by) {
        await NotificationService.notify({
          userId: String(raw.created_by),
          message: `Your social post "${raw.title ?? id}" was cancelled: ${reason}`,
          type: "WARNING",
          targetUrl: TARGET_URL,
        });
      }
      const row = await getFullRow(id);
      res.json(row);
    } catch (err) {
      console.error("[social-media] cancel failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to cancel post" });
    }
  });

  // DELETE /posts/:id — soft delete (owner-scope or FULL).
  app.delete(`${POSTS}/:id`, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const id = String(req.params.id);
      const raw = await getRawRow(id);
      if (!raw || raw.deleted_at) return notFound(res);
      if (!isFull(getActiveRole(req)) && !(await canManageRow(req, raw.created_by)))
        return forbidden(res, "You cannot delete this post");

      await pool.query(
        `update drm.social_media_posts set deleted_at = now(), updated_at = now()
          where id::text = $1::text`,
        [id],
      );
      await audit(req, "social_post.delete", id, { before: { approval: raw.approval_status } });
      res.json({ success: true });
    } catch (err) {
      console.error("[social-media] delete failed:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to delete post" });
    }
  });
}
