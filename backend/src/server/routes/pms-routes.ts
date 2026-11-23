import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { projectsRepository } from "../repositories/projects.repository";
import { CrossDepartmentStatusService } from "./services/cross-department-status.service";
import { tasksRepository } from "../repositories/tasks.repository";
import { isManagerialRole } from "../utils/role-utils";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { handleProjectReport } from "./project-report-routes";
import { taskCommentsRepository } from "../repositories/task-comments.repository";
import { usersRepository } from "../repositories/users.repository";
import { projectFinancialsRepository } from "../repositories/project-financials.repository";
import { projectPaymentsRepository } from "../repositories/project-payments.repository";
import { projectApprovalsRepository } from "../repositories/project-approvals.repository";
import { projectAssignmentsRepository } from "../repositories/project-assignments.repository";
import { taskTimeLogsRepository } from "../repositories/task-time-logs.repository";
import { taskStatusHistoryRepository } from "../repositories/task-status-history.repository";
import { taskTemplatesRepository } from "../repositories/task-templates.repository";
import { changeTaskStatus, changeProjectStatus } from "./services/pms-transition.service";
import { getConfigValue, patchConfig } from "./services/gm-sales-config.service";
import { PROJECT_GENERATION_MODE } from "../../shared/gm-sales-constants";
import {
  departmentCandidatesForRole,
  departmentFamiliesForRole,
  departmentTypeInQaPipeline,
  departmentTypeMatchesFamily,
  type ProjectDeptFamily,
  ROLE_DEPARTMENT_VARIANTS,
  sqlDepartmentFamilyIn,
  sqlDepartmentFilterForRole,
} from "@shared/project-department-variants";
import { pool } from "../db";
import {
  listPmsDepartmentAssignments,
  savePmsDepartmentAssignment,
} from "../utils/pms-department-assign-legacy";
import { NotificationService } from "./services/notification-service";
import { notifyTaskAssignee } from "../utils/task-notifications";
import { getOrCreateProductPostingWorkflow } from "./services/product-posting-workflow.service";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertTaskCommentSchema,
  insertProjectFinancialSchema,
  insertProjectPaymentSchema,
  insertProjectApprovalSchema,
  insertProjectAssignmentSchema,
  insertTaskTimeLogSchema,
  insertTaskStatusHistorySchema,
  insertTaskTemplateSchema,
  updateTaskTemplateSchema,
} from "@shared/schema";
import { z } from "zod";

/**
 * Collect every role identifier carried on the authenticated user, normalised
 * into a flat list (activeRoleId → roleId → role → roles[]). The PMS transition
 * service only consults this when a manager/admin override is explicitly enabled
 * via config; with the default config the list is unused.
 */
function collectActorRoles(user: any): string[] {
  if (!user) return [];
  const out: string[] = [];
  for (const v of [user.activeRoleId, user.roleId, user.role]) {
    if (v) out.push(String(v));
  }
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) if (r) out.push(String(r));
  }
  return out;
}

/** Role used for PMS scoping — respects "Acting as" (activeRoleId) over stored roleId. */
function resolveRequestUserRole(req: { user?: any }): string {
  const u = req.user;
  return String(u?.activeRoleId || u?.roleId || u?.role || "").toLowerCase();
}

function buildDepartmentTypeScopeSql(userRole: string, userDept: string): string {
  const deptSql = sqlDepartmentFilterForRole("p.department_type", userRole);
  if (deptSql) return deptSql;
  const deptCandidates = departmentCandidatesForRole(userRole, userDept);
  if (deptCandidates.length === 0) return "p.department_type IN ('')";
  const inList = deptCandidates.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ");
  return `p.department_type IN (${inList})`;
}

/** Product Posting list scope — invoice/dept only; do not use workflow rows (D&D minisites also get workflows). */
function buildProductPostingProjectScopeSql(): string {
  const ppDept = sqlDepartmentFamilyIn("p.department_type", "product_posting");
  const ppInvoice = `EXISTS (SELECT 1 FROM drm.product_posting_invoices ppi WHERE ppi.id = p.invoice_id)`;
  const notDnd = `NOT (${sqlDepartmentFamilyIn("p.department_type", "dnd")})`;
  return `((${ppDept}) OR (${ppInvoice})) AND (${notDnd})`;
}

export function getStatsPeriodRange(period?: string) {
  if (!period) return { from: undefined, to: undefined };
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date | undefined;
  let to: Date | undefined;

  switch (period.toUpperCase()) {
    case "TD":
      from = startOfDay;
      to = now;
      break;
    case "LD":
      from = new Date(startOfDay);
      from.setDate(startOfDay.getDate() - 1);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;
    case "WC": {
      const day = startOfDay.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      from = new Date(startOfDay);
      from.setDate(startOfDay.getDate() + diff);
      to = now;
      break;
    }
    case "MN":
    case "MC":
    case "MONTH":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
    case "QT": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), quarterStartMonth, 1);
      to = now;
      break;
    }
    case "YR":
      from = new Date(now.getFullYear(), 0, 1);
      to = now;
      break;
    default:
      from = undefined;
      to = undefined;
      break;
  }
  return { from, to };
}

const LEGACY_WS_CHANNEL_PREFIX = "legacy-ws-channel-";

const LEGACY_ASSIGN_COMPLETED_SQL = `
  coalesce(p.is_deleted, false) = false
  AND trim(coalesce(a.fy_status, '')) <> '1'
  AND (
    lower(trim(coalesce(a.stauts, ''))) IN (
      'end', 'completed', 'done', 'finish', 'finished'
    )
    OR (
      trim(coalesce(a.qa_status, '')) = '1'
      AND lower(trim(coalesce(a.stauts, ''))) IN ('stop', 'panding', 'pending')
    )
  )
`;

/** Legacy assign row still in flight (used for Running Projects / Current With). */
const LEGACY_ASSIGN_OPEN_SQL = `
  trim(coalesce(a.fy_status, '')) <> '1'
  AND lower(trim(coalesce(a.stauts, ''))) NOT IN (
    'end', 'completed', 'done', 'finish', 'finished'
  )
  AND NOT (
    trim(coalesce(a.qa_status, '')) = '1'
    AND lower(trim(coalesce(a.stauts, ''))) IN ('stop', 'panding', 'pending')
  )
`;

const WORKFLOW_STAGE_RANK: Record<string, number> = {
  Executive: 0,
  Manager: 1,
  QA: 2,
  VM: 3,
  Closed: 9,
};

/** Department PMS managers (DD / PP / IT / SEO / Software) — not executives or sales managers. */
const LEGACY_DEP_ID_BY_FAMILY: Partial<Record<ProjectDeptFamily, string>> = {
  product_posting: "9",
  dnd: "10",
  it: "13",
  seo_smm: "8",
  software: "27",
  service: "5",
};

/** Old DRM webxl_quotation_services.dep_id for manager department scoping. */
function legacyDepIdsForRole(userRole: string): string[] | null {
  const families = departmentFamiliesForRole(userRole);
  if (families === null) return null;
  return families
    .map((f) => LEGACY_DEP_ID_BY_FAMILY[f])
    .filter((id): id is string => !!id);
}

function canViewPmsOverallProjects(userRole: string): boolean {
  const r = String(userRole || "").toLowerCase();
  if (r.includes("executive") && !r.includes("admin")) return false;
  if (r.startsWith("sales_")) return false;
  if (!isManagerialRole(r)) return false;
  const families = departmentFamiliesForRole(r);
  if (families === null) return true;
  return families.length > 0;
}

function mergeProjectWorkflowStage(
  legacyStage: string | null | undefined,
  modernStage: string | null | undefined,
  projectStatus: string | null | undefined,
): string {
  if (String(projectStatus || "") === "Completed") return "Closed";
  const candidates = [legacyStage, modernStage].filter(
    (s): s is string => !!s && s !== "Closed",
  );
  if (candidates.length === 0) return "Closed";
  candidates.sort(
    (a, b) => (WORKFLOW_STAGE_RANK[a] ?? 5) - (WORKFLOW_STAGE_RANK[b] ?? 5),
  );
  return candidates[0];
}

/** QA / VM / manager asked for rework (legacy webxl_task_assign signals). */
const LEGACY_ASSIGN_CHANGING_SQL = `
  (
    trim(coalesce(a.qa_status, '')) = '1'
    AND lower(trim(coalesce(a.stauts, ''))) IN ('stop', 'panding', 'pending')
    AND trim(coalesce(a.fy_status, '')) <> '1'
  )
  OR nullif(trim(coalesce(a.qa_com, '')), '') IS NOT NULL
  OR nullif(trim(coalesce(a.fy_com, '')), '') IS NOT NULL
  OR nullif(trim(coalesce(a.fy_fdb, '')), '') IS NOT NULL
  OR lower(trim(coalesce(a.mng_status, ''))) IN ('changing', 'change')
  OR nullif(trim(coalesce(a.after_qa_changing, '')), '') IS NOT NULL
`;

function taskHistoryRowNeedsChanging(row: {
  currentStatus?: string | null;
  qaComment?: string | null;
  vmComment?: string | null;
  notes?: string | null;
  needsChanging?: boolean;
}): boolean {
  if (row.needsChanging) return true;
  if (row.currentStatus === "Blocked") return true;
  if (String(row.qaComment || "").trim()) return true;
  if (String(row.vmComment || "").trim()) return true;
  if (row.notes) {
    try {
      const parsed = JSON.parse(row.notes);
      if (parsed.qaReturn || parsed.verificationReturn) return true;
    } catch {
      // plain text notes — not a structured return
    }
  }
  return false;
}

function legacyAssignDurationMinutes(
  durText: string | null | undefined,
  durHours: number,
  durMin: number,
): number {
  const t = durText?.trim() || "";
  if (t) {
    const dayM = t.match(/^([0-9]+)d\s+([0-9]+):([0-9]+):([0-9]+)$/);
    if (dayM) {
      const sec =
        Number(dayM[1]) * 86400
        + Number(dayM[2]) * 3600
        + Number(dayM[3]) * 60
        + Number(dayM[4]);
      return Math.round(sec / 60);
    }
    const hms = t.match(/^(-?[0-9]+):(-?[0-9]+):(-?[0-9]+)$/);
    if (hms) {
      return Number(hms[1]) * 60 + Number(hms[2]) + Math.round(Number(hms[3]) / 60);
    }
    const hm = t.match(/^(-?[0-9]+):(-?[0-9]+)$/);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  }
  return durHours * 60 + durMin;
}

function mapLegacyAssignToTaskHistoryRow(r: Record<string, unknown>) {
  const taskId = r.legacy_id as string;
  const currentStatus = r.current_status as string;
  const linkTotal = Number(r.link_total) || 0;
  const linkApproved = Number(r.link_approved) || 0;
  const changedAt = r.changed_at;
  return {
    id: `legacy-history-${taskId}`,
    taskId,
    userId: r.assignee_id,
    fromStatus: "InProgress",
    toStatus: currentStatus,
    changedAt,
    notes: null,
    task: {
      id: taskId,
      title: r.task_title,
      ownerUserId: r.owner_user_id,
      assignedToUserId: r.assignee_user_id,
    },
    user: { id: r.assignee_id, name: r.assignee_name },
    company: r.company_name,
    timeSpentMinutes: legacyAssignDurationMinutes(
      r.dur_text as string | null,
      Number(r.dur_hours) || 0,
      Number(r.dur_min) || 0,
    ),
    currentStatus,
    sentToQaAt: null,
    qaReviewedAt: null,
    verificationReviewedAt: null,
    departmentType: r.department_type,
    linkApprovedQty: linkApproved,
    linkTotalQty: linkTotal,
    linkPendingQty: Math.max(0, linkTotal - linkApproved),
    qaComment: r.qa_comment,
    vmComment: r.vm_comment,
    legacyReadOnly: true,
    needsChanging: Boolean(
      currentStatus === "Blocked"
      || String(r.qa_comment || "").trim()
      || String(r.vm_comment || "").trim(),
    ),
  };
}

async function fetchAdminLegacyTaskHistoryPage(
  page: number,
  pageSize: number,
  changingOnly = false,
  /** row scope (default: every completed old task, the admin view) */
  scopeSql: string = LEGACY_ASSIGN_COMPLETED_SQL,
) {
  const offset = (page - 1) * pageSize;
  const changingClause = changingOnly ? ` AND (${LEGACY_ASSIGN_CHANGING_SQL})` : "";
  const [countRes, dataRes] = await Promise.all([
    pool.query(
      `
      SELECT count(*)::int AS total
      FROM legacy_archive.webxl_task_assign a
      JOIN migration_meta.migration_legacy_ids pm
        ON pm.modern_table = 'projects' AND trim(pm.legacy_id) = trim(a.pro_id)
      JOIN drm.projects p ON p.id = pm.modern_id::uuid
      WHERE ${scopeSql}${changingClause}
      `,
    ),
    pool.query(
      `
      WITH base AS (
        SELECT
          a._legacy_pk,
          a.pro_id,
          a.task_id,
          a.user_id,
          a.qa_com,
          a.fy_com,
          a.fy_fdb,
          a.hours,
          a.min,
          a."totalTimespent",
          a.timespent,
          a.soft_task_name,
          p.id AS project_uuid,
          p.department_type,
          p.owner_user_id,
          p.name AS project_name,
          p.customer_id,
          p.invoice_id,
          COALESCE(
            NULLIF(trim(a.last_update), '')::timestamptz,
            NULLIF(trim(a.assign_date), '')::timestamptz,
            now()
          ) AS changed_at,
          CASE
            WHEN trim(coalesce(a.qa_status, '')) = '1'
              AND lower(trim(coalesce(a.stauts, ''))) IN ('stop', 'panding', 'pending')
              AND trim(coalesce(a.fy_status, '')) <> '1'
            THEN 'Blocked'
            ELSE 'Completed'
          END AS current_status
        FROM legacy_archive.webxl_task_assign a
        JOIN migration_meta.migration_legacy_ids pm
          ON pm.modern_table = 'projects' AND trim(pm.legacy_id) = trim(a.pro_id)
        JOIN drm.projects p ON p.id = pm.modern_id::uuid
        WHERE ${scopeSql}${changingClause}
      ),
      paged AS (
        SELECT * FROM base
        ORDER BY changed_at DESC
        LIMIT $1 OFFSET $2
      ),
      link_stats AS (
        SELECT
          trim(l.pro_id) AS pro_id,
          trim(l.task_id) AS task_id,
          count(*) FILTER (
            WHERE coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
          )::int AS link_total,
          count(*) FILTER (
            WHERE trim(coalesce(l.verify, '')) IN ('1', 'yes', 'Yes', 'verified', 'Verified')
          )::int AS link_approved
        FROM legacy_archive.webxl_task_links l
        INNER JOIN paged pg
          ON trim(l.pro_id) = trim(pg.pro_id)
          AND (
            trim(l.task_id) = trim(pg.task_id)
            OR trim(l.task_id) = trim(pg._legacy_pk)
          )
        GROUP BY trim(l.pro_id), trim(l.task_id)
      )
      SELECT
        ('legacy-assign-' || pg._legacy_pk) AS legacy_id,
        coalesce(nullif(trim(tl.name), ''), nullif(trim(pg.soft_task_name), ''), 'Task ' || coalesce(pg.task_id, pg._legacy_pk)) AS task_title,
        COALESCE(c.company_name, inv.company_name, pg.project_name) AS company_name,
        pg.department_type,
        pg.owner_user_id,
        um.modern_id::uuid AS assignee_user_id,
        coalesce(u.full_name, u.name, u.username, 'Unknown') AS assignee_name,
        coalesce(u.id, um.modern_id::uuid) AS assignee_id,
        nullif(trim(coalesce(pg.qa_com, '')), '') AS qa_comment,
        nullif(trim(coalesce(pg.fy_com, pg.fy_fdb, '')), '') AS vm_comment,
        pg.changed_at,
        pg.current_status,
        nullif(trim(coalesce(pg."totalTimespent", pg.timespent, '')), '') AS dur_text,
        coalesce(nullif(regexp_replace(trim(coalesce(pg.hours, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_hours,
        coalesce(nullif(regexp_replace(trim(coalesce(pg.min, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_min,
        coalesce(ls.link_total, 0) AS link_total,
        coalesce(ls.link_approved, 0) AS link_approved
      FROM paged pg
      LEFT JOIN drm.customers c ON c.id = pg.customer_id
      LEFT JOIN drm.product_posting_invoices inv ON inv.id = pg.invoice_id
      LEFT JOIN legacy_archive.webxl_tasks_list tl
        ON trim(tl._legacy_pk) = trim(pg.task_id) OR trim(tl.id) = trim(pg.task_id)
      LEFT JOIN migration_meta.migration_legacy_ids um
        ON um.legacy_table = 'webxl_user' AND um.legacy_id = trim(pg.user_id)
      LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
      LEFT JOIN link_stats ls
        ON trim(ls.pro_id) = trim(pg.pro_id) AND trim(ls.task_id) = trim(pg.task_id)
      ORDER BY pg.changed_at DESC
      `,
      [pageSize, offset],
    ),
  ]);

  const total = Number(countRes.rows[0]?.total) || 0;
  const items = dataRes.rows.map((row) => mapLegacyAssignToTaskHistoryRow(row));
  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}

export function registerPmsRoutes(app: Express) {
  // Auth is enforced globally in `server/routes.ts` (or via MOCK_AUTH when enabled).
  app.use("/api/pms", authMiddleware);

  const isElevatedRole = (roleId?: string) => isManagerialRole(roleId);

  // PATCH 7 SEC-003: fail-closed ownership/role guards for GENERIC PMS writes.
  // These close broken-access-control gaps (any authenticated user mutating any
  // task / deciding any approval) WITHOUT widening who may change status — the
  // status path stays owner-enforced inside tasksRepository.updateStatus().
  const canManageTask = (task: any, user: any): boolean => {
    if (!task || !user) return false;
    if (isManagerialRole(user.roleId)) return true;
    const uid = user.userId;
    return task.ownerUserId === uid || task.assignedToUserId === uid;
  };
  const canDecideApproval = (approval: any, user: any): boolean => {
    if (!approval || !user) return false;
    if (isManagerialRole(user.roleId)) return true;
    const approverId =
      (approval as any).approverUserId ?? (approval as any).approver_user_id ?? null;
    return Boolean(approverId) && approverId === user.userId;
  };

function getPeriodRange(periodRaw: string) {
  const period = periodRaw?.toUpperCase() || "TD";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = new Date(0);
  let to = new Date();
  
  switch (period) {
    case "TD":
      from = startOfDay;
      break;
    case "WC": {
      const day = startOfDay.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      from = new Date(startOfDay);
      from.setDate(startOfDay.getDate() + diff);
      break;
    }
    case "MN":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "QT": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    }
    case "YR":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { from, to };
}

  // ===== STATS ENDPOINTS =====

  // GET /api/pms/stats - Get overall PMS stats
  app.get("/api/pms/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const elevated = isManagerialRole(req.user.roleId);
      const scopeUserId = elevated ? undefined : req.user.userId;

      const { period } = req.query;
      const { from, to } = period ? getStatsPeriodRange(period as string) : { from: undefined, to: undefined };

      const [projectStats, taskStats] = await Promise.all([
        projectsRepository.getOverallStats(scopeUserId, from, to),
        tasksRepository.getStats(scopeUserId, from, to)
      ]);

      res.json({
        projects: projectStats,
        tasks: taskStats,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // GET /api/pms/stats/project/:id - Get stats for a specific project
  app.get("/api/pms/stats/project/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const taskStats = await tasksRepository.getStatsByProject(req.params.id);
      res.json(taskStats);
    } catch (error) {
      console.error("Error fetching project stats:", error);
      res.status(500).json({ error: "Failed to fetch project stats" });
    }
  });

  // ===== PROJECT ENDPOINTS =====

  // GET /api/pms/projects - List projects with stats
  app.get("/api/pms/projects", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, withStats, period } = req.query;

      const { from, to } = period ? getStatsPeriodRange(period as string) : { from: undefined, to: undefined };

      let scopeUserId: string | string[] | undefined = undefined;
      const elevated = isElevatedRole(req.user.roleId);
      
      const activeRole = (req.user as any).activeRoleId || req.user.roleId || "";
      if (isManagerialRole(activeRole)) {
          const allowedIds = await getDepartmentFilterUserIds(req);
          if (allowedIds === null) {
              // Global admin, do nothing (keep undefined)
          } else if (allowedIds && allowedIds.length > 0) {
              scopeUserId = allowedIds;
          } else {
              scopeUserId = ['00000000-0000-0000-0000-000000000000'];
          }
      } else if (!elevated) {
          scopeUserId = req.user.userId;
      }

      if (withStats === "true") {
        const projectsWithStats = await projectsRepository.findAllWithStats(scopeUserId, from, to);
        return res.json(projectsWithStats);
      }

      const projects = await projectsRepository.findByOwner(
        scopeUserId,
        status as string | undefined,
        from,
        to

      );

      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // GET /api/pms/invoices/pending-project - List approved invoices awaiting project creation
  app.get("/api/pms/invoices/pending-project", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const list = await projectsRepository.findPendingInvoices();
      res.json(list);
    } catch (error) {
      console.error("Error fetching pending invoices:", error);
      res.status(500).json({ error: "Failed to fetch pending invoices" });
    }
  });

  // GET /api/pms/pending-documents - projects awaiting document upload
  app.get("/api/pms/pending-documents", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      
      const elevated = isManagerialRole(req.user.roleId);
      const scopeUserId = elevated ? undefined : req.user.userId;
      
      const userRole = req.user.roleId || (req.user as any).role || '';
      const userRes = await pool.query('SELECT department FROM drm.users WHERE id = $1', [req.user.userId]);
      const userDept = userRes.rows[0]?.department || '';

      const ROLE_DEPT_VARIANTS = ROLE_DEPARTMENT_VARIANTS as Record<string, string[]>;
      const rolePrefix = Object.keys(ROLE_DEPT_VARIANTS).find((p) => userRole.startsWith(p));
      const deptCandidates = departmentCandidatesForRole(userRole, userDept);
      const deptInClause = deptCandidates.length > 0
          ? `(${deptCandidates.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`
          : `('')`; // no candidates -> matches nothing, same as the old empty-string behavior

      let roleFilter = "";
      if (userRole === "sales_executive") {
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole === "sales_manager") {
          // Self-only — never team/org data (explicit product decision).
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole.includes("executive")) {
          // Dynamic check for executive assigned tasks
          roleFilter = `AND p.department_type IN ${deptInClause} AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${req.user.userId}')`;
      } else if (userRole.includes("manager")) {
          // Dynamic check for managers
          roleFilter = `AND p.department_type IN ${deptInClause}`;
      }

      const { rows } = await pool.query(`
        -- Old-DRM projects were all copied as status 'Active'; their real stage is the
        -- latest webxl_project_status row. Only 'Documents Panding' / 'verify Data'
        -- that the department has not verified (mag_verify <> 1) are still pending.
        WITH legacy_ps AS MATERIALIZED (
          SELECT DISTINCT ON (m.modern_id) m.modern_id::uuid AS project_id,
                 btrim(ps.status) AS status, btrim(coalesce(ps.mag_verify, '')) AS mag_verify,
                 btrim(ps.com_id) AS com_id
            FROM migration_meta.migration_legacy_ids m
            LEFT JOIN legacy_archive.webxl_project_status ps
                   ON ps._source_table = 'webxl_project_status' AND btrim(ps.pro_id) = btrim(m.legacy_id)
           WHERE m.modern_table = 'projects'
           ORDER BY m.modern_id, ps._legacy_pk::int DESC NULLS LAST
        ),
        legacy_hod AS MATERIALIZED (
          SELECT DISTINCT ON (btrim(h.com_id)) btrim(h.com_id) AS com_id, btrim(h.hod_status) AS hod_status,
                 btrim(h.acc_status) AS acc_status,
                 CASE WHEN btrim(h.update_date) ~ '^[1-9][0-9]{3}-' THEN btrim(h.update_date)::timestamp END AS update_date,
                 CASE WHEN btrim(h.create_date) ~ '^[1-9][0-9]{3}-' THEN btrim(h.create_date)::timestamp END AS create_date
            FROM legacy_archive.webxl_status_hod h
           WHERE h._source_table = 'webxl_status_hod'
           ORDER BY btrim(h.com_id), h._legacy_pk::int DESC
        )
        SELECT
          p.id,
          COALESCE(
            (
              SELECT mli.legacy_id
              FROM migration_meta.migration_legacy_ids mli
              WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text
              LIMIT 1
            ),
            NULLIF(p.project_number, '')
          ) as "projectNumber",
          COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), i.project_name, p.name) as project,
          COALESCE(
            p.service_type,
            i.service_type,
            (
              SELECT string_agg(item->>'name', ', ')
              FROM jsonb_array_elements(NULLIF(gi.items, '')::jsonb) AS item
            )
          ) as "serviceType",
          COALESCE(c.company_name, i.company_name, gi.customer_name, 'Unknown') as company,
          p.status,
          p.department_type as "departmentType",
          u.full_name as person,
          p.created_at as date,
          COALESCE(fin.total_amount, 0) as "amount",
          COALESCE(
            i.hod_approved_at,
            CASE WHEN i.status IN ('PENDING_ACCOUNT', 'APPROVED', 'PAID') THEN i.updated_at END,
            CASE WHEN gi.status IN ('Paid', 'Overdue') THEN gi.updated_at END,
            CASE WHEN lh.hod_status = '1' THEN COALESCE(lh.update_date, lh.create_date, p.created_at) END
          ) as "hodApprovedAt",
          COALESCE(
            i.accounts_approved_at,
            CASE WHEN i.status IN ('APPROVED', 'PAID') THEN i.updated_at END,
            CASE WHEN gi.status IN ('Paid', 'Overdue') THEN COALESCE(gi.paid_at, gi.updated_at) END,
            CASE WHEN lh.acc_status = '1' THEN COALESCE(lh.update_date, lh.create_date, p.created_at) END
          ) as "accountsApprovedAt",
          lps.status as "legacyStatus",
          -- The department this project was routed to actually approving the
          -- uploaded document — wf.data_verified_at (below) is never written
          -- by any route, so this column was permanently stuck on "Waiting"
          -- regardless of real approval status. Every department's own verify
          -- endpoint (seo-smm/it/project-doc "documents/:id/verify") writes
          -- the same real signal: drm.project_documents.status = 'APPROVED'.
          -- MAX(updated_at) picks up the latest approval, so a reject ->
          -- re-upload -> re-approve cycle still reports correctly (the old
          -- rejected row's approval, if any, is superseded).
          (SELECT max(apd.updated_at) FROM drm.project_documents apd WHERE apd.project_id = p.id AND apd.status = 'APPROVED') as "verifiedAt",
          (SELECT remarks FROM drm.product_posting_rework_history WHERE workflow_id = wf.id AND action = 'DOCUMENT_REJECTED' ORDER BY created_at DESC LIMIT 1) as "rejectionReason",
          (SELECT created_at FROM drm.product_posting_rework_history WHERE workflow_id = wf.id AND action = 'DOCUMENT_REJECTED' ORDER BY created_at DESC LIMIT 1) as "rejectedAt",
          (SELECT id FROM drm.project_documents
           WHERE project_id = p.id AND status = 'PENDING'
             AND created_at > COALESCE(
               (SELECT created_at FROM drm.product_posting_rework_history
                WHERE workflow_id = wf.id AND action = 'DOCUMENT_REJECTED'
                ORDER BY created_at DESC LIMIT 1),
               '1970-01-01'::timestamptz
             )
           ORDER BY created_at DESC LIMIT 1) as "reuploadedDocId",
          -- Previously-submitted project details, so the upload/re-upload form
          -- can pre-fill instead of opening blank. project-doc-routes.ts's
          -- POST /:id/documents does a full-column overwrite of this row (no
          -- COALESCE), so any field left blank on re-submit gets nulled out —
          -- pre-filling here is what keeps a re-upload from silently wiping
          -- data the sales exec already entered on a prior submission.
          pdet.package_name as "detailPackageName",
          pdet.minisite_url as "minisiteUrl",
          pdet.phone as "phone",
          pdet.mobile as "mobile",
          pdet.address as "address",
          pdet.reference as "reference",
          pdet.categories as "categories",
          pdet.detail_notes as "detailNotes"
        FROM drm.projects p
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
        LEFT JOIN drm.invoices gi ON gi.id::text = p.legacy_source_id::text
        LEFT JOIN drm.users u ON u.id = p.owner_user_id
        LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
        LEFT JOIN drm.project_payments pay ON pay.project_id = p.id
        LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
        LEFT JOIN drm.project_details pdet ON pdet.project_id = p.id
        LEFT JOIN legacy_ps lps ON lps.project_id = p.id
        LEFT JOIN legacy_hod lh ON lh.com_id = lps.com_id
        -- OnHold is included: a project only lands there via the Listing-Page-QA
        -- dependency gate, which blocks TASK ASSIGNMENT (see
        -- assertProductPostingDependencySatisfied), not the initial document
        -- upload — /api/projects/:id/documents has no status check at all, so
        -- the sales exec should still be able to upload here while it's held.
        WHERE (p.status = 'Documents Pending' OR p.status = 'Active' OR p.status = 'OnHold')
        AND ($1::uuid IS NULL OR p.owner_user_id = $1::uuid)
        ${roleFilter}
        AND coalesce(p.is_deleted, false) = false
        -- Old-DRM project: still pending only if the old system had it pending, or
        -- someone has uploaded a document for it in the new app since migration.
        AND (
          lps.project_id IS NULL
          OR (lps.status IN ('Documents Panding', 'verify Data') AND lps.mag_verify <> '1')
          OR EXISTS (SELECT 1 FROM drm.project_documents npd WHERE npd.project_id = p.id)
        )
        ORDER BY p.created_at DESC
      `, [scopeUserId]);
      
      // Add sentToManager flag for client display
      const enriched = rows.map(r => ({
        ...r,
        // Old 'verify Data' = documents already uploaded, waiting for the department.
        sentToManager: !!r.reuploadedDocId || (r.legacyStatus === "verify Data" && !r.verifiedAt)
      }));
      res.json(enriched);

    } catch (error) {
      console.error("Error fetching pending documents:", error);
      res.status(500).json({ error: "Failed to fetch pending documents" });
    }
  });

  // GET /api/pms/department-status - List projects with task details for Status/Running pages
  app.get("/api/pms/department-status", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      
      const userRole = resolveRequestUserRole(req);
      const userRes = await pool.query('SELECT department FROM drm.users WHERE id = $1', [req.user.userId]);
      const userDept = userRes.rows[0]?.department || '';
      const deptScope = buildDepartmentTypeScopeSql(userRole, userDept);
      const isProductPostingRole =
        userRole.startsWith("product_posting") || userRole.startsWith("posting_");
      const deptScopeForRole = isProductPostingRole
        ? buildProductPostingProjectScopeSql()
        : deptScope;

      let roleFilter = "";
      if (userRole === "sales_executive") {
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole === "sales_manager") {
          // Self-only — never team/org data (explicit product decision).
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole.includes("executive") && !userRole.startsWith("sales")) {
          roleFilter = `AND (${deptScopeForRole}) AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${req.user.userId}')`;
      } else if (userRole.includes("manager") || userRole.includes("hod") || isManagerialRole(userRole)) {
          if (sqlDepartmentFilterForRole("p.department_type", userRole) === null) {
            roleFilter = "";
          } else {
            roleFilter = `AND (${deptScopeForRole})`;
          }
      }

      // Optional query filters wired from the client (Department / City / Status / Date range).
      // These map to real columns already joined into this query:
      //  - department -> u.department (project owner's department)
      //  - city       -> c.city (customer's city)
      //  - status     -> p.status (Active / OnHold / Completed)
      //  - startDate / endDate -> p.created_at range
      const { department, city, status, startDate, endDate } = req.query as Record<string, string | undefined>;
      const params: any[] = [];
      let extraFilter = "";

      if (department && department.trim() && department.toLowerCase() !== "all") {
        const deptStr = department.trim().toLowerCase();
        let mappedDepts: string[] = [department.trim()];
        if (deptStr === "seo/smm") mappedDepts = ["SEO_SMM", "SEO/SMM", "8"];
        else if (deptStr === "development" || deptStr === "software") mappedDepts = ["SOFTWARE", "11", "Development"];
        else if (deptStr === "design") mappedDepts = ["DESIGN", "10", "Design"];
        else if (deptStr === "product posting") mappedDepts = ["PRODUCT_POSTING", "9", "Product Posting"];
        else if (deptStr === "d&d" || deptStr === "dnd") mappedDepts = ["DND", "DESIGN_DEVELOPMENT", "10", "D&D"];
        else if (deptStr === "it") mappedDepts = ["IT", "13"];

        const deptIn = mappedDepts.map(d => `'${d.replace(/'/g, "''")}'`).join(", ");
        extraFilter += ` AND p.department_type IN (${deptIn})`;
      }
      if (city && city.trim() && city.toLowerCase() !== "all") {
        params.push(`%${city.trim()}%`);
        extraFilter += ` AND c.city ILIKE $${params.length}`;
      }
      if (status && status.trim() && status.toLowerCase() !== "all") {
        params.push(status.trim());
        extraFilter += ` AND p.status = $${params.length}`;
      }
      if (startDate && startDate.trim()) {
        params.push(startDate.trim());
        extraFilter += ` AND p.created_at >= $${params.length}::date`;
      }
      if (endDate && endDate.trim()) {
        params.push(endDate.trim());
        extraFilter += ` AND p.created_at < ($${params.length}::date + interval '1 day')`;
      }
      // Opt-in, sales_executive-only: this endpoint is shared with pms-status.tsx
      // (needs every status incl. Completed/OnHold), pms-tasks.tsx (needs every
      // owned project to manage tasks), and pms-setting.tsx — so this can't live
      // in the general sales_executive roleFilter above without breaking those.
      const onlyActiveWork = String(req.query.onlyActiveWork).toLowerCase() === "true";

      const { rows } = await pool.query(`
        -- Scope first (role + query filters), then aggregate old-DRM rows only for
        -- the projects in scope: aggregating webxl_task_links (~890k rows) for all
        -- 12k projects is what made the Running Projects page time out.
        WITH scoped AS MATERIALIZED (
          SELECT p.id
          FROM drm.projects p
          LEFT JOIN drm.customers c ON p.customer_id = c.id
          WHERE coalesce(p.is_deleted, false) = false
          ${roleFilter}
          ${extraFilter}
        ),
        legacy_pro_map AS MATERIALIZED (
          SELECT mli.modern_id::uuid AS project_id, trim(mli.legacy_id) AS pro_id
          FROM migration_meta.migration_legacy_ids mli
          JOIN scoped s ON s.id::text = mli.modern_id
          WHERE mli.modern_table = 'projects'
        ),
        legacy_doc_projects AS (
          SELECT DISTINCT m.project_id
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_project_img img ON trim(img.pid) = m.pro_id
          WHERE coalesce(nullif(trim(img.images), ''), nullif(trim(img.upl_number), '')) IS NOT NULL
          UNION
          SELECT DISTINCT m.project_id
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_project_status ps ON trim(ps.pro_id) = m.pro_id
          WHERE nullif(trim(ps.upload_doc), '') IS NOT NULL
        ),
        legacy_dep_projects AS (
          SELECT DISTINCT m.project_id
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_project_status ps ON trim(ps.pro_id) = m.pro_id
          WHERE trim(coalesce(ps.mag_verify, '')) IN ('1', 'yes', 'Yes', 'YES')
        ),
        legacy_link_agg AS (
          SELECT m.project_id, COUNT(*)::int AS legacy_link_count
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_task_links l ON trim(l.pro_id) = m.pro_id
          WHERE coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
          GROUP BY m.project_id
        ),
        legacy_time_agg AS (
          SELECT m.project_id,
            SUM(
              CASE
                WHEN dur ~ '^[0-9]+d [0-9]+:[0-9]+:[0-9]+$' THEN
                  (COALESCE(NULLIF(substring(dur from '^([0-9]+)d'), '')::int, 0) * 86400)
                  + (split_part(regexp_replace(dur, '^[0-9]+d ', ''), ':', 1)::int * 3600)
                  + (split_part(regexp_replace(dur, '^[0-9]+d ', ''), ':', 2)::int * 60)
                  + split_part(regexp_replace(dur, '^[0-9]+d ', ''), ':', 3)::int
                WHEN dur ~ '^-?[0-9]+:-?[0-9]+:-?[0-9]+$' THEN
                  (split_part(dur, ':', 1)::int * 3600)
                  + (split_part(dur, ':', 2)::int * 60)
                  + split_part(dur, ':', 3)::int
                WHEN dur ~ '^-?[0-9]+:-?[0-9]+$' THEN
                  (split_part(dur, ':', 1)::int * 3600)
                  + (split_part(dur, ':', 2)::int * 60)
                ELSE
                  COALESCE(nullif(regexp_replace(trim(coalesce(a.hours, '')), '[^0-9]', '', 'g'), '')::int, 0) * 3600
                  + COALESCE(nullif(regexp_replace(trim(coalesce(a.min, '')), '[^0-9]', '', 'g'), '')::int, 0) * 60
              END
            )::bigint AS legacy_time_seconds,
            count(*)::int AS legacy_task_count
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_task_assign a ON trim(a.pro_id) = m.pro_id
          CROSS JOIN LATERAL (
            SELECT nullif(trim(coalesce(a."totalTimespent", a.timespent, '')), '') AS dur
          ) d
          GROUP BY m.project_id
        ),
        legacy_stage_agg AS (
          SELECT m.project_id,
            CASE
              WHEN count(*) FILTER (WHERE (${LEGACY_ASSIGN_OPEN_SQL})) = 0 THEN 'Closed'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL})
                AND (
                  lower(trim(coalesce(a.stauts, ''))) IN ('progress', 'start', 'run', 'running', 'active', 'todo')
                  OR (
                    trim(coalesce(a.mng_status, '')) NOT IN ('1', 'yes')
                    AND trim(coalesce(a.qa_status, '')) NOT IN ('1', 'yes')
                  )
                )
              ) THEN 'Executive'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL})
                AND trim(coalesce(a.mng_status, '')) IN ('1', 'yes')
              ) THEN 'Manager'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL}) AND trim(coalesce(a.qa_status, '')) IN ('1', 'yes')
              ) THEN 'QA'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL}) AND trim(coalesce(a.fy_status, '')) = '1'
              ) THEN 'VM'
              ELSE 'Executive'
            END AS workflow_stage
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_task_assign a ON trim(a.pro_id) = m.pro_id
          GROUP BY m.project_id
        ),
        modern_stage_agg AS (
          SELECT
            t.project_id,
            CASE
              WHEN count(*) = 0 THEN NULL
              WHEN count(*) FILTER (
                WHERE t.status IN ('ToDo', 'InProgress', 'Blocked', 'IN_EXECUTION')
              ) > 0 THEN 'Executive'
              WHEN count(*) FILTER (WHERE t.status = 'READY_FOR_QA') > 0 THEN 'Manager'
              WHEN count(*) FILTER (
                WHERE t.status = 'Completed'
                  AND t.qa_reviewed_at IS NULL
              ) > 0
                AND count(*) FILTER (WHERE t.status <> 'Completed') = 0
              THEN 'QA'
              WHEN count(*) FILTER (
                WHERE t.status = 'Completed'
                  AND t.qa_reviewed_at IS NOT NULL
                  AND t.verification_reviewed_at IS NULL
              ) > 0
                AND count(*) FILTER (WHERE t.status <> 'Completed') = 0
              THEN 'VM'
              WHEN count(*) FILTER (WHERE t.status <> 'Completed') = 0 THEN 'Closed'
              ELSE 'Executive'
            END AS workflow_stage
          FROM drm.tasks t
          WHERE coalesce(t.is_deleted, false) = false
          GROUP BY t.project_id
        )
        SELECT
          p.id,
          COALESCE(i.company_name, c.company_name, 'Unknown') as "company",
          COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), i.project_name, p.name) as "project",
          p.status,
          p.department_type as "departmentType",
          (i.id IS NOT NULL) as "hasProductPostingInvoice",
          u.name as "assign",
          u.department as "department",
          c.city as "city",
          p.created_at as "date",
          COALESCE(fin.total_amount, 0) as "amount",
          i.status as "invoiceStatus",
          (
            (SELECT COUNT(*) FROM drm.tasks t WHERE t.project_id = p.id) +
            -- Pre-aggregated once in legacy_time_agg: the old per-row subquery
            -- seq-scanned webxl_task_assign (no index on trim(pro_id)) for every
            -- project and made this endpoint take ~97 s.
            COALESCE(lta.legacy_task_count, 0)
          ) as "totalTasks",
          (
            EXISTS (SELECT 1 FROM drm.project_documents pd WHERE pd.project_id = p.id)
            OR ldoc.project_id IS NOT NULL
          ) as "docUploaded",
          (
            EXISTS (SELECT 1 FROM drm.project_documents pd WHERE pd.project_id = p.id AND pd.status = 'APPROVED')
            OR ldep.project_id IS NOT NULL
          ) as "depApproved",
          (SELECT SUM(duration_minutes) FROM drm.task_time_logs tl JOIN drm.tasks t ON tl.task_id = t.id WHERE t.project_id = p.id) as "totalTime",
          (SELECT COALESCE(json_agg(DISTINCT link), '[]'::json)
           FROM (
             SELECT jsonb_build_object('url', el.url, 'label', el.label) as link
             FROM drm.product_posting_evidence_links el WHERE el.project_id = p.id
             UNION
             SELECT jsonb_build_object('url', link_elem, 'label', null) as link
             FROM drm.task_status_history tsh
             JOIN drm.tasks t2 ON t2.id = tsh.task_id
             CROSS JOIN LATERAL jsonb_array_elements_text(
               CASE WHEN tsh.notes LIKE '{%' THEN COALESCE((tsh.notes::jsonb)->'links', '[]'::jsonb) ELSE '[]'::jsonb END
             ) as link_elem
             WHERE t2.project_id = p.id
           ) all_links) as "links",
          COALESCE(lla.legacy_link_count, 0) as "legacyLinkCount",
          COALESCE(lta.legacy_time_seconds, 0) as "legacyTimeSeconds",
          lsa.workflow_stage as "legacyWorkflowStage",
          msa.workflow_stage as "modernWorkflowStage"
        FROM drm.projects p
        LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
        LEFT JOIN drm.customers c ON p.customer_id = c.id
        LEFT JOIN drm.users u ON p.owner_user_id = u.id
        LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
        LEFT JOIN legacy_doc_projects ldoc ON ldoc.project_id = p.id
        LEFT JOIN legacy_dep_projects ldep ON ldep.project_id = p.id
        LEFT JOIN legacy_link_agg lla ON lla.project_id = p.id
        LEFT JOIN legacy_time_agg lta ON lta.project_id = p.id
        LEFT JOIN legacy_stage_agg lsa ON lsa.project_id = p.id
        LEFT JOIN modern_stage_agg msa ON msa.project_id = p.id
        WHERE p.id IN (SELECT id FROM scoped)
        ORDER BY p.updated_at DESC
      `, params);

      let mapped = rows.map((row) => {
        const modernMinutes = Number(row.totalTime) || 0;
        const legacySeconds = Number(row.legacyTimeSeconds) || 0;
        const totalSeconds = legacySeconds + modernMinutes * 60;
        const timeHours = Math.floor(totalSeconds / 3600);
        const timeMinutes = Math.floor((totalSeconds % 3600) / 60);
        const modernLinkCount = Array.isArray(row.links) ? row.links.length : 0;
        const workflowStage = mergeProjectWorkflowStage(
          row.legacyWorkflowStage as string | null | undefined,
          row.modernWorkflowStage as string | null | undefined,
          row.status as string | null | undefined,
        );
        const isProductPosting =
          departmentTypeMatchesFamily(row.departmentType as string, "product_posting")
          || Boolean(row.hasProductPostingInvoice);
        const linkCount = isProductPosting
          ? (Number(row.legacyLinkCount) || 0) + modernLinkCount
          : null;
        return {
          ...row,
          time: totalSeconds > 0 ? `${timeHours}:${timeMinutes}` : "0:0",
          linkCount,
          isProductPosting,
          workflowStage,
          date: row.date
            ? new Date(row.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "-",
        };
      });

      if (onlyActiveWork) {
        mapped = mapped.filter(
          (row) =>
            row.workflowStage !== "Closed"
            && String(row.status || "") !== "Completed",
        );
      }

      res.json(mapped);
    } catch (error) {
      console.error("Error fetching department status:", error);
      res.status(500).json({ error: "Failed to fetch department status" });
    }
  });

  // GET /api/pms/overall-projects — manager read-only activity list (legacy-style).
  app.get("/api/pms/overall-projects", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      const userRole = resolveRequestUserRole(req);
      if (!canViewPmsOverallProjects(userRole)) {
        return res.status(403).json({ error: "Only department managers can view overall projects" });
      }

      const userRes = await pool.query("SELECT department FROM drm.users WHERE id = $1", [req.user.userId]);
      const userDept = userRes.rows[0]?.department || "";
      const deptScope = buildDepartmentTypeScopeSql(userRole, userDept);
      const isProductPostingRole =
        userRole.startsWith("product_posting") || userRole.startsWith("posting_");
      const deptScopeForRole = isProductPostingRole
        ? buildProductPostingProjectScopeSql()
        : deptScope;

      const legacyDepIds = legacyDepIdsForRole(userRole);
      let roleFilter = "";
      if (sqlDepartmentFilterForRole("p.department_type", userRole) === null) {
        roleFilter = "";
      } else if (legacyDepIds && legacyDepIds.length > 0) {
        const depIn = legacyDepIds.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ");
        roleFilter = `AND (
          (${deptScopeForRole})
          OR EXISTS (
            SELECT 1
              FROM migration_meta.migration_legacy_ids mli
              JOIN legacy_archive.webxl_create_project cp
                ON trim(cp.pro_id) = trim(mli.legacy_id)
              JOIN legacy_archive.webxl_quotation_services qs
                ON qs.dep_id IN (${depIn})
               AND lower(regexp_replace(trim(qs.name), '\\s+', ' ', 'g'))
                 = lower(regexp_replace(trim(cp.project), '\\s+', ' ', 'g'))
             WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text
          )
        )`;
      } else {
        roleFilter = `AND (${deptScopeForRole})`;
      }

      const { rows } = await pool.query(`
        WITH legacy_pro_map AS (
          SELECT mli.modern_id::uuid AS project_id, trim(mli.legacy_id) AS pro_id
          FROM migration_meta.migration_legacy_ids mli
          WHERE mli.modern_table = 'projects'
        ),
        legacy_status_agg AS (
          SELECT m.project_id,
            max(nullif(trim(ps.upload_doc), '')) AS legacy_upload_doc,
            max(nullif(trim(ps.vfy_date), '')) AS legacy_dep_approved
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_project_status ps ON trim(ps.pro_id) = m.pro_id
          GROUP BY m.project_id
        ),
        legacy_stage_agg AS (
          SELECT m.project_id,
            CASE
              WHEN count(*) FILTER (WHERE (${LEGACY_ASSIGN_OPEN_SQL})) = 0 THEN 'Closed'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL})
                AND (
                  lower(trim(coalesce(a.stauts, ''))) IN ('progress', 'start', 'run', 'running', 'active', 'todo')
                  OR (
                    trim(coalesce(a.mng_status, '')) NOT IN ('1', 'yes')
                    AND trim(coalesce(a.qa_status, '')) NOT IN ('1', 'yes')
                  )
                )
              ) THEN 'Executive'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL})
                AND trim(coalesce(a.mng_status, '')) IN ('1', 'yes')
              ) THEN 'Manager'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL}) AND trim(coalesce(a.qa_status, '')) IN ('1', 'yes')
              ) THEN 'QA'
              WHEN BOOL_OR(
                (${LEGACY_ASSIGN_OPEN_SQL}) AND trim(coalesce(a.fy_status, '')) = '1'
              ) THEN 'VM'
              ELSE 'Executive'
            END AS workflow_stage
          FROM legacy_pro_map m
          JOIN legacy_archive.webxl_task_assign a ON trim(a.pro_id) = m.pro_id
          GROUP BY m.project_id
        ),
        modern_stage_agg AS (
          SELECT
            t.project_id,
            CASE
              WHEN count(*) = 0 THEN NULL
              WHEN count(*) FILTER (
                WHERE t.status IN ('ToDo', 'InProgress', 'Blocked', 'IN_EXECUTION')
              ) > 0 THEN 'Executive'
              WHEN count(*) FILTER (WHERE t.status = 'READY_FOR_QA') > 0 THEN 'Manager'
              WHEN count(*) FILTER (
                WHERE t.status = 'Completed' AND t.qa_reviewed_at IS NULL
              ) > 0
                AND count(*) FILTER (WHERE t.status <> 'Completed') = 0
              THEN 'QA'
              WHEN count(*) FILTER (
                WHERE t.status = 'Completed'
                  AND t.qa_reviewed_at IS NOT NULL
                  AND t.verification_reviewed_at IS NULL
              ) > 0
                AND count(*) FILTER (WHERE t.status <> 'Completed') = 0
              THEN 'VM'
              WHEN count(*) FILTER (WHERE t.status <> 'Completed') = 0 THEN 'Closed'
              ELSE 'Executive'
            END AS workflow_stage
          FROM drm.tasks t
          WHERE coalesce(t.is_deleted, false) = false
          GROUP BY t.project_id
        )
        SELECT
          p.id,
          coalesce(lp.pro_id, substr(p.id::text, 1, 8)) as "projectNo",
          COALESCE(i.company_name, c.company_name, 'Unknown') as "company",
          coalesce(
            u.name,
            (
              SELECT wu.name
                FROM migration_meta.migration_legacy_ids mli
                JOIN legacy_archive.webxl_create_project cp ON trim(cp.pro_id) = trim(mli.legacy_id)
                JOIN legacy_archive.webxl_user wu ON trim(wu.user_id) = trim(cp.user_id)
               WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text
               LIMIT 1
            )
          ) as "person",
          COALESCE(
            NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''),
            i.project_name,
            p.name
          ) as "project",
          p.status,
          p.department_type as "departmentType",
          p.updated_at as "sortDate",
          (SELECT max(pd.created_at) FROM drm.project_documents pd WHERE pd.project_id = p.id) as "modernDocUploadAt",
          (SELECT max(pd.updated_at) FROM drm.project_documents pd
            WHERE pd.project_id = p.id AND pd.status = 'APPROVED') as "modernDepApprovedAt",
          lsa.legacy_upload_doc,
          lsa.legacy_dep_approved,
          lsa2.workflow_stage as "legacyWorkflowStage",
          msa.workflow_stage as "modernWorkflowStage",
          EXISTS (SELECT 1 FROM drm.project_documents pd WHERE pd.project_id = p.id) as "docUploaded",
          EXISTS (SELECT 1 FROM drm.project_documents pd
            WHERE pd.project_id = p.id AND pd.status = 'APPROVED') as "depApproved"
        FROM drm.projects p
        LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
        LEFT JOIN drm.customers c ON p.customer_id = c.id
        LEFT JOIN drm.users u ON p.owner_user_id = u.id
        LEFT JOIN legacy_pro_map lp ON lp.project_id = p.id
        LEFT JOIN legacy_status_agg lsa ON lsa.project_id = p.id
        LEFT JOIN legacy_stage_agg lsa2 ON lsa2.project_id = p.id
        LEFT JOIN modern_stage_agg msa ON msa.project_id = p.id
        WHERE coalesce(p.is_deleted, false) = false
        ${roleFilter}
        ORDER BY p.updated_at DESC
      `);

      const formatTs = (v: unknown): string => {
        if (!v) return "—";
        const s = String(v).trim();
        if (!s) return "—";
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          });
        }
        return s;
      };

      const mapped = rows.map((row) => {
        const workflowStage = mergeProjectWorkflowStage(
          row.legacyWorkflowStage as string | null,
          row.modernWorkflowStage as string | null,
          row.status as string | null,
        );
        const workOpen =
          workflowStage !== "Closed" && String(row.status || "") !== "Completed";
        const activityStatus = workOpen ? "Start Work" : "Closed";
        const docUploadAt =
          row.modernDocUploadAt || row.legacy_upload_doc || null;
        const depApprovedAt =
          row.modernDepApprovedAt || row.legacy_dep_approved || null;
        return {
          id: row.id,
          projectNo: row.projectNo,
          company: row.company,
          person: row.person || "—",
          project: row.project,
          activityStatus,
          workflowStage,
          docUpload: formatTs(docUploadAt),
          depApproved: formatTs(depApprovedAt),
          docUploaded: Boolean(row.docUploaded) || Boolean(row.legacy_upload_doc),
          depApprovedFlag:
            Boolean(row.depApproved) || Boolean(row.legacy_dep_approved),
          sortDate: row.sortDate,
          isActive: workOpen,
        };
      });

      mapped.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return new Date(String(b.sortDate)).getTime() - new Date(String(a.sortDate)).getTime();
      });

      res.json(mapped);
    } catch (error) {
      console.error("Error fetching overall projects:", error);
      res.status(500).json({ error: "Failed to fetch overall projects" });
    }
  });

  // GET /api/pms/tasks/pending-review — the department manager's "Pending My
  // Review" queue: tasks an executive has submitted (READY_FOR_QA) waiting on
  // that manager to Approve (-> Completed) or Reject (-> Blocked).
  // QA / Verification are managerial roles but must NOT see this queue —
  // sequence is Manager approve → Manager Send to QA → QA → VM. Their work
  // lands in /api/product-posting/qa/queue and /verification/queue instead.
  app.get("/api/pms/tasks/pending-review", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      const userRole = String(req.user.roleId || (req.user as any).role || "").toLowerCase();
      if (!isManagerialRole(userRole)) return res.json([]);
      if (
        userRole === "qa_manager" ||
        userRole.startsWith("qa_") ||
        userRole.includes("verification")
      ) {
        return res.json([]);
      }

      const userRes = await pool.query("SELECT department FROM drm.users WHERE id = $1", [req.user.userId]);
      const userDept = userRes.rows[0]?.department || "";

      const deptCandidates = departmentCandidatesForRole(userRole, userDept);

      // admin/super_hod aren't tied to any one department — they see every
      // department's queue, matching /api/pms/department-status's own
      // "no roleFilter branch matches -> no filter" behavior for those roles.
      const isDeptBoundManager = deptCandidates.length > 0 && !["admin", "super_admin", "super_hod"].includes(userRole);
      const deptFilter = isDeptBoundManager
        ? `AND p.department_type IN (${deptCandidates.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`
        : "";

      const { rows } = await pool.query(`
        SELECT
          t.id,
          t.title,
          t.description,
          t.project_id as "projectId",
          t.assigned_to_user_id as "assigneeId",
          au.name as "assigneeName",
          COALESCE(NULLIF(p.name, ''), 'Unknown') as "project",
          COALESCE(c.company_name, i.company_name, 'Unknown') as "company",
          p.department_type as "departmentType",
          t.updated_at as "submittedAt",
          (SELECT notes FROM drm.task_status_history
             WHERE task_id = t.id AND to_status = 'READY_FOR_QA'
             ORDER BY changed_at DESC LIMIT 1) as "submissionNotes"
        FROM drm.tasks t
        JOIN drm.projects p ON p.id = t.project_id
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
        LEFT JOIN drm.users au ON au.id = t.assigned_to_user_id
        WHERE t.status = 'READY_FOR_QA' AND COALESCE(t.is_deleted, false) = false
        ${deptFilter}
        ORDER BY t.updated_at DESC
      `);

      // Old DRM: tasks the executive ended / submitted to the manager (stauts 'End') that the manager
      // has not reviewed or sent to QA (mng_status '', '0', '1') and that QA / VM have not closed
      // (qa_status, fy_status <> '1'). No date window (decision 2026-11-23). Read-only here: they are
      // approved in the old DRM and come over with the next Old Data Import.
      const { rows: legacyRows } = await pool.query(`
        SELECT
          'legacy-assign-' || a._legacy_pk AS id,
          coalesce(nullif(trim(tl.name), ''), nullif(trim(a.soft_task_name), ''), 'Task ' || coalesce(a.task_id, a._legacy_pk)) AS title,
          NULL::text AS description,
          p.id AS "projectId",
          um.modern_id AS "assigneeId",
          coalesce(u.full_name, u.name, 'Unknown') AS "assigneeName",
          COALESCE(NULLIF(p.name, ''), 'Unknown') AS project,
          COALESCE(c.company_name, i.company_name, 'Unknown') AS company,
          p.department_type AS "departmentType",
          coalesce(migration_meta.mig_ts(a.last_update), migration_meta.mig_ts(a.assign_date)) AS "submittedAt",
          NULL::text AS "submissionNotes",
          true AS "legacyReadOnly"
        FROM (
          SELECT * FROM legacy_archive.webxl_task_assign
           WHERE _source_table = 'webxl_task_assign'
             AND lower(trim(coalesce(stauts, ''))) = 'end'
             AND coalesce(trim(mng_status), '') IN ('', '0', '1')
        ) a
        JOIN migration_meta.migration_legacy_ids pm
          ON pm.entity_type = 'create_project_row' AND pm.legacy_table = 'webxl_create_project'
         AND pm.legacy_id = a.pro_id AND pm.modern_table = 'projects'
        JOIN drm.projects p ON p.id = pm.modern_id::uuid
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
        LEFT JOIN legacy_archive.webxl_tasks_list tl
          ON tl._source_table = 'webxl_tasks_list' AND tl._legacy_pk = trim(a.task_id)
        LEFT JOIN migration_meta.migration_legacy_ids um
          ON um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = trim(a.user_id)
        LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
        WHERE trim(coalesce(a.qa_status, '')) <> '1'
          AND trim(coalesce(a.fy_status, '')) <> '1'
          AND coalesce(p.is_deleted, false) = false
          AND NOT EXISTS (SELECT 1 FROM drm.legacy_task_reviews rv WHERE rv.legacy_assign_id = a._legacy_pk)
          ${deptFilter}
        ORDER BY "submittedAt" DESC NULLS LAST
      `);

      res.json([...rows, ...legacyRows]);
    } catch (error) {
      console.error("Error fetching pending review tasks:", error);
      res.status(500).json({ error: "Failed to fetch pending review tasks" });
    }
  });

  // Old-DRM tasks in Pending My Review ("legacy-assign-<webxl_task_assign id>"): the links the
  // executive submitted, and the manager's approval. The archive stays read-only — the approval is
  // stored in drm.legacy_task_reviews (scripts/migration/create-legacy-task-reviews.sql).
  const legacyAssignPk = (raw: string) => {
    const m = /^legacy-assign-(\d+)$/.exec(String(raw || ""));
    return m ? m[1] : null;
  };

  app.get("/api/pms/legacy-tasks/:id/files", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const pk = legacyAssignPk(req.params.id);
      if (!pk) return res.status(400).json({ error: "Invalid old task id" });
      const { rows } = await pool.query(
        `SELECT 'legacy-link-' || l._legacy_pk AS id, NULL::text AS "fileUrl", NULL::text AS "fileName",
                coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) AS description,
                migration_meta.mig_ts(l.create_at) AS "createdAt",
                coalesce(u.full_name, u.name) AS "uploadedByName"
           FROM legacy_archive.webxl_task_assign a
           JOIN legacy_archive.webxl_task_links l
             ON l._source_table = 'webxl_task_links' AND trim(l.pro_id) = trim(a.pro_id)
            AND (trim(l.task_id) = trim(a.task_id) OR trim(l.task_id) = a._legacy_pk)
           LEFT JOIN migration_meta.migration_legacy_ids um
             ON um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = trim(l.user_id)
           LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
          WHERE a._source_table = 'webxl_task_assign' AND a._legacy_pk = $1
            AND coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
          ORDER BY l._legacy_pk::bigint`,
        [pk],
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error("Error fetching old task links:", error);
      res.status(500).json({ error: "Failed to fetch old task links" });
    }
  });

  // POST /api/pms/legacy-tasks/:id/open — move an old task the manager is about to approve /
  // reject into the new flow: a drm.tasks row in READY_FOR_QA (assignee = old executive, owner =
  // this manager, old links in task_files, old time in task_time_logs). The client then runs the
  // normal approve / reject (PATCH /api/pms/task/:id/status) on the returned taskId, so Send to QA,
  // QA, VM and close work exactly as for a new task. Idempotent: an old task is moved only once.
  app.post("/api/pms/legacy-tasks/:id/open", async (req, res) => {
    const client = await pool.connect();
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userRole = String(req.user.roleId || (req.user as any).role || "").toLowerCase();
      // Same audience as Pending My Review: department managers, not QA / Verification.
      if (!isManagerialRole(userRole) || userRole === "qa_manager" || userRole.startsWith("qa_") || userRole.includes("verification")) {
        return res.status(403).json({ error: "Only the department manager can review this task." });
      }
      const pk = legacyAssignPk(req.params.id);
      if (!pk) return res.status(400).json({ error: "Invalid old task id" });
      const managerId = req.user.userId;

      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT task_id FROM drm.legacy_task_reviews WHERE legacy_assign_id = $1 FOR UPDATE`, [pk]);
      if (existing.rows[0]?.task_id) {
        await client.query("COMMIT");
        return res.json({ taskId: existing.rows[0].task_id, alreadyMoved: true });
      }
      const { rows } = await client.query(
        `SELECT p.id AS project_id, p.department_type, a.pro_id, a.task_id, a._legacy_pk,
                coalesce(nullif(trim(tl.name), ''), nullif(trim(a.soft_task_name), ''), 'Task ' || coalesce(a.task_id, a._legacy_pk)) AS title,
                nullif(trim(tl.detail), '') AS detail,
                um.modern_id::uuid AS exec_id,
                migration_meta.mig_ts(a.assign_date) AS assigned_at,
                coalesce(migration_meta.mig_ts(a.last_update), migration_meta.mig_ts(a.assign_date)) AS ended_at,
                nullif(trim(coalesce(a."totalTimespent", a.timespent, '')), '') AS dur_text,
                coalesce(nullif(regexp_replace(trim(coalesce(a.hours, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_hours,
                coalesce(nullif(regexp_replace(trim(coalesce(a.min, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_min
           FROM legacy_archive.webxl_task_assign a
           JOIN migration_meta.migration_legacy_ids pm
             ON pm.entity_type = 'create_project_row' AND pm.legacy_table = 'webxl_create_project'
            AND pm.legacy_id = a.pro_id AND pm.modern_table = 'projects'
           JOIN drm.projects p ON p.id = pm.modern_id::uuid
           LEFT JOIN legacy_archive.webxl_tasks_list tl
             ON tl._source_table = 'webxl_tasks_list' AND tl._legacy_pk = trim(a.task_id)
           LEFT JOIN migration_meta.migration_legacy_ids um
             ON um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = trim(a.user_id)
          WHERE a._source_table = 'webxl_task_assign' AND a._legacy_pk = $1
            AND lower(trim(coalesce(a.stauts, ''))) = 'end'
            AND coalesce(trim(a.mng_status), '') IN ('', '0', '1')
            AND trim(coalesce(a.qa_status, '')) <> '1' AND trim(coalesce(a.fy_status, '')) <> '1'`,
        [pk],
      );
      const t = rows[0];
      if (!t) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "This old task is not waiting for manager review." });
      }
      const userRes = await client.query("SELECT department FROM drm.users WHERE id = $1", [managerId]);
      const deptCandidates = departmentCandidatesForRole(userRole, userRes.rows[0]?.department || "");
      const isDeptBound = deptCandidates.length > 0 && !["admin", "super_admin", "super_hod"].includes(userRole);
      if (isDeptBound && !deptCandidates.includes(t.department_type)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "This task belongs to another department." });
      }
      const execId: string | null = t.exec_id
        ? ((await client.query("SELECT id FROM drm.users WHERE id = $1", [t.exec_id])).rows[0]?.id ?? null)
        : null;
      const actorId = execId ?? managerId;
      const links = (await client.query(
        `SELECT coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) AS link,
                coalesce(migration_meta.mig_ts(l.create_at), now()::timestamp) AS created_at
           FROM legacy_archive.webxl_task_links l
          WHERE l._source_table = 'webxl_task_links' AND trim(l.pro_id) = trim($1)
            AND (trim(l.task_id) = trim($2) OR trim(l.task_id) = $3)
            AND coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
          ORDER BY l._legacy_pk::bigint`,
        [t.pro_id, t.task_id ?? "", pk],
      )).rows;

      const task = (await client.query(
        `INSERT INTO drm.tasks (project_id, title, description, owner_user_id, assigned_to_user_id, status,
                               start_date, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'READY_FOR_QA', $6, $7, coalesce($6, now()), now())
         RETURNING id`,
        [t.project_id, t.title, t.detail, managerId, execId, t.assigned_at, `Old DRM task #${pk}`],
      )).rows[0];
      await client.query(
        `INSERT INTO drm.task_status_history (task_id, user_id, from_status, to_status, changed_at, notes)
         VALUES ($1, $2, 'InProgress', 'READY_FOR_QA', coalesce($3, now()), $4)`,
        [task.id, actorId, t.ended_at, JSON.stringify({ links: links.map((l: any) => l.link), legacyAssignId: pk })],
      );
      for (const l of links) {
        await client.query(
          `INSERT INTO drm.task_files (task_id, uploaded_by_user_id, description, created_at) VALUES ($1, $2, $3, $4)`,
          [task.id, actorId, l.link, l.created_at],
        );
      }
      const minutes = legacyAssignDurationMinutes(t.dur_text, Number(t.dur_hours) || 0, Number(t.dur_min) || 0);
      if (minutes > 0) {
        await client.query(
          `INSERT INTO drm.task_time_logs (task_id, user_id, duration_minutes, notes, start_at)
           VALUES ($1, $2, $3, 'Old DRM time', coalesce($4, now()))`,
          [task.id, actorId, minutes, t.assigned_at],
        );
      }
      await client.query(
        `INSERT INTO drm.legacy_task_reviews (legacy_assign_id, project_id, status, reviewed_by, task_id)
         VALUES ($1, $2, 'moved', $3, $4)
         ON CONFLICT (legacy_assign_id) DO UPDATE SET task_id = EXCLUDED.task_id, status = 'moved'`,
        [pk, t.project_id, managerId, task.id],
      );
      await client.query("COMMIT");
      res.json({ taskId: task.id });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Error moving old task into the new flow:", error);
      res.status(500).json({ error: "Failed to open old task" });
    } finally {
      client.release();
    }
  });

  // POST /api/pms/tasks/:id/send-to-qa — a manager's explicit hand-off from
  // "Completed Projects", a deliberately separate action from Approve
  // (which just moves the task to Completed). Only legal once the task is
  // actually Completed; idempotent — sending twice just returns the
  // original timestamp instead of erroring or double-notifying.
  app.post("/api/pms/tasks/:id/send-to-qa", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userRole = String(req.user.roleId || (req.user as any).role || "").toLowerCase();
      if (!isManagerialRole(userRole)) {
        return res.status(403).json({ error: "Only a manager can send a task to QA." });
      }
      // QA / Verification receive work AFTER the department manager's Send to QA —
      // they must not perform that hand-off themselves.
      if (userRole === "qa_manager" || userRole.startsWith("qa_") || userRole.includes("verification")) {
        return res.status(403).json({ error: "Only the department manager can send a task to QA." });
      }

      const taskRes = await pool.query(
        `SELECT t.id, t.status, t.sent_to_qa_at, p.department_type
           FROM drm.tasks t
           LEFT JOIN drm.projects p ON p.id = t.project_id
          WHERE t.id = $1`,
        [req.params.id],
      );
      if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
      const task = taskRes.rows[0];
      if (task.status !== "Completed") {
        return res.status(400).json({ error: "Only a Completed task can be sent to QA." });
      }

      if (task.sent_to_qa_at) {
        return res.json({ success: true, sentToQaAt: task.sent_to_qa_at });
      }

      // Product Posting tasks carry per-link QA on drm.task_files — the
      // whole-task "Send to QA" hand-off is only legal once every submitted
      // link has qa_status = 'approved' (no pending / unsent / rejected left).
      if (departmentTypeMatchesFamily(task.department_type, "product_posting")) {
        const linkRes = await pool.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE qa_status = 'approved')::int AS approved
             FROM drm.task_files
            WHERE task_id = $1
              AND file_url IS NULL
              AND description IS NOT NULL
              AND description <> ''`,
          [req.params.id],
        );
        const total = Number(linkRes.rows[0]?.total) || 0;
        const approved = Number(linkRes.rows[0]?.approved) || 0;
        const pending = Math.max(0, total - approved);
        if (total === 0) {
          return res.status(400).json({
            error: "No links submitted for this Product Posting task yet. Links must be QA-approved before Send to QA.",
            pendingLinks: 0,
            totalLinks: 0,
            approvedLinks: 0,
          });
        }
        if (pending > 0) {
          return res.status(400).json({
            error: `${pending} of ${total} link(s) still pending QA approval. Approve all links before Send to QA.`,
            pendingLinks: pending,
            totalLinks: total,
            approvedLinks: approved,
          });
        }
      }

      const updated = await pool.query(
        `UPDATE drm.tasks SET sent_to_qa_at = now() WHERE id = $1 RETURNING sent_to_qa_at`,
        [req.params.id],
      );
      res.json({ success: true, sentToQaAt: updated.rows[0].sent_to_qa_at });
    } catch (error) {
      console.error("Error sending task to QA:", error);
      res.status(500).json({ error: "Failed to send task to QA" });
    }
  });

  // Departments that actually run through the QA -> Verification pipeline.
  // Everything else (IT, Software, Service) has no QA step at all — its
  // manager's own approval is the final word, via /close below.
  // Includes LEGACY-8/9/10 and modern codes — see project-department-variants.ts.

  // POST /api/pms/tasks/:id/close — a non-QA-pipeline manager's "Closed
  // Task" hand-off from "Completed Projects", the equivalent of /send-to-qa
  // above but for every department with no QA/Verification pipeline at all
  // (IT, Software, Service). Sets the same verification_reviewed_at column
  // QA's real pipeline sets, so this task graduates into GET
  // /api/pms/complete-closed-projects the same way a QA-pipeline task does
  // once QA + Verification finish it — no separate "closed" concept needed
  // downstream.
  app.post("/api/pms/tasks/:id/close", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userRole = req.user.roleId || (req.user as any).role || "";
      if (!isManagerialRole(userRole)) {
        return res.status(403).json({ error: "Only a manager can close a task." });
      }

      const taskRes = await pool.query(
        `SELECT t.id, t.status, t.verification_reviewed_at, p.department_type
           FROM drm.tasks t
           LEFT JOIN drm.projects p ON p.id = t.project_id
          WHERE t.id = $1`,
        [req.params.id],
      );
      if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
      const task = taskRes.rows[0];
      if (departmentTypeInQaPipeline(task.department_type)) {
        return res.status(400).json({ error: "This department closes tasks through QA + Verification, not this button." });
      }
      if (task.status !== "Completed") {
        return res.status(400).json({ error: "Only a Completed task can be closed." });
      }

      if (task.verification_reviewed_at) {
        return res.json({ success: true, verificationReviewedAt: task.verification_reviewed_at });
      }

      const updated = await pool.query(
        `UPDATE drm.tasks SET verification_reviewed_at = now() WHERE id = $1 RETURNING verification_reviewed_at`,
        [req.params.id],
      );
      res.json({ success: true, verificationReviewedAt: updated.rows[0].verification_reviewed_at });
    } catch (error) {
      console.error("Error closing task:", error);
      res.status(500).json({ error: "Failed to close task" });
    }
  });

  // POST /api/pms/tasks/:id/send-to-verification — QA Manager's own
  // "Completed Projects" hand-off, the QA-pipeline-department counterpart
  // of /close above. Sets qa_reviewed_at, which is exactly what GET
  // /api/product-posting/verification/queue (verification-manager-widget.tsx)
  // already filters on (qa_reviewed_at IS NOT NULL AND
  // verification_reviewed_at IS NULL) — so this surfaces the task there
  // without duplicating that queue's own logic.
  app.post("/api/pms/tasks/:id/send-to-verification", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userRole = String(req.user.roleId || (req.user as any).role || "").toLowerCase();
      if (!isManagerialRole(userRole)) {
        return res.status(403).json({ error: "Only a manager can send a task to Verification." });
      }
      // Only QA (or admin) hands off to Verification — not the PP manager / VM.
      if (
        userRole !== "qa_manager" &&
        !userRole.startsWith("qa_") &&
        !["admin", "super_admin", "super_hod"].includes(userRole)
      ) {
        return res.status(403).json({ error: "Only QA can send a task to Verification." });
      }

      const taskRes = await pool.query(
        `SELECT t.id, t.status, t.qa_reviewed_at, p.department_type
           FROM drm.tasks t
           LEFT JOIN drm.projects p ON p.id = t.project_id
          WHERE t.id = $1`,
        [req.params.id],
      );
      if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
      const task = taskRes.rows[0];
      if (!departmentTypeInQaPipeline(task.department_type)) {
        return res.status(400).json({ error: "This department doesn't go through Verification." });
      }
      if (task.status !== "Completed") {
        return res.status(400).json({ error: "Only a Completed task can be sent to Verification." });
      }

      if (task.qa_reviewed_at) {
        return res.json({ success: true, qaReviewedAt: task.qa_reviewed_at });
      }

      const updated = await pool.query(
        `UPDATE drm.tasks SET qa_reviewed_at = now() WHERE id = $1 RETURNING qa_reviewed_at`,
        [req.params.id],
      );
      res.json({ success: true, qaReviewedAt: updated.rows[0].qa_reviewed_at });
    } catch (error) {
      console.error("Error sending task to verification:", error);
      res.status(500).json({ error: "Failed to send task to verification" });
    }
  });

  // GET /api/pms/project-tasks/:projectId - Direct raw SQL tasks for modal (bypasses ORM user-scope)
  app.get("/api/pms/project-tasks/:projectId", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { projectId } = req.params;
      const activeRole = resolveRequestUserRole(req);
      const isElevatedRole = isManagerialRole(activeRole);

      if (projectId.startsWith(LEGACY_WS_CHANNEL_PREFIX)) {
        const channelLegacyPk = projectId.slice(LEGACY_WS_CHANNEL_PREFIX.length);
        const channelRow = await pool.query<{ name: string }>(
          `SELECT trim(name) as name
             FROM legacy_archive.webxl_work_space
            WHERE _legacy_pk = $1 AND type = 'channel'
            LIMIT 1`,
          [channelLegacyPk],
        );
        const channelName = channelRow.rows[0]?.name;
        if (!channelName) {
          return res.json([]);
        }

        let legacyUserId: string | null = null;
        if (!isElevatedRole) {
          const u = await pool.query(
            `SELECT legacy_id FROM migration_meta.migration_legacy_ids
              WHERE legacy_table = 'webxl_user' AND modern_id = $1::text LIMIT 1`,
            [req.user.userId],
          );
          legacyUserId = u.rows[0]?.legacy_id ?? null;
          if (!legacyUserId) {
            return res.json([]);
          }
        }

        const legacyParams: unknown[] = [channelName];
        let legacyUserFilter = "";
        if (legacyUserId) {
          legacyParams.push(legacyUserId);
          legacyUserFilter = `AND trim(a.user_id) = $${legacyParams.length}`;
        }

        const legacy = await pool.query(
          `
          SELECT
            ('legacy-assign-' || a._legacy_pk) as id,
            coalesce(nullif(trim(tl.name), ''), nullif(trim(td.detail), ''), 'Task ' || coalesce(a.task_id, a._legacy_pk)) as title,
            coalesce(nullif(trim(tl.detail), ''), nullif(trim(td.detail), ''), nullif(trim(a.soft_task_detail), ''), '') as description,
            CASE
              WHEN lower(coalesce(a.stauts, '')) IN ('end', 'completed', 'done', 'finish', 'finished') THEN 'Completed'
              WHEN trim(coalesce(a.qa_status, '')) IN ('1', 'yes') THEN 'READY_FOR_QA'
              WHEN lower(coalesce(a.stauts, '')) IN ('progress', 'start', 'run', 'running', 'active') THEN 'InProgress'
              WHEN trim(coalesce(a.mng_status, '')) IN ('1', 'yes') THEN 'READY_FOR_QA'
              ELSE 'ToDo'
            END as status,
            coalesce(nullif(trim(a.soft_task_piority), ''), 'Medium') as priority,
            json_build_object(
              'duration',
              greatest(
                0,
                coalesce(nullif(regexp_replace(coalesce(a.hours, ''), '[^0-9]', '', 'g'), '')::int, 0) * 60
                  + coalesce(nullif(regexp_replace(coalesce(a.min, ''), '[^0-9]', '', 'g'), '')::int, 0)
              )
            )::text as notes,
            NULL::timestamptz as "timerStartedAt",
            $1::text as "projectId",
            um.modern_id::uuid as "assignedToUserId",
            coalesce(
              NULLIF(trim(a.assign_date), '')::timestamp,
              NULLIF(trim(a.last_update), '')::timestamp,
              now()
            ) as "createdAt",
            coalesce(
              NULLIF(trim(a.last_update), '')::timestamp,
              NULLIF(trim(a.assign_date), '')::timestamp,
              now()
            ) as "updatedAt",
            NULL::timestamptz as "dueDate",
            NULL::int as "remainingSecondsStored",
            0 as "currentSessionElapsedSeconds",
            coalesce(u.full_name, u.name, nullif(trim(a.soft_task_name), '')) as "assigneeName",
            $1::text as "projectName",
            coalesce(nullif(trim(a.qa_com), ''), nullif(trim(a.fy_com), '')) as "rejectionNotes",
            (
              SELECT count(*)::int
                FROM legacy_archive.webxl_task_links l
               WHERE trim(l.task_id) = trim(a._legacy_pk)
                 AND coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
            ) as "submittedLinksCount",
            true as "legacyReadOnly"
          FROM legacy_archive.webxl_task_assign a
          LEFT JOIN legacy_archive.webxl_tasks_list tl
            ON trim(tl._legacy_pk) = trim(a.task_id) OR trim(tl.id) = trim(a.task_id)
          LEFT JOIN legacy_archive.webxl_task_detail td
            ON trim(td._legacy_pk) = trim(a.task_id)
          LEFT JOIN migration_meta.migration_legacy_ids um
            ON um.legacy_table = 'webxl_user' AND um.legacy_id = trim(a.user_id)
          LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
          WHERE trim(a.soft_task_cname) = $1
          ${legacyUserFilter}
          ORDER BY coalesce(NULLIF(trim(a.assign_date), '')::timestamp, now()) DESC
          `,
          legacyParams,
        );
        return res.json(legacy.rows);
      }

      const selfScopeClause = isElevatedRole
        ? ""
        : "AND (t.owner_user_id = $2 OR t.assigned_to_user_id = $2)";
      const queryParams = isElevatedRole ? [projectId] : [projectId, req.user.userId];
      const { rows } = await pool.query(`
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.notes,
          t.timer_started_at as "timerStartedAt",
          t.project_id as "projectId",
          t.assigned_to_user_id as "assignedToUserId",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          t.due_date as "dueDate",
          t.remaining_seconds as "remainingSecondsStored",
          CASE WHEN t.timer_started_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - t.timer_started_at))::int)
            ELSE 0
          END as "currentSessionElapsedSeconds",
          u.full_name as "assigneeName",
          p.name as "projectName",
          CASE WHEN t.status = 'Blocked' THEN (
            SELECT notes FROM drm.task_status_history
             WHERE task_id = t.id AND to_status = 'Blocked'
             ORDER BY changed_at DESC LIMIT 1
          ) END as "rejectionNotes",
          (
            SELECT count(*)::int
              FROM drm.task_files f
             WHERE f.task_id = t.id
               AND f.file_url IS NULL
               AND f.description IS NOT NULL
               AND trim(f.description) <> ''
          ) as "submittedLinksCount",
          false as "legacyReadOnly"
        FROM drm.tasks t
        LEFT JOIN drm.users u ON u.id = t.assigned_to_user_id
        LEFT JOIN drm.projects p ON p.id = t.project_id
        WHERE t.project_id = $1::uuid
        ${selfScopeClause}
        ORDER BY t.created_at DESC
      `, queryParams);

      const map = await pool.query(
        `SELECT legacy_id FROM migration_meta.migration_legacy_ids
          WHERE modern_table = 'projects' AND modern_id = $1 LIMIT 1`,
        [projectId],
      );
      const legacyProId = map.rows[0]?.legacy_id;
      if (!legacyProId) {
        return res.json(rows);
      }

      let legacyUserId: string | null = null;
      if (!isElevatedRole) {
        const u = await pool.query(
          `SELECT legacy_id FROM migration_meta.migration_legacy_ids
            WHERE legacy_table = 'webxl_user' AND modern_id = $1::text LIMIT 1`,
          [req.user.userId],
        );
        legacyUserId = u.rows[0]?.legacy_id ?? null;
        if (!legacyUserId) {
          return res.json(rows);
        }
      }

      const legacyParams: unknown[] = [projectId, legacyProId];
      let legacyUserFilter = "";
      if (legacyUserId) {
        legacyParams.push(legacyUserId);
        legacyUserFilter = `AND trim(a.user_id) = $${legacyParams.length}`;
      }

      const legacy = await pool.query(
        `
        SELECT
          ('legacy-assign-' || a._legacy_pk) as id,
          coalesce(nullif(trim(tl.name), ''), nullif(trim(td.detail), ''), 'Task ' || coalesce(a.task_id, a._legacy_pk)) as title,
          coalesce(nullif(trim(tl.detail), ''), nullif(trim(td.detail), ''), nullif(trim(a.soft_task_detail), ''), '') as description,
          CASE
            WHEN lower(coalesce(a.stauts, '')) IN ('end', 'completed', 'done', 'finish', 'finished') THEN 'Completed'
            WHEN trim(coalesce(a.qa_status, '')) IN ('1', 'yes') THEN 'READY_FOR_QA'
            WHEN lower(coalesce(a.stauts, '')) IN ('progress', 'start', 'run', 'running', 'active') THEN 'InProgress'
            WHEN trim(coalesce(a.mng_status, '')) IN ('1', 'yes') THEN 'READY_FOR_QA'
            ELSE 'ToDo'
          END as status,
          'Medium' as priority,
          json_build_object(
            'duration',
            greatest(
              0,
              coalesce(nullif(regexp_replace(coalesce(a.hours, ''), '[^0-9]', '', 'g'), '')::int, 0) * 60
                + coalesce(nullif(regexp_replace(coalesce(a.min, ''), '[^0-9]', '', 'g'), '')::int, 0)
            )
          )::text as notes,
          NULL::timestamptz as "timerStartedAt",
          $1::uuid as "projectId",
          um.modern_id::uuid as "assignedToUserId",
          coalesce(
            NULLIF(trim(a.assign_date), '')::timestamp,
            NULLIF(trim(a.last_update), '')::timestamp,
            now()
          ) as "createdAt",
          coalesce(
            NULLIF(trim(a.last_update), '')::timestamp,
            NULLIF(trim(a.assign_date), '')::timestamp,
            now()
          ) as "updatedAt",
          NULL::timestamptz as "dueDate",
          NULL::int as "remainingSecondsStored",
          0 as "currentSessionElapsedSeconds",
          coalesce(u.full_name, u.name) as "assigneeName",
          p.name as "projectName",
          coalesce(nullif(trim(a.qa_com), ''), nullif(trim(a.fy_com), '')) as "rejectionNotes",
          (
            SELECT count(*)::int
              FROM legacy_archive.webxl_task_links l
             WHERE trim(l.pro_id) = trim(a.pro_id)
               AND (
                 trim(l.task_id) = trim(a.task_id)
                 OR trim(l.task_id) = trim(a._legacy_pk)
               )
               AND coalesce(nullif(trim(l.link), ''), nullif(trim(l.detail), '')) IS NOT NULL
          ) as "submittedLinksCount",
          true as "legacyReadOnly"
        FROM legacy_archive.webxl_task_assign a
        LEFT JOIN legacy_archive.webxl_tasks_list tl
          ON trim(tl._legacy_pk) = trim(a.task_id) OR trim(tl.id) = trim(a.task_id)
        LEFT JOIN legacy_archive.webxl_task_detail td
          ON trim(td._legacy_pk) = trim(a.task_id)
        LEFT JOIN migration_meta.migration_legacy_ids um
          ON um.legacy_table = 'webxl_user' AND um.legacy_id = trim(a.user_id)
        LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
        JOIN drm.projects p ON p.id = $1::uuid
        WHERE trim(a.pro_id) = trim($2::text)
        ${legacyUserFilter}
        ORDER BY coalesce(NULLIF(trim(a.assign_date), '')::timestamp, now()) DESC
        `,
        legacyParams,
      );

      const merged = [...rows, ...legacy.rows];
      merged.sort(
        (a, b) =>
          new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime(),
      );
      res.json(merged);
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      res.status(500).json({ error: "Failed to fetch project tasks" });
    }
  });

  // GET /api/pms/projects/:id - Get single project
  app.get("/api/pms/projects/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const project = await projectsRepository.findById(req.params.id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if user owns the project
      if (!isManagerialRole(req.user.roleId) && project.ownerUserId !== req.user.userId) {
        return res.status(403).json({ error: "Not authorized to view this project" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // POST /api/pms/projects - Create project
  app.post("/api/pms/projects", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate request body
      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectSchema.parse({
        invoiceId: _p.invoiceId,
        customerId: _p.customerId,
        name: _p.name,
        description: _p.description,
        workSpace: _p.workSpace,
        departmentType: _p.departmentType,
        gmId: _p.gmId,
        serviceType: _p.serviceType,
        invoiceType: _p.invoiceType,
        projectType: _p.projectType,
        status: _p.status,
        startDate: _p.startDate,
        endDate: _p.endDate,
        notes: _p.notes,
        ownerUserId: _p.ownerUserId || req.user.userId
      });

      console.log(`[PMS] Creating project: ${validated.name} for user ${validated.ownerUserId}`);
      const project = await projectsRepository.create(validated);
      console.log(`[PMS] Project created successfully: ${project.id}`);

      // Cross-department handoff: a project routed to an execution department.
      // Records the ledger row and notifies that department's managers (resolved
      // to real user UUIDs). Best-effort — never blocks project creation.
      await CrossDepartmentStatusService.onProjectCreated({
        projectId: project.id,
        invoiceId: (project as any).invoiceId ?? (validated as any).invoiceId ?? null,
        departmentType: (project as any).departmentType ?? (validated as any).departmentType ?? null,
        projectName: project.name,
        actorUserId: req.user.userId,
        req,
      });

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[PMS] Validation failed:", error.errors);
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[PMS] Error creating project:", error);
      res.status(500).json({ error: "Failed to create project", detail: error instanceof Error ? error.message : String(error) });
    }
  });

  // PUT /api/pms/projects/:id - Update project
  app.put("/api/pms/projects/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if project exists and user owns it
      const existing = await projectsRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!isManagerialRole(req.user.roleId) && existing.ownerUserId !== req.user.userId) {
        return res.status(403).json({ error: "Only the project owner or a manager can edit" });
      }

      // Workflow-sensitive fields must NEVER be mutated through this generic
      // metadata-edit endpoint — they are owned by the centralized
      // WorkflowTransitionService (server/services/workflow-transition.service.ts).
      // Allowing them here would let an owner/manager skip the state machine
      // (e.g. force `status` to a later phase, re-point `invoiceId`, or change
      // `ownerUserId`). Fail closed: reject any attempt that touches them.
      const WORKFLOW_SENSITIVE_FIELDS = [
        "status",
        "currentPhase",
        "current_phase",
        "phase",
        "departmentType",
        "department_type",
        "invoiceId",
        "invoice_id",
        "ownerUserId",
        "owner_user_id",
        // Workflow actor ids (manager / executive / QA / verification) — never
        // assignable through a generic metadata edit.
        "assignedToUserId",
        "assigned_to_user_id",
        "managerUserId",
        "manager_user_id",
        "qaUserId",
        "qa_user_id",
        "qaManagerUserId",
        "qa_manager_user_id",
        "verificationUserId",
        "verification_user_id",
        "verificationManagerUserId",
        "verification_manager_user_id",
        "executiveUserId",
        "executive_user_id",
        "isDeleted",
        "is_deleted",
        "id",
        "createdAt",
        "created_at",
        "updatedAt",
        "updated_at",
      ];
      const body = (req.body ?? {}) as Record<string, unknown>;
      const attemptedSensitive = WORKFLOW_SENSITIVE_FIELDS.filter((f) =>
        Object.prototype.hasOwnProperty.call(body, f),
      );
      if (attemptedSensitive.length > 0) {
        return res.status(400).json({
          error:
            "These fields cannot be changed via project edit; they are managed by the workflow.",
          fields: attemptedSensitive,
        });
      }

      // Fail-closed allowlist of editable project metadata. Keys must match the
      // Drizzle column names (camelCase); anything else is ignored.
      const EDITABLE_PROJECT_FIELDS = [
        "name",
        "description",
        "workSpace",
        "customerId",
        "startDate",
        "endDate",
        "notes",
      ] as const;
      const updateData: Record<string, unknown> = {};
      for (const field of EDITABLE_PROJECT_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updateData[field] = body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No editable fields provided" });
      }

      const updated = await projectsRepository.update(req.params.id, updateData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // ===== TASK ENDPOINTS =====

  const parsePeriodRange = (period?: string, fromRaw?: string, toRaw?: string) => {
    let from = fromRaw ? new Date(fromRaw) : undefined;
    let to = toRaw ? new Date(toRaw) : undefined;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    switch (period) {
      case "today":
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case "7d":
        from = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        to = endOfDay(now);
        break;
      case "30d":
        from = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
        to = endOfDay(now);
        break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case "lastMonth": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = lastMonth;
        to = endOfDay(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));
        break;
      }
    }

    return { from, to };
  };
  const parseDateRangeWithDefault = (fromRaw?: string, toRaw?: string, fallbackDays = 7) => {
    let from = fromRaw ? new Date(fromRaw) : undefined;
    let to = toRaw ? new Date(toRaw) : undefined;
    const now = new Date();
    if (!from || isNaN(from.getTime())) {
      from = new Date(now.getTime() - fallbackDays * 24 * 60 * 60 * 1000);
    }
    if (!to || isNaN(to.getTime())) {
      to = now;
    }
    return { from, to };
  };

  // GET /api/pms/tasks/meta - dropdown data
  app.get("/api/pms/tasks/meta", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [projectsRes, usersRes] = await Promise.all([
        pool.query(`
          SELECT id, name
            FROM drm.projects
           WHERE status = 'Active'
             AND coalesce(is_deleted, false) = false
           ORDER BY updated_at DESC
           LIMIT 5000
        `),
        pool.query(`
          SELECT id,
                 coalesce(full_name, name) as name,
                 role_id as "roleId",
                 branch
            FROM drm.users
           WHERE is_active = true OR is_active IS NULL
           ORDER BY coalesce(full_name, name)
        `),
      ]);

      res.json({
        projects: projectsRes.rows,
        users: usersRes.rows,
        priorities: ["Low", "Medium", "High"],
      });
    } catch (error) {
      console.error("Error fetching task meta:", error);
      res.status(500).json({ error: "Failed to fetch task meta" });
    }
  });

  // GET /api/pms/tasks - List tasks with filters (scoped)
  app.get("/api/pms/tasks", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { projectId, status, priority, search, assignedToUserId, period, from: fromRaw, to: toRaw } = req.query;
      const { from, to } = parsePeriodRange(period as string | undefined, fromRaw as string | undefined, toRaw as string | undefined);

      let filterUserIds: string[] | undefined = undefined;
      const activeRole = (req.user as any).activeRoleId || req.user.roleId || "";
      // When projectId is given (viewing specific project's tasks), skip all user-scope filters
      if (!projectId && isManagerialRole(activeRole)) {
          const allowedIds = await getDepartmentFilterUserIds(req);
          if (allowedIds === null) {
              // Global admin, do nothing (keep undefined)
          } else if (allowedIds && allowedIds.length > 0) {
              filterUserIds = allowedIds;
          } else {
              filterUserIds = ['00000000-0000-0000-0000-000000000000'];
          }
      }

      const tasks = await tasksRepository.findBoard({
        projectId: projectId as string | undefined,
        assignedToUserId: assignedToUserId as string | undefined,
        priority: priority as string | undefined,
        search: search as string | undefined,
        from,
        to,
        // If projectId given, use admin role to bypass user-scope filters in repository
        userId: projectId ? undefined : req.user.userId,
        roleId: projectId ? "admin" : req.user.roleId,
        filterUserIds: projectId ? undefined : filterUserIds,
      });

      const filtered = status ? tasks.filter((t) => t.status === status) : tasks;

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // GET /api/pms/tasks/board - Kanban board data with counts
  app.get("/api/pms/tasks/board", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { projectId, assignedToUserId, priority, search, period, from: fromRaw, to: toRaw } = req.query;
      const { from, to } = parsePeriodRange(period as string | undefined, fromRaw as string | undefined, toRaw as string | undefined);

      let filterUserIds: string[] | undefined = undefined;
      if (req.user.roleId === "sales_manager") {
          // Self-only — never team/org data. Bypasses getDepartmentFilterUserIds
          // (a stub that always returns null) entirely rather than relying on it.
          filterUserIds = [req.user.userId];
      }

      const tasks = await tasksRepository.findBoard({
        projectId: projectId as string | undefined,
        assignedToUserId: assignedToUserId as string | undefined,
        priority: priority as string | undefined,
        search: search as string | undefined,
        from,
        to,
        userId: req.user.userId,
        roleId: req.user.roleId,
        filterUserIds,
      });

      const now = new Date();
      const counts = tasks.reduce(
        (acc, task) => {
          acc.total += 1;
          const statusKey = (task.status || "ToDo") as string;
          if (statusKey === "ToDo") acc.toDo += 1;
          if (statusKey === "InProgress") acc.inProgress += 1;
          if (statusKey === "Blocked") acc.blocked += 1;
          if (statusKey === "Completed") acc.completed += 1;
          if (task.dueDate && new Date(task.dueDate) < now && statusKey !== "Completed") {
            acc.overdue += 1;
          }
          return acc;
        },
        { total: 0, toDo: 0, inProgress: 0, blocked: 0, completed: 0, overdue: 0 }
      );

      res.json({
        items: tasks,
        counts,
      });
    } catch (error) {
      console.error("Error fetching task board:", error);
      res.status(500).json({ error: "Failed to fetch task board" });
    }
  });

  // GET /api/pms/tasks/:id - Get single task
  app.get("/api/pms/tasks/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const task = await tasksRepository.findById(req.params.id);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // POST /api/pms/tasks - Create task
  app.post("/api/pms/tasks", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate request body
      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      // Phase 12 — a newly created task always starts at its schema default
      // (`ToDo`, i.e. "assigned"); client-supplied `status` is intentionally
      // dropped so a task can't be created pre-skipped straight to e.g.
      // "Completed", bypassing the lifecycle entirely.
      const validated = insertTaskSchema.parse({
        projectId: _p.projectId,
        title: _p.title,
        description: _p.description,
        assignedToUserId: _p.assignedToUserId,
        participants: _p.participants,
        category: _p.category,
        priority: _p.priority,
        startDate: _p.startDate,
        dueDate: _p.dueDate,
        notes: _p.notes,
        ownerUserId: req.user.userId
      });

      const task = await tasksRepository.create({
        ...validated,
        createdBy: req.user.userId,
      } as any);

      // D&D Executive's own "Create New Task" is the only caller that opts into this —
      // the generic PMS task board (pms-tasks.tsx) lets a user pick ANY project, and
      // unconditionally ensuring a productPostingWorkflows row there would wrongly pull
      // unrelated projects into the Product Posting/D&D manager queues and permanently
      // mis-tag their department_type.
      if (_p.ensureProductPostingWorkflow && task.projectId) {
        try {
          await getOrCreateProductPostingWorkflow(task.projectId);
        } catch (err) {
          console.error("Failed to ensure product posting workflow for task's project:", err);
        }
      }

      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task", details: (error as any)?.message });
    }
  });

  // POST /api/pms/workspace-tasks - Create task from workspace (links by channel/project name)
  app.post("/api/pms/workspace-tasks", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      const { channelName, taskName, personName, priority, taskType } = req.body;
      if (!channelName || !taskName) {
        return res.status(400).json({ error: "channelName and taskName are required" });
      }

      // Find project by channel name (e.g. "honda • talha")
      const projectResult = await pool.query(
        `SELECT p.id, p.name, c.company_name
         FROM drm.projects p
         LEFT JOIN drm.customers c ON c.id::text = p.customer_id::text
         WHERE p.name ILIKE $1
         ORDER BY p.created_at DESC LIMIT 1`,
        [channelName]
      );

      let projectId: string | null = null;
      if (projectResult.rows.length > 0) {
        projectId = projectResult.rows[0].id;
      }

      // Find the assignee by name (personName from dropdown)
      let assignedToUserId: string | null = null;
      if (personName && personName !== "To-Do List") {
        const userResult = await pool.query(
          `SELECT id FROM drm.users WHERE (name ILIKE $1 OR full_name ILIKE $1) AND (role = 'dd_executive' OR role_id = 'dd_executive') LIMIT 1`,
          [personName.trim()]
        );
        if (userResult.rows.length > 0) {
          assignedToUserId = userResult.rows[0].id;
        }
      }

      // Create the task in DB
      const insertResult = await pool.query(
        `INSERT INTO drm.tasks
           (project_id, title, description, status, priority, assigned_to_user_id, owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'ToDo', $4, $5, $6, now(), now())
         RETURNING id, title, status`,
        [
          projectId,
          taskName,
          taskType || null,
          priority || "Medium",
          assignedToUserId,
          req.user.userId,
        ]
      );

      const createdTask = insertResult.rows[0];
      if (assignedToUserId && createdTask) {
        try {
          await notifyTaskAssignee({
            assigneeUserId: assignedToUserId,
            taskId: createdTask.id,
            taskTitle: createdTask.title,
            projectId,
          });
        } catch (notifyErr) {
          console.error("[workspace-tasks] assignee notification failed:", notifyErr);
        }
      }

      res.status(201).json({ success: true, task: createdTask });
    } catch (error) {
      console.error("Error creating workspace task:", error);
      res.status(500).json({ error: "Failed to create workspace task", details: (error as any)?.message });
    }
  });

  // PUT /api/pms/tasks/:id - Update task
  app.put("/api/pms/tasks/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existing = await tasksRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }

      // PATCH 7 SEC-003: only the task owner, assignee, or a manager may edit.
      if (!canManageTask(existing, req.user)) {
        return res.status(403).json({ error: "Only the task owner, assignee, or a manager can update this task." });
      }

      // If updating status, route through the central PMS transition service
      // (Phase 12 — this used to call tasksRepository.updateStatus directly,
      // bypassing the transition map entirely; that let a status change via
      // this endpoint skip stages the dedicated Kanban endpoint already
      // blocked).
      if (req.body.status && req.body.status !== existing.status) {
        const result = await changeTaskStatus({
          taskId: req.params.id,
          toStatus: req.body.status,
          actorUserId: req.user.userId,
          actorRoles: collectActorRoles(req.user),
          reason: req.body?.reason ?? null,
          notes: req.body?.notes ?? null,
          remarks: req.body?.remarks ?? null,
          evidenceCount: Array.isArray(req.body?.evidence) ? req.body.evidence.length : undefined,
          req,
        });

        if (!result.success) {
          return res.status(result.status || 403).json({ error: result.error, code: (result as any).code });
        }

        // If there are other fields to update besides status, update them separately
        const { status, ownerUserId, ...otherUpdates } = req.body;

        if (Object.keys(otherUpdates).length > 0) {
          const updated = await tasksRepository.update(req.params.id, otherUpdates);
          return res.json(updated);
        }

        return res.json(result.task);
      }

      // Don't allow changing the owner
      const { ownerUserId, ...updateData } = req.body;

      const updated = await tasksRepository.update(req.params.id, updateData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // PATCH /api/pms/tasks/:id - Partial update task
  app.patch("/api/pms/tasks/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existing = await tasksRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }

      // PATCH 7 SEC-003: only the task owner, assignee, or a manager may edit.
      if (!canManageTask(existing, req.user)) {
        return res.status(403).json({ error: "Only the task owner, assignee, or a manager can update this task." });
      }

      // If updating status, route through the central PMS transition service
      // (Phase 12 — see the identical fix on PUT above).
      if (req.body.status && req.body.status !== existing.status) {
        const result = await changeTaskStatus({
          taskId: req.params.id,
          toStatus: req.body.status,
          actorUserId: req.user.userId,
          actorRoles: collectActorRoles(req.user),
          reason: req.body?.reason ?? null,
          notes: req.body?.notes ?? null,
          remarks: req.body?.remarks ?? null,
          evidenceCount: Array.isArray(req.body?.evidence) ? req.body.evidence.length : undefined,
          req,
        });

        if (!result.success) {
          return res.status(result.status || 403).json({ error: result.error, code: (result as any).code });
        }

        // If there are other fields to update besides status, update them separately
        const { status, ownerUserId, ...otherUpdates } = req.body;

        if (Object.keys(otherUpdates).length > 0) {
          const updated = await tasksRepository.update(req.params.id, otherUpdates);
          return res.json(updated);
        }

        return res.json(result.task);
      }

      // Don't allow changing the owner
      const { ownerUserId, ...updateData } = req.body;

      const updated = await tasksRepository.update(req.params.id, updateData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // PATCH /api/pms/tasks/:id/status - Update task status (Kanban drag-drop)
  app.patch("/api/pms/task/:id/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const validStatuses = ["ToDo", "InProgress", "Blocked", "Completed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Route through the central PMS transition service (Patch 6 Stage 4). With
      // the default config this preserves the legacy behaviour exactly: the
      // owner/assignee permission check (same 403 message), the status-history
      // record, and the 200 body (the updated task). The service additionally
      // records best-effort audit + notification.
      const result = await changeTaskStatus({
        taskId: req.params.id,
        toStatus: status,
        actorUserId: req.user.userId,
        actorRoles: collectActorRoles(req.user),
        reason: req.body?.reason ?? null,
        notes: req.body?.notes ?? null,
        remarks: req.body?.remarks ?? null,
        evidenceCount: Array.isArray(req.body?.evidence) ? req.body.evidence.length : undefined,
        req,
      });

      if (!result.success) {
        return res.status(result.status || 500).json({ error: result.error });
      }

      res.json(result.task);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // GET /api/pms/users - Get all users for assignment dropdown
  app.get("/api/pms/users", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const users = await usersRepository.findAll();
      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        branch: u.branch,
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // ===== TASK COMMENTS ENDPOINTS =====

  // GET /api/pms/tasks/:id/comments - Get task comments
  app.get("/api/pms/tasks/:id/comments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const comments = await taskCommentsRepository.findByTaskId(req.params.id);

      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // POST /api/pms/tasks/:id/comments - Add comment to task
  app.post("/api/pms/tasks/:id/comments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate request body
      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertTaskCommentSchema.parse({
        comment: _p.comment,
        taskId: req.params.id,
        userId: req.user.userId
      });

      const comment = await taskCommentsRepository.create(validated);

      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // ===== RUNNING PROJECTS (WITH FINANCIALS) =====

  const runningProjectCreateSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    workSpace: z.string().optional(),
    startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
    endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
    totalValue: z.coerce.number().nonnegative().default(0),
    currency: z.string().optional().default("USD"),
  });

  // GET /api/pms/running-projects - Get projects with financial tracking
  app.get("/api/pms/running-projects", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "Active";
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || "100", 10)));
      const fromRaw = req.query.from as string | undefined;
      const toRaw = req.query.to as string | undefined;
      const from = fromRaw ? new Date(fromRaw) : undefined;
      const to = toRaw ? new Date(toRaw) : undefined;
      const paginated = req.query.paginated === "true";

      let filterUserIds: string[] | undefined = undefined;
      if (req.user.roleId === "sales_manager") {
          // Self-only — never team/org data. Bypasses getDepartmentFilterUserIds
          // (a stub that always returns null) entirely rather than relying on it.
          filterUserIds = [req.user.userId];
      }

      const financials = await projectFinancialsRepository.findWithFilters({
        search,
        status,
        userId: req.user.userId,
        roleId: req.user.roleId,
        from,
        to,
        filterUserIds,
      });

      const items = financials.map((f) => ({
        ...f,
        dueAmount: (parseFloat(f.totalAmount || "0") - parseFloat(f.paidAmount || "0")).toFixed(2),
      }));

      if (paginated || req.query.page) {
        const total = items.length;
        const sliceStart = (page - 1) * pageSize;
        const sliceEnd = sliceStart + pageSize;
        return res.json({
          items: items.slice(sliceStart, sliceEnd),
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        });
      }

      res.json(items);
    } catch (error) {
      console.error("Error fetching running projects:", error);
      res.status(500).json({ error: "Failed to fetch running projects" });
    }
  });

  // GET /api/pms/project-report - D&D Manager Project Report (real, DB-backed).
  // Delegates to the shared handler so /api/pms, /api/dd-manager and
  // /api/reports all return the identical report shape.
  app.get("/api/pms/project-report", handleProjectReport);

  // GET /api/pms/running-projects/summary - Aggregated totals for running projects
  app.get("/api/pms/running-projects/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "Active";
      const period = (req.query.period as string) || "";
      const fromRaw = req.query.from as string | undefined;
      const toRaw = req.query.to as string | undefined;
      let from = fromRaw ? new Date(fromRaw) : undefined;
      let to = toRaw ? new Date(toRaw) : undefined;

      const now = new Date();
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      switch (period) {
        case "today":
          from = startOfDay(now);
          to = endOfDay(now);
          break;
        case "7d":
          from = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
          to = endOfDay(now);
          break;
        case "30d":
          from = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
          to = endOfDay(now);
          break;
        case "thisMonth":
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
          break;
        case "lastMonth": {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          from = lastMonth;
          to = endOfDay(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));
          break;
        }
      }

      let filterUserIds: string[] | undefined = undefined;
      if (req.user.roleId === "sales_manager") {
          // Self-only — never team/org data. Bypasses getDepartmentFilterUserIds
          // (a stub that always returns null) entirely rather than relying on it.
          filterUserIds = [req.user.userId];
      }

      const summary = await projectFinancialsRepository.getSummary({
        search,
        status,
        userId: req.user.userId,
        roleId: req.user.roleId,
        filterUserIds,
      });

      res.json({
        ...summary,
        paidPercent: Number(summary.paidPercent.toFixed(2)),
      });
    } catch (error) {
      console.error("Error fetching running projects summary:", error);
      res.status(500).json({ error: "Failed to fetch running projects summary" });
    }
  });

  // POST /api/pms/running-projects - Create a running project with financials
  app.post("/api/pms/running-projects", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const parsed = runningProjectCreateSchema.parse(req.body);

      const project = await projectsRepository.create({
        name: parsed.name,
        description: parsed.description,
        ownerUserId: req.user.userId,
        workSpace: parsed.workSpace,
        status: "Active",
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      } as any);

      const financials = await projectFinancialsRepository.upsert(project.id, {
        totalAmount: parsed.totalValue.toString(),
        paidAmount: "0",
        currency: parsed.currency || "USD",
      } as any);

      return res.status(201).json({
        ...financials,
        dueAmount: (parseFloat(financials.totalAmount || "0") - parseFloat(financials.paidAmount || "0")).toFixed(2),
        project,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating running project:", error);
      res.status(500).json({ error: "Failed to create running project" });
    }
  });

  // GET /api/pms/projects/:id/financials - Get project financials
  app.get("/api/pms/projects/:id/financials", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const financials = await projectFinancialsRepository.findByProjectId(req.params.id);

      if (!financials) {
        return res.json(null);
      }

      res.json({
        ...financials,
        dueAmount: (parseFloat(financials.totalAmount || "0") - parseFloat(financials.paidAmount || "0")).toFixed(2),
      });
    } catch (error) {
      console.error("Error fetching project financials:", error);
      res.status(500).json({ error: "Failed to fetch project financials" });
    }
  });

  // POST /api/pms/projects/:id/financials - Create/Update project financials
  app.post("/api/pms/projects/:id/financials", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectFinancialSchema.parse({
        totalAmount: _p.totalAmount,
        paidAmount: _p.paidAmount,
        currency: _p.currency,
        lastPaymentAt: _p.lastPaymentAt,
        projectId: req.params.id
      });

      const financials = await projectFinancialsRepository.upsert(req.params.id, validated);

      res.status(201).json(financials);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating project financials:", error);
      res.status(500).json({ error: "Failed to create project financials" });
    }
  });

  // ===== PAYMENTS =====

  // GET /api/pms/projects/:id/payments - Get project payments
  app.get("/api/pms/projects/:id/payments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const payments = await projectPaymentsRepository.findByProjectId(req.params.id);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching project payments:", error);
      res.status(500).json({ error: "Failed to fetch project payments" });
    }
  });

  // POST /api/pms/projects/:id/payments - Record a payment
  app.post("/api/pms/projects/:id/payments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectPaymentSchema.parse({
        amount: _p.amount,
        paymentMethod: _p.paymentMethod,
        reference: _p.reference,
        notes: _p.notes,
        paidAt: _p.paidAt,
        projectId: req.params.id,
        paidByUserId: req.user.userId
      });

      const payment = await projectPaymentsRepository.create(validated);

      // Update financials paid amount
      await projectFinancialsRepository.updatePaidAmount(
        req.params.id,
        parseFloat(req.body.amount || "0")
      );

      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error recording payment:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  // Running projects aliases for payments and status updates
  app.get("/api/pms/running-projects/:id/payments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const payments = await projectPaymentsRepository.findByProjectId(req.params.id);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching running project payments:", error);
      res.status(500).json({ error: "Failed to fetch running project payments" });
    }
  });

  app.post("/api/pms/running-projects/:id/payments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectPaymentSchema.parse({
        amount: _p.amount,
        paymentMethod: _p.paymentMethod,
        reference: _p.reference,
        notes: _p.notes,
        paidAt: _p.paidAt,
        projectId: req.params.id,
        paidByUserId: req.user.userId
      });

      const payment = await projectPaymentsRepository.create(validated);
      await projectFinancialsRepository.updatePaidAmount(req.params.id, parseFloat(req.body.amount || "0"));

      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error recording running project payment:", error);
      res.status(500).json({ error: "Failed to record running project payment" });
    }
  });

  app.patch("/api/pms/running-projects/:id/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Route through the central PMS transition service (Patch 6 Stage 4). The
      // legacy endpoint had no enum validation and no role restriction, so the
      // permissive default keeps both (same 404 / 200 bodies); strict mode adds
      // canonical-transition + manager/admin guards. Audit is best-effort.
      const result = await changeProjectStatus({
        projectId: req.params.id,
        toStatus: status,
        actorUserId: req.user.userId,
        actorRoles: collectActorRoles(req.user),
        reason: req.body?.reason ?? null,
        req,
      });

      if (!result.success) {
        return res.status(result.status || 500).json({ error: result.error });
      }

      res.json(result.project);
    } catch (error) {
      console.error("Error updating running project status:", error);
      res.status(500).json({ error: "Failed to update running project status" });
    }
  });

  // ===== APPROVALS =====

  // GET /api/pms/pending-approvals - Get all pending approvals
  app.get("/api/pms/pending-approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { stage } = req.query;
      const approvals = await projectApprovalsRepository.findPending(
        stage as string | undefined,
        req.user.userId,
        req.user.roleId,
      );
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // GET /api/pms/approval-stats - Get approval statistics
  app.get("/api/pms/approval-stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const stats = await projectApprovalsRepository.getApprovalStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching approval stats:", error);
      res.status(500).json({ error: "Failed to fetch approval stats" });
    }
  });

  // GET /api/pms/approvals - paginated approvals list (with stage/status filters)
  app.get("/api/pms/approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const stage = (req.query.stage as string) || "all";
      const status = (req.query.status as string) || "pending";
      const search = (req.query.search as string) || "";
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || "20", 10)));

      const { items, total } = await projectApprovalsRepository.findList({
        stage,
        status,
        search,
        page,
        pageSize,
        userId: req.user.userId,
        roleId: req.user.roleId,
      });

      res.json({
        items,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error("Error fetching approvals:", error);
      res.status(500).json({ error: "Failed to fetch approvals" });
    }
  });

  // GET /api/pms/approvals/summary - counts by status for a stage
  app.get("/api/pms/approvals/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const stage = (req.query.stage as string) || "all";
      const counts = await projectApprovalsRepository.getSummaryByStage(stage, req.user.userId, req.user.roleId);
      res.json({ stage, counts });
    } catch (error) {
      console.error("Error fetching approval summary:", error);
      res.status(500).json({ error: "Failed to fetch approval summary" });
    }
  });

  // GET /api/pms/approvals/:id - approval detail
  app.get("/api/pms/approvals/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const approval = await projectApprovalsRepository.findById(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      res.json(approval);
    } catch (error) {
      console.error("Error fetching approval detail:", error);
      res.status(500).json({ error: "Failed to fetch approval detail" });
    }
  });

  // POST /api/pms/approvals/:id/approve
  app.post("/api/pms/approvals/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const approval = await projectApprovalsRepository.findById(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });

      // PATCH 7 SEC-003: only a manager or the designated approver may decide.
      if (!canDecideApproval(approval, req.user)) {
        return res.status(403).json({ error: "Only a manager or the designated approver can decide this request." });
      }

      // Phase 12 — approve() now only updates a row that's still "Pending";
      // a null result means it was already decided (race or repeat call).
      const updated = await projectApprovalsRepository.approve(req.params.id, req.user.userId);
      if (!updated) {
        return res.status(409).json({ error: "This approval has already been decided and is no longer pending." });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ error: "Failed to approve request" });
    }
  });

  // POST /api/pms/approvals/:id/reject
  app.post("/api/pms/approvals/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { comment } = req.body || {};
      const approval = await projectApprovalsRepository.findById(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });

      // PATCH 7 SEC-003: only a manager or the designated approver may decide.
      if (!canDecideApproval(approval, req.user)) {
        return res.status(403).json({ error: "Only a manager or the designated approver can decide this request." });
      }

      // Phase 12 — reject() now only updates a row that's still "Pending".
      const updated = await projectApprovalsRepository.reject(req.params.id, req.user.userId, comment || null);
      if (!updated) {
        return res.status(409).json({ error: "This approval has already been decided and is no longer pending." });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting request:", error);
      res.status(500).json({ error: "Failed to reject request" });
    }
  });

  // GET /api/pms/projects/:id/approvals - Get project approvals
  app.get("/api/pms/projects/:id/approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const approvals = await projectApprovalsRepository.findByProjectId(req.params.id);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching project approvals:", error);
      res.status(500).json({ error: "Failed to fetch project approvals" });
    }
  });

  // POST /api/pms/projects/:id/approvals - Create approval request
  app.post("/api/pms/projects/:id/approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectApprovalSchema.parse({
        stage: _p.stage,
        status: _p.status,
        requestedBy: _p.requestedBy,
        approvedBy: _p.approvedBy,
        approverUserId: _p.approverUserId,
        approvedAt: _p.approvedAt,
        rejectionReason: _p.rejectionReason,
        notes: _p.notes,
        projectId: req.params.id
      });

      const approval = await projectApprovalsRepository.create(validated);

      res.status(201).json(approval);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating approval:", error);
      res.status(500).json({ error: "Failed to create approval" });
    }
  });

  // ===== PROJECT ASSIGNMENTS (TEAM WORKSPACE) =====

  // Team workspace summary
  app.get("/api/pms/team-workspace/summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = req.user.userId;

      const summarySql = `
        with my_projects as (
          select distinct pa.project_id
          from project_assignments pa
          where pa.user_id = $1
        ),
        project_counts as (
          select
            (select count(*) from my_projects) as my_projects,
            (select count(*) from projects p join my_projects mp on mp.project_id = p.id where lower(coalesce(p.status,'Active')) = 'active') as active_projects
        ),
        team as (
          select count(distinct pa.user_id) as team_members
          from project_assignments pa
          where pa.project_id in (select project_id from my_projects) and pa.user_id <> $1
        )
        select pc.my_projects, pc.active_projects, coalesce(t.team_members,0) as team_members
        from project_counts pc, team t;
      `;

      const { rows } = await pool.query<{
        my_projects: number | null;
        active_projects: number | null;
        team_members: number | null;
      }>(summarySql, [userId]);
      const row = rows[0] || { my_projects: 0, active_projects: 0, team_members: 0 };

      return res.json({
        success: true,
        data: {
          myProjects: Number(row.my_projects || 0),
          activeProjects: Number(row.active_projects || 0),
          teamMembers: Number(row.team_members || 0),
        },
      });
    } catch (error) {
      console.error("Error fetching team workspace summary:", error);
      return res.status(500).json({ error: "Failed to fetch team workspace summary" });
    }
  });

  // Team workspace assignments (paginated)
  app.get("/api/pms/team-workspace/assignments", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = req.user.userId;
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || "10", 10)));
      const search = (req.query.search as string) || "";
      const offset = (page - 1) * pageSize;

      // Sales Manager: workspaces limited to projects they personally own —
      // never a project they're merely a member/participant on (which would
      // surface a teammate's/manager's project). Every other role keeps the
      // existing membership-based "projects I'm assigned to" scope.
      const isSalesManagerRole = req.user.roleId === "sales_manager";
      const myProjectsClause = isSalesManagerRole
        ? `select distinct p2.id as project_id from projects p2 where p2.owner_user_id = $1`
        : `select distinct pa.project_id from project_assignments pa where pa.user_id = $1`;

      const assignmentsSql = `
        with my_projects as (
          ${myProjectsClause}
        ),
        filtered_projects as (
          select p.*
          from projects p
          join my_projects mp on mp.project_id = p.id
          where ($2 = '' or p.name ilike ('%' || $2 || '%'))
        ),
        members as (
          select pa.project_id, jsonb_agg(jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'role', pa.role
          )) as members
          from project_assignments pa
          join users u on u.id = pa.user_id
          where pa.project_id in (select id from filtered_projects)
          group by pa.project_id
        ),
        my_roles as (
          select project_id, role as my_role
          from project_assignments
          where user_id = $1
        ),
        task_counts as (
          select
            t.project_id,
            count(*)::int as total,
            count(*) filter (where lower(t.status::text) = 'todo')::int as todo,
            count(*) filter (where lower(t.status::text) in ('inprogress', 'in_progress'))::int as in_progress,
            count(*) filter (where lower(t.status::text) = 'blocked')::int as blocked,
            count(*) filter (where lower(t.status::text) = 'completed')::int as completed,
            count(*) filter (where t.due_date < now() and lower(t.status::text) <> 'completed')::int as overdue
          from tasks t
          where t.project_id in (select id from filtered_projects)
          group by t.project_id
        ),
        total_count as (
          select count(*) as total from filtered_projects
        )
        select
          fp.id as project_id,
          fp.name as project_name,
          fp.status,
          fp.start_date,
          fp.end_date,
          fp.owner_user_id,
          u_owner.name as owner_name,
          u_owner.email as owner_email,
          coalesce(m.members, '[]'::jsonb) as members,
          mr.my_role,
          coalesce(tc.total,0) as tasks_total,
          coalesce(tc.todo,0) as tasks_todo,
          coalesce(tc.in_progress,0) as tasks_in_progress,
          coalesce(tc.blocked,0) as tasks_blocked,
          coalesce(tc.completed,0) as tasks_completed,
          coalesce(tc.overdue,0) as tasks_overdue,
          (select total from total_count) as total_rows
        from filtered_projects fp
        left join users u_owner on u_owner.id = fp.owner_user_id
        left join members m on m.project_id = fp.id
        left join my_roles mr on mr.project_id = fp.id
        left join task_counts tc on tc.project_id = fp.id
        order by fp.created_at desc
        limit $3 offset $4;
      `;

      const { rows } = await pool.query<{
        project_id: string;
        project_name: string | null;
        status: string | null;
        start_date: Date | null;
        end_date: Date | null;
        owner_user_id: string | null;
        owner_name: string | null;
        owner_email: string | null;
        members: any;
        my_role: string | null;
        tasks_total: number | null;
        tasks_todo: number | null;
        tasks_in_progress: number | null;
        tasks_blocked: number | null;
        tasks_completed: number | null;
        tasks_overdue: number | null;
        total_rows: number | null;
      }>(assignmentsSql, [userId, search, pageSize, offset]);
      const total = rows[0]?.total_rows ? Number(rows[0].total_rows) : 0;
      const items = rows.map((r) => ({
        projectId: r.project_id,
        projectName: r.project_name,
        status: r.status,
        startDate: r.start_date,
        dueDate: r.end_date || null,
        owner: r.owner_user_id
          ? { id: r.owner_user_id, name: r.owner_name, email: r.owner_email }
          : null,
        members: (r.members as any[])?.map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
        })) || [],
        myRole: r.my_role || null,
        taskCounts: {
          total: Number(r.tasks_total || 0),
          todo: Number(r.tasks_todo || 0),
          inProgress: Number(r.tasks_in_progress || 0),
          blocked: Number(r.tasks_blocked || 0),
          completed: Number(r.tasks_completed || 0),
          overdue: Number(r.tasks_overdue || 0),
        },
      }));

      if (total > 0) {
        return res.json({
          success: true,
          data: { items, total, page, pageSize },
        });
      }

      // Legacy work-spaces (webxl_work_space) until project_assignments is populated in modern DRM.
      const elevated = isManagerialRole(req.user.roleId);
      const userNameRow = await pool.query<{ display_name: string | null }>(
        `SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(name), ''), nullif(trim(email), '')) as display_name
           FROM drm.users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const userDisplayName = userNameRow.rows[0]?.display_name ?? "";

      const legacyAssignmentsSql = `
        WITH workspaces AS (
          SELECT ws._legacy_pk, trim(ws.name) AS name, ws.create_at
            FROM legacy_archive.webxl_work_space ws
           WHERE ws.type = 'work_space'
             AND (
               $2::boolean = true
               OR (
                 $3 <> ''
                 AND ws.name ILIKE ('%' || $3 || '%')
               )
             )
             AND ($1 = '' OR ws.name ILIKE ('%' || $1 || '%'))
        ),
        channels AS (
          SELECT
            c._legacy_pk AS channel_pk,
            trim(c.name) AS channel_name,
            w._legacy_pk AS workspace_pk,
            w.name AS workspace_name,
            w.create_at AS workspace_created_at,
            c.create_at AS channel_created_at
            FROM legacy_archive.webxl_work_space c
            JOIN workspaces w ON trim(w._legacy_pk) = trim(c.ref_id::text)
           WHERE c.type = 'channel'
             AND ($1 = '' OR c.name ILIKE ('%' || $1 || '%') OR w.name ILIKE ('%' || $1 || '%'))
        ),
        task_counts AS (
          SELECT trim(soft_task_cname) AS channel_name, count(*)::int AS total
            FROM legacy_archive.webxl_task_assign
           WHERE nullif(trim(soft_task_cname), '') IS NOT NULL
           GROUP BY 1
        ),
        ranked AS (
          SELECT
            ch.*,
            coalesce(tc.total, 0) AS tasks_total,
            count(*) OVER() AS total_rows
            FROM channels ch
            LEFT JOIN task_counts tc ON tc.channel_name = ch.channel_name
           ORDER BY ch.workspace_created_at DESC NULLS LAST, ch.channel_created_at ASC NULLS LAST
        )
        SELECT channel_pk, channel_name, workspace_pk, workspace_name, tasks_total, total_rows
          FROM ranked
         LIMIT $4::int OFFSET $5::int
      `;

      const legacyRows = await pool.query<{
        channel_pk: string;
        channel_name: string;
        workspace_pk: string;
        workspace_name: string;
        tasks_total: number;
        total_rows: string;
      }>(legacyAssignmentsSql, [search, elevated, userDisplayName, pageSize, offset]);

      const legacyTotal = legacyRows.rows[0]?.total_rows
        ? Number(legacyRows.rows[0].total_rows)
        : 0;
      const legacyItems = legacyRows.rows.map((r) => ({
        projectId: `${LEGACY_WS_CHANNEL_PREFIX}${r.channel_pk}`,
        projectName: r.channel_name,
        status: "Active",
        startDate: null,
        dueDate: null,
        owner: {
          id: `legacy-ws-${r.workspace_pk}`,
          name: r.workspace_name,
          email: null,
        },
        workspaceTitle: r.workspace_name,
        legacyWorkspace: true,
        members: [] as { id: string; name: string | null; email: string | null; role: string | null }[],
        myRole: null,
        taskCounts: {
          total: Number(r.tasks_total || 0),
          todo: Number(r.tasks_total || 0),
          inProgress: 0,
          blocked: 0,
          completed: 0,
          overdue: 0,
        },
      }));

      return res.json({
        success: true,
        data: {
          items: legacyItems,
          total: legacyTotal,
          page,
          pageSize,
          source: "legacy_work_space",
        },
      });
    } catch (error) {
      console.error("Error fetching team workspace assignments:", error);
      return res.status(500).json({ error: "Failed to fetch team workspace assignments" });
    }
  });

  // GET /api/pms/team-workspace - Get all user's project assignments
  app.get("/api/pms/team-workspace", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const assignments = await projectAssignmentsRepository.findByUserId(req.user.userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching team workspace:", error);
      res.status(500).json({ error: "Failed to fetch team workspace" });
    }
  });

  // POST /api/pms/team-members/batch - Get team members for multiple projects in one request
  app.post("/api/pms/team-members/batch", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const batchSchema = z.object({
        projectIds: z.array(z.string().uuid()).max(50),
      });

      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const teamMembers = await projectAssignmentsRepository.findByMultipleProjectIds(parsed.data.projectIds);
      res.json(teamMembers);
    } catch (error) {
      console.error("Error fetching batch team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // GET /api/pms/projects/:id/team - Get project team members
  app.get("/api/pms/projects/:id/team", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const team = await projectAssignmentsRepository.findByProjectId(req.params.id);
      res.json(team);
    } catch (error) {
      console.error("Error fetching project team:", error);
      res.status(500).json({ error: "Failed to fetch project team" });
    }
  });

  // POST /api/pms/projects/:id/team - Add team member
  app.post("/api/pms/projects/:id/team", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertProjectAssignmentSchema.parse({
        userId: _p.userId,
        role: _p.role,
        assignedAt: _p.assignedAt,
        projectId: req.params.id
      });

      // Check if already assigned
      const isAssigned = await projectAssignmentsRepository.isUserAssigned(
        req.params.id,
        validated.userId
      );

      if (isAssigned) {
        return res.status(400).json({ error: "User is already assigned to this project" });
      }

      const assignment = await projectAssignmentsRepository.create(validated);

      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error adding team member:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  // DELETE /api/pms/projects/:id/team/:assignmentId - Remove team member
  app.delete("/api/pms/projects/:id/team/:assignmentId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await projectAssignmentsRepository.remove(req.params.assignmentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // ===== TASK TIME LOGS =====

  // GET /api/pms/tasks/:id/time-logs - Get task time logs
  app.get("/api/pms/tasks/:id/time-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const taskId = req.params.id;
      const legacyAssignMatch = /^legacy-assign-(.+)$/.exec(taskId);
      if (legacyAssignMatch) {
        const assignLegacyId = legacyAssignMatch[1];
        const { rows } = await pool.query(
          `
          SELECT h._legacy_pk as id,
                 lower(coalesce(h.status, '')) as status,
                 h.create_at as "logDate",
                 coalesce(u.full_name, u.name, 'Employee') as "userName"
            FROM legacy_archive.webxl_task_log_history h
            LEFT JOIN migration_meta.migration_legacy_ids um
              ON um.legacy_table = 'webxl_user' AND um.legacy_id = trim(h.user_id)
            LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
           WHERE trim(h.task_id) = trim($1)
           ORDER BY h.create_at ASC
          `,
          [assignLegacyId],
        );

        const sessions: Array<{
          id: string;
          logDate: Date;
          timeSpentSeconds: number;
          timeSpentMinutes: number;
          description: string;
          user: { name: string };
        }> = [];
        let pendingStart: Date | null = null;
        let pendingUser = "Employee";

        for (const row of rows) {
          const at = row.logDate ? new Date(row.logDate) : null;
          if (!at || Number.isNaN(at.getTime())) continue;
          if (row.status === "start") {
            pendingStart = at;
            pendingUser = row.userName || "Employee";
          } else if (row.status === "stop" && pendingStart) {
            const secs = Math.max(0, Math.floor((at.getTime() - pendingStart.getTime()) / 1000));
            sessions.push({
              id: `legacy-session-${row.id}`,
              logDate: at,
              timeSpentSeconds: secs,
              timeSpentMinutes: Math.floor(secs / 60),
              description: "Legacy timer session",
              user: { name: pendingUser },
            });
            pendingStart = null;
          }
        }

        sessions.reverse();
        return res.json(sessions);
      }

      const logs = await taskTimeLogsRepository.findByTaskId(taskId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching time logs:", error);
      res.status(500).json({ error: "Failed to fetch time logs" });
    }
  });

  // POST /api/pms/tasks/:id/time-logs - Log time for task
  app.post("/api/pms/tasks/:id/time-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertTaskTimeLogSchema.parse({
        timeSpentMinutes: _p.timeSpentMinutes,
        description: _p.description,
        logDate: _p.logDate,
        taskId: req.params.id,
        userId: req.user.userId
      });

      const log = await taskTimeLogsRepository.create(validated);

      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error logging time:", error);
      res.status(500).json({ error: "Failed to log time" });
    }
  });

  // GET /api/pms/my-time-logs - Get user's time logs
  app.get("/api/pms/my-time-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { dateFrom, dateTo, limit } = req.query;
      const parsedLimit = Math.max(1, Math.min(200, parseInt((limit as string) || "50", 10)));

      const logs = await taskTimeLogsRepository.findScoped({
        userId: req.user.userId,
        roleId: req.user.roleId,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: parsedLimit,
      });
      res.json({
        items: logs,
        total: logs.length,
      });
    } catch (error) {
      console.error("Error fetching user time logs:", error);
      res.status(500).json({ error: "Failed to fetch time logs" });
    }
  });

  // ===== TASK STATUS HISTORY =====

  // GET /api/pms/tasks/:id/status-history - Get task status history
  app.get("/api/pms/tasks/:id/status-history", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const history = await taskStatusHistoryRepository.findByTaskId(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching status history:", error);
      res.status(500).json({ error: "Failed to fetch status history" });
    }
  });

  // GET /api/pms/task-history - Get recent task status changes (for Task History page)
  app.get("/api/pms/task-history", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { userId, dateFrom, dateTo, limit, page: pageRaw, pageSize: pageSizeRaw, filter } = req.query;
      const changingOnly = String(filter || "").toLowerCase() === "changing";
      const userRole = req.user.roleId || (req.user as any).role || "";
      const roleLower = String(userRole).toLowerCase();
      const isOrgAdmin = ["admin", "super_admin", "super_hod"].includes(roleLower);
      const page = Math.max(1, parseInt(pageRaw as string, 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(10, parseInt(pageSizeRaw as string, 10) || parseInt(limit as string, 10) || 50),
      );
      const usePagination = Boolean(pageRaw) || Boolean(pageSizeRaw) || isOrgAdmin;
      const limitNum = Math.min(1000, Math.max(1, parseInt(limit as string, 10) || pageSize));

      if (isOrgAdmin) {
        const legacyPage = await fetchAdminLegacyTaskHistoryPage(page, pageSize, changingOnly);
        return res.json({
          items: legacyPage.items,
          total: legacyPage.total,
          page,
          pageSize,
          hasMore: legacyPage.hasMore,
        });
      }

      let history: any[];
      if (isManagerialRole(userRole) && !userId) {
        // A manager's "Completed Projects" list must cover their whole
        // department, not just tasks they personally own/are assigned to —
        // the task a manager just Approved in "Pending My Review" is very
        // often neither (a different manager assigned it, or an admin
        // created it), so the plain owner-or-assignee filter below silently
        // excluded exactly the rows a manager most needs to see here. Same
        // department-scoping approach as /api/pms/tasks/pending-review.
        const userRes = await pool.query("SELECT department FROM drm.users WHERE id = $1", [req.user.userId]);
        const userDept = userRes.rows[0]?.department || "";
        const roleLower = String(userRole).toLowerCase();
        const isQaRole = roleLower === "qa_manager" || roleLower.startsWith("qa_");
        const isVerificationRole = roleLower.includes("verification");
        const deptCandidates = departmentCandidatesForRole(roleLower, userDept);
        const isDeptBoundManager = deptCandidates.length > 0 && !["admin", "super_admin", "super_hod"].includes(roleLower);
        const deptFilter = isDeptBoundManager
          ? `AND p.department_type IN (${deptCandidates.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`
          : "";

        const params: any[] = [];
        let dateFilter = "";
        if (dateFrom) { params.push(new Date(dateFrom as string)); dateFilter += ` AND h.changed_at >= $${params.length}`; }
        if (dateTo) { params.push(new Date(dateTo as string)); dateFilter += ` AND h.changed_at <= $${params.length}`; }
        params.push(limitNum);

        // Sequence gates on the history query itself so QA never even loads
        // manager-pending rows, and VM never loads pre-QA-handoff rows.
        let stageFilter = "";
        if (isQaRole) {
          stageFilter = ` AND (t.sent_to_qa_at IS NOT NULL OR t.qa_reviewed_at IS NOT NULL
            OR (t.status = 'Blocked' AND EXISTS (
              SELECT 1 FROM drm.task_status_history hx
               WHERE hx.task_id = t.id AND hx.to_status = 'Blocked'
                 AND (hx.notes LIKE '%"qaReturn":true%' OR hx.notes LIKE '%"verificationReturn":true%')
            )))`;
        } else if (isVerificationRole) {
          stageFilter = ` AND t.qa_reviewed_at IS NOT NULL`;
        }

        const { rows } = await pool.query(
          `SELECT
             h.id, h.task_id as "taskId", h.user_id as "userId",
             h.from_status as "fromStatus", h.to_status as "toStatus",
             h.changed_at as "changedAt", h.notes,
             t.id as "taskTaskId", t.title as "taskTitle",
             t.owner_user_id as "taskOwnerUserId", t.assigned_to_user_id as "taskAssignedToUserId",
             u.id as "userUserId", u.name as "userName"
           FROM drm.task_status_history h
           JOIN drm.tasks t ON t.id = h.task_id
           JOIN drm.projects p ON p.id = t.project_id
           JOIN drm.users u ON u.id = h.user_id
           WHERE 1=1 ${deptFilter} ${stageFilter} ${dateFilter}
           ORDER BY h.changed_at DESC
           LIMIT $${params.length}`,
          params,
        );
        history = rows.map((r: any) => ({
          id: r.id, taskId: r.taskId, userId: r.userId,
          fromStatus: r.fromStatus, toStatus: r.toStatus, changedAt: r.changedAt, notes: r.notes,
          task: { id: r.taskTaskId, title: r.taskTitle, ownerUserId: r.taskOwnerUserId, assignedToUserId: r.taskAssignedToUserId },
          user: { id: r.userUserId, name: r.userName },
        }));
      } else {
        const filters: any = { limit: limitNum };
        // Default to the caller's own id when the page doesn't explicitly ask
        // for someone else's history — matches the sibling /task-history/summary
        // and /task-history/status-changes endpoints below, which already do
        // this. Without the default, findRecent()'s "only filter if userId is
        // set" guard never fired, so every non-admin role saw the full org-wide
        // feed regardless of role.
        filters.userId = (userId as string) || req.user.userId;
        filters.roleId = req.user.roleId;
        if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
        if (dateTo) filters.dateTo = new Date(dateTo as string);
        history = await taskStatusHistoryRepository.findRecent(filters);
      }

      // Enrich with the company name behind each task's project (invoice's
      // customer, falling back to the invoice/project name) — the history
      // rows themselves carry no company info. Also enrich with the task's
      // real total time spent (summed from task_time_logs, the same rows
      // the timer start/stop endpoints create) — the "Spent" column used to
      // just show the status-change timestamp, not an actual duration.
      const taskIds = Array.from(new Set(history.map((h) => h.task?.id).filter(Boolean)));
      let companyByTaskId: Record<string, string> = {};
      let minutesByTaskId: Record<string, number> = {};
      let sentToQaByTaskId: Record<string, string | null> = {};
      let qaReviewedAtByTaskId: Record<string, string | null> = {};
      // The task's CURRENT status, as opposed to `toStatus` above (which is
      // frozen at whatever this specific history row's transition was — e.g.
      // a QA-return row's toStatus is always "Blocked", forever, even after
      // the manager has since reassigned it back to the executive). The
      // "Assign to Exec" / "Send to QA" buttons need to know whether that's
      // already happened so they can stop showing once it has.
      let currentStatusByTaskId: Record<string, string | null> = {};
      // Set once a Verification Manager has ALSO reviewed the task (a step
      // downstream of QA) — such a task is fully closed and "graduates" out
      // of this list into GET /api/pms/complete-closed-projects instead.
      let verificationReviewedAtByTaskId: Record<string, string | null> = {};
      // Only Product Posting tasks actually run through QA/Verification —
      // every other department's manager approval is the final step, so
      // their "fully closed" test below can't wait on a review stage that
      // will never happen for them.
      let deptTypeByTaskId: Record<string, string | null> = {};
      // Per-link QA progress for Product Posting (approved / total / pending).
      let linkStatsByTaskId: Record<string, { approved: number; total: number; pending: number }> = {};
      if (taskIds.length > 0) {
        const [companyRows, timeRows, qaRows, statusRows, verificationRows, deptRows, linkRows] = await Promise.all([
          pool.query(
            `SELECT t.id AS task_id, COALESCE(c.company_name, inv.company_name, p.name) AS company
               FROM drm.tasks t
               LEFT JOIN drm.projects p ON p.id = t.project_id
               LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
               LEFT JOIN drm.customers c ON c.id = COALESCE(p.customer_id, inv.customer_id)
              WHERE t.id = ANY($1::uuid[])`,
            [taskIds],
          ),
          pool.query(
            // task_time_logs.duration_minutes is what the Drizzle schema's
            // timeSpentMinutes field actually maps to (the physical table
            // also has an unrelated, always-zero legacy time_spent_minutes
            // column — not this one).
            `SELECT task_id, COALESCE(SUM(duration_minutes), 0) AS minutes
               FROM drm.task_time_logs
              WHERE task_id = ANY($1::uuid[])
              GROUP BY task_id`,
            [taskIds],
          ),
          pool.query(
            `SELECT id AS task_id, sent_to_qa_at, qa_reviewed_at FROM drm.tasks WHERE id = ANY($1::uuid[])`,
            [taskIds],
          ),
          pool.query(
            `SELECT id AS task_id, status FROM drm.tasks WHERE id = ANY($1::uuid[])`,
            [taskIds],
          ),
          pool.query(
            `SELECT id AS task_id, verification_reviewed_at FROM drm.tasks WHERE id = ANY($1::uuid[])`,
            [taskIds],
          ),
          pool.query(
            `SELECT t.id AS task_id, p.department_type
               FROM drm.tasks t
               LEFT JOIN drm.projects p ON p.id = t.project_id
              WHERE t.id = ANY($1::uuid[])`,
            [taskIds],
          ),
          pool.query(
            `SELECT task_id,
                    count(*)::int AS total,
                    count(*) FILTER (WHERE qa_status = 'approved')::int AS approved
               FROM drm.task_files
              WHERE task_id = ANY($1::uuid[])
                AND file_url IS NULL
                AND description IS NOT NULL
                AND description <> ''
              GROUP BY task_id`,
            [taskIds],
          ),
        ]);
        companyByTaskId = companyRows.rows.reduce((acc: Record<string, string>, row: any) => {
          acc[row.task_id] = row.company;
          return acc;
        }, {});
        minutesByTaskId = timeRows.rows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.task_id] = Number(row.minutes) || 0;
          return acc;
        }, {});
        sentToQaByTaskId = qaRows.rows.reduce((acc: Record<string, string | null>, row: any) => {
          acc[row.task_id] = row.sent_to_qa_at;
          return acc;
        }, {});
        qaReviewedAtByTaskId = qaRows.rows.reduce((acc: Record<string, string | null>, row: any) => {
          acc[row.task_id] = row.qa_reviewed_at;
          return acc;
        }, {});
        currentStatusByTaskId = statusRows.rows.reduce((acc: Record<string, string | null>, row: any) => {
          acc[row.task_id] = row.status;
          return acc;
        }, {});
        verificationReviewedAtByTaskId = verificationRows.rows.reduce((acc: Record<string, string | null>, row: any) => {
          acc[row.task_id] = row.verification_reviewed_at;
          return acc;
        }, {});
        deptTypeByTaskId = deptRows.rows.reduce((acc: Record<string, string | null>, row: any) => {
          acc[row.task_id] = row.department_type;
          return acc;
        }, {});
        linkStatsByTaskId = linkRows.rows.reduce((acc: Record<string, { approved: number; total: number; pending: number }>, row: any) => {
          const total = Number(row.total) || 0;
          const approved = Number(row.approved) || 0;
          acc[row.task_id] = { approved, total, pending: Math.max(0, total - approved) };
          return acc;
        }, {});
      }

      const enriched = history.map((h) => ({
        ...h,
        company: h.task?.id ? companyByTaskId[h.task.id] ?? null : null,
        timeSpentMinutes: h.task?.id ? minutesByTaskId[h.task.id] ?? 0 : 0,
        currentStatus: h.task?.id ? currentStatusByTaskId[h.task.id] ?? null : null,
        sentToQaAt: h.task?.id ? sentToQaByTaskId[h.task.id] ?? null : null,
        qaReviewedAt: h.task?.id ? qaReviewedAtByTaskId[h.task.id] ?? null : null,
        verificationReviewedAt: h.task?.id ? verificationReviewedAtByTaskId[h.task.id] ?? null : null,
        departmentType: h.task?.id ? deptTypeByTaskId[h.task.id] ?? null : null,
        linkApprovedQty: h.task?.id ? linkStatsByTaskId[h.task.id]?.approved ?? 0 : 0,
        linkTotalQty: h.task?.id ? linkStatsByTaskId[h.task.id]?.total ?? 0 : 0,
        linkPendingQty: h.task?.id ? linkStatsByTaskId[h.task.id]?.pending ?? 0 : 0,
      }));

      // This feed is one row per status-history EVENT, so a single task that
      // cycles through review more than once (submit -> QA return -> reassign
      // -> resubmit -> approve) accumulates a new row on every transition —
      // from the "Completed Projects" table it looks like several different
      // entries for the same project instead of one continuing one. Collapse
      // to the single latest row per task, and only keep tasks currently at
      // rest in Completed (ready for/already sent to QA) or Blocked (waiting
      // on reassignment) — a task back in ToDo/InProgress/READY_FOR_QA is
      // "in flight" again and belongs in Task System / Pending My Review,
      // not here.
      // The QA reviewer's comment lives on whichever historical row was the
      // "Completed -> Blocked, qaReturn" event — which is usually NOT the
      // latest row once the executive has fixed it up and resubmitted. Look
      // it up separately per task so it keeps showing even after the row
      // that carried it is no longer the one displayed.
      const latestQaCommentByTaskId = new Map<string, { reason: string; changedAt: any }>();
      // Same idea, for Verification's own "return" events (verificationReturn,
      // see POST /api/product-posting/tasks/:id/verification-review) — the
      // "VM Comment" column needs the same keep-showing-after-resubmit
      // behavior the QA comment already has.
      const latestVmCommentByTaskId = new Map<string, { reason: string; changedAt: any }>();
      for (const row of enriched) {
        const taskId = row.task?.id;
        if (!taskId || !row.notes) continue;
        try {
          const parsed = JSON.parse(row.notes);
          if (parsed.qaReturn && parsed.reason) {
            const existing = latestQaCommentByTaskId.get(taskId);
            if (!existing || new Date(row.changedAt).getTime() > new Date(existing.changedAt).getTime()) {
              latestQaCommentByTaskId.set(taskId, { reason: parsed.reason, changedAt: row.changedAt });
            }
          }
          if (parsed.verificationReturn && parsed.reason) {
            const existing = latestVmCommentByTaskId.get(taskId);
            if (!existing || new Date(row.changedAt).getTime() > new Date(existing.changedAt).getTime()) {
              latestVmCommentByTaskId.set(taskId, { reason: parsed.reason, changedAt: row.changedAt });
            }
          }
        } catch {
          // Not JSON — not a QA/Verification-return note.
        }
      }

      const latestByTaskId = new Map<string, (typeof enriched)[number] & { qaComment?: string | null; vmComment?: string | null }>();
      for (const row of enriched) {
        const taskId = row.task?.id;
        if (!taskId) continue;
        if (row.currentStatus !== "Completed" && row.currentStatus !== "Blocked") continue;
        // Product Posting reaches this via QA + Verification; every other
        // department reaches it via the manager's own "Closed Task" button
        // (POST /api/pms/tasks/:id/close, below) — either way,
        // verification_reviewed_at being set means fully closed, graduated
        // to /api/pms/complete-closed-projects instead of showing here.
        if (row.verificationReviewedAt) continue;
        const existing = latestByTaskId.get(taskId);
        if (!existing || new Date(row.changedAt).getTime() > new Date(existing.changedAt).getTime()) {
          latestByTaskId.set(taskId, {
            ...row,
            qaComment: latestQaCommentByTaskId.get(taskId)?.reason ?? null,
            vmComment: latestVmCommentByTaskId.get(taskId)?.reason ?? null,
          });
        }
      }
      let deduped = Array.from(latestByTaskId.values()).sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
      );

      if (changingOnly) {
        deduped = deduped.filter((row) => taskHistoryRowNeedsChanging(row));
      }


      if (usePagination) {
        const start = (page - 1) * pageSize;
        const slice = deduped.slice(start, start + pageSize);
        return res.json({
          items: slice,
          total: deduped.length,
          page,
          pageSize,
          hasMore: start + slice.length < deduped.length,
        });
      }

      res.json(deduped);
    } catch (error) {
      console.error("Error fetching task history:", error);
      res.status(500).json({ error: "Failed to fetch task history" });
    }
  });

  // GET /api/pms/complete-closed-projects — tasks that have finished the
  // WHOLE review pipeline (executive -> manager approve -> QA -> Verification),
  // i.e. drm.tasks.verification_reviewed_at is set. These "graduate" out of
  // /api/pms/task-history (see the verificationReviewedAt exclusion above)
  // into this dedicated, manager-only report instead. Department-scoped the
  // same way /api/pms/task-history's own manager branch is.
  app.get("/api/pms/complete-closed-projects", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userRole = req.user.roleId || (req.user as any).role || "";
      if (!isManagerialRole(userRole)) {
        return res.status(403).json({ error: "Only managers can view this report." });
      }

      const userRes = await pool.query("SELECT department FROM drm.users WHERE id = $1", [req.user.userId]);
      const userDept = userRes.rows[0]?.department || "";
      const deptCandidates = departmentCandidatesForRole(userRole, userDept);
      // Verification manager (and admin/super_admin/super_hod) see every
      // department's closed projects — that's the whole point of the role.
      const isDeptBoundManager = deptCandidates.length > 0
        && !["admin", "super_admin", "super_hod", "hod", "verification_manager"].includes(userRole);
      const deptFilter = isDeptBoundManager
        ? `AND p.department_type IN (${deptCandidates.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`
        : "";

      const limitNum = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const { rows } = await pool.query(`
        SELECT
          t.id as "taskId",
          COALESCE(t.title, p.name) as title,
          COALESCE(t.status::text, p.status::text) as status,
          COALESCE(t.qa_reviewed_at, wf.qa_reviewed_at) as "qaReviewedAt",
          t.qa_level as "qaLevel",
          t.qa_remarks as "qaRemarks",
          COALESCE(t.verification_reviewed_at, wf.verification_reviewed_at, wf.updated_at) as "verificationReviewedAt",
          t.verification_level as "verificationLevel",
          COALESCE(t.verification_remarks, wf.verification_remarks) as "verificationRemarks",
          COALESCE(c.company_name, inv.company_name, rinv.customer_name, p.name) as "companyName",
          p.name as "projectName",
          COALESCE(
            (
              SELECT mli.legacy_id
              FROM migration_meta.migration_legacy_ids mli
              WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text
              LIMIT 1
            ),
            NULLIF(p.project_number, '')
          ) as "projectNumber",
          jsonb_build_object('id', au.id, 'name', COALESCE(au.full_name, au.name, au.username)) as "executive",
          (SELECT COALESCE(SUM(duration_minutes), 0) FROM drm.task_time_logs WHERE task_id = t.id) as "timeSpentMinutes"
        FROM drm.projects p
        LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
        LEFT JOIN LATERAL (
          SELECT t2.*
            FROM drm.tasks t2
           WHERE t2.project_id = p.id
             AND COALESCE(t2.is_deleted, false) = false
           ORDER BY t2.verification_reviewed_at DESC NULLS LAST, t2.updated_at DESC NULLS LAST
           LIMIT 1
        ) t ON true
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices inv
          ON inv.id::text = COALESCE(p.invoice_id::text, p.legacy_source_id)
        LEFT JOIN drm.invoices rinv ON rinv.id::text = p.legacy_source_id
        LEFT JOIN drm.users au ON au.id = t.assigned_to_user_id
        WHERE COALESCE(p.is_deleted, false) = false
          AND (
            (t.id IS NOT NULL AND t.verification_reviewed_at IS NOT NULL)
            OR wf.verification_reviewed_at IS NOT NULL
            OR wf.current_phase IN ('VERIFICATION_COMPLETE', 'COMPLETED', 'DELIVERED', 'CLOSED')
          )
          ${deptFilter}
        ORDER BY COALESCE(t.verification_reviewed_at, wf.verification_reviewed_at, wf.updated_at) DESC NULLS LAST
        LIMIT $1
      `, [limitNum]);

      // Old DRM: tasks that finished the whole pipeline there — executive ended it, manager sent it
      // on, QA reviewed (qa_status 1) and VM closed it with the client (fy_status 1). Read-only.
      const { rows: legacyRows } = await pool.query(`
        SELECT
          'legacy-assign-' || a._legacy_pk AS "taskId",
          coalesce(nullif(trim(tl.name), ''), nullif(trim(a.soft_task_name), ''), 'Task ' || coalesce(a.task_id, a._legacy_pk)) AS title,
          'Completed' AS status,
          migration_meta.mig_ts(a.qa_date) AS "qaReviewedAt",
          NULL::text AS "qaLevel",
          nullif(trim(coalesce(a.qa_com, '')), '') AS "qaRemarks",
          migration_meta.mig_ts(a.fy_date) AS "verificationReviewedAt",
          NULL::text AS "verificationLevel",
          nullif(trim(coalesce(a.fy_com, a.fy_fdb, '')), '') AS "verificationRemarks",
          COALESCE(c.company_name, inv.company_name, p.name) AS "companyName",
          p.name AS "projectName",
          a.pro_id AS "projectNumber",
          jsonb_build_object('id', u.id, 'name', COALESCE(u.full_name, u.name, u.username)) AS executive,
          nullif(trim(coalesce(a."totalTimespent", a.timespent, '')), '') AS dur_text,
          coalesce(nullif(regexp_replace(trim(coalesce(a.hours, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_hours,
          coalesce(nullif(regexp_replace(trim(coalesce(a.min, '')), '[^0-9]', '', 'g'), '')::int, 0) AS dur_min
        FROM (
          SELECT * FROM legacy_archive.webxl_task_assign
           WHERE _source_table = 'webxl_task_assign'
             AND lower(trim(coalesce(stauts, ''))) = 'end'
             AND trim(coalesce(qa_status, '')) = '1'
             AND trim(coalesce(fy_status, '')) = '1'
        ) a
        JOIN migration_meta.migration_legacy_ids pm
          ON pm.entity_type = 'create_project_row' AND pm.legacy_table = 'webxl_create_project'
         AND pm.legacy_id = a.pro_id AND pm.modern_table = 'projects'
        JOIN drm.projects p ON p.id = pm.modern_id::uuid
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
        LEFT JOIN legacy_archive.webxl_tasks_list tl
          ON tl._source_table = 'webxl_tasks_list' AND tl._legacy_pk = trim(a.task_id)
        LEFT JOIN migration_meta.migration_legacy_ids um
          ON um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = trim(a.user_id)
        LEFT JOIN drm.users u ON u.id = um.modern_id::uuid
        WHERE COALESCE(p.is_deleted, false) = false
          ${deptFilter}
      `);
      const legacy = legacyRows.map(({ dur_text, dur_hours, dur_min, ...r }: any) => ({
        ...r,
        timeSpentMinutes: legacyAssignDurationMinutes(dur_text, Number(dur_hours) || 0, Number(dur_min) || 0),
        legacyReadOnly: true,
      }));
      const time = (v: any) => (v ? new Date(v).getTime() : 0);
      res.json([...rows, ...legacy].sort((a, b) => time(b.verificationReviewedAt) - time(a.verificationReviewedAt)));
    } catch (error) {
      console.error("Error fetching complete-closed projects:", error);
      res.status(500).json({ error: "Failed to fetch complete-closed projects" });
    }
  });

  // GET /api/pms/task-history/summary - aggregated cards
  app.get("/api/pms/task-history/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { from, to } = parseDateRangeWithDefault(
        req.query.from as string | undefined,
        req.query.to as string | undefined,
        7
      );

      const history = await taskStatusHistoryRepository.findRecent({
        userId: req.user.userId,
        roleId: req.user.roleId,
        dateFrom: from,
        dateTo: to,
        limit: 500,
      });

      const timeLogs = await taskTimeLogsRepository.findScoped({
        userId: req.user.userId,
        roleId: req.user.roleId,
        dateFrom: from,
        dateTo: to,
        limit: 500,
      });

      const statusChangesCount = history.length;
      const timeLoggedMinutes = timeLogs.reduce((sum, l) => sum + (Number(l.timeSpentMinutes) || 0), 0);
      const timeLogEntries = timeLogs.length;
      const completedTasksCount = history.filter((h) => (h.toStatus || "").toLowerCase() === "completed").length;

      res.json({
        from,
        to,
        statusChangesCount,
        timeLoggedMinutes,
        timeLogEntries,
        completedTasksCount,
      });
    } catch (error) {
      console.error("Error fetching task history summary:", error);
      res.status(500).json({ error: "Failed to fetch task history summary" });
    }
  });

  // GET /api/pms/task-history/status-changes - paginated list
  app.get("/api/pms/task-history/status-changes", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const limit = Math.max(1, Math.min(200, parseInt((req.query.limit as string) || "25", 10)));
      const { from, to } = parseDateRangeWithDefault(
        req.query.from as string | undefined,
        req.query.to as string | undefined,
        7
      );

      const items = await taskStatusHistoryRepository.findRecent({
        userId: req.user.userId,
        roleId: req.user.roleId,
        dateFrom: from,
        dateTo: to,
        limit,
      });

      res.json({ items, total: items.length });
    } catch (error) {
      console.error("Error fetching status changes:", error);
      res.status(500).json({ error: "Failed to fetch status changes" });
    }
  });

  // GET /api/pms/task-history/time-logs - paginated list
  app.get("/api/pms/task-history/time-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const limit = Math.max(1, Math.min(200, parseInt((req.query.limit as string) || "25", 10)));
      const { from, to } = parseDateRangeWithDefault(
        req.query.from as string | undefined,
        req.query.to as string | undefined,
        7
      );

      const items = await taskTimeLogsRepository.findScoped({
        userId: req.user.userId,
        roleId: req.user.roleId,
        dateFrom: from,
        dateTo: to,
        limit,
      });

      res.json({ items: items.slice(0, limit), total: items.length });
    } catch (error) {
      console.error("Error fetching time logs:", error);
      res.status(500).json({ error: "Failed to fetch time logs" });
    }
  });

  // POST /api/pms/tasks/:id/status-history - Record status change manually
  app.post("/api/pms/tasks/:id/status-history", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertTaskStatusHistorySchema.parse({
        fromStatus: _p.fromStatus,
        toStatus: _p.toStatus,
        changedAt: _p.changedAt,
        notes: _p.notes,
        taskId: req.params.id,
        userId: req.user.userId
      });

      const record = await taskStatusHistoryRepository.create(validated);

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error recording status change:", error);
      res.status(500).json({ error: "Failed to record status change" });
    }
  });

  // ===== TASK TEMPLATES ENDPOINTS =====

  // GET /api/pms/task-templates - Get all task templates
  app.get("/api/pms/task-templates", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { department } = req.query;
      const templates = await taskTemplatesRepository.findAll(department as string | undefined);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching task templates:", error);
      res.status(500).json({ error: "Failed to fetch task templates" });
    }
  });

  // GET /api/pms/task-templates/:id - Get single task template
  app.get("/api/pms/task-templates/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const template = await taskTemplatesRepository.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Task template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching task template:", error);
      res.status(500).json({ error: "Failed to fetch task template" });
    }
  });

  // POST /api/pms/task-templates - Create new task template
  app.post("/api/pms/task-templates", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const _p = typeof req.body === 'object' && req.body !== null ? req.body : {};
      const validated = insertTaskTemplateSchema.parse({
        name: _p.name,
        time: _p.time,
        detail: _p.detail,
        repeatDaily: _p.repeatDaily,
        department: _p.department,
        isActive: _p.isActive,
        createdByUserId: req.user.userId
      });

      const template = await taskTemplatesRepository.create(validated);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating task template:", error);
      res.status(500).json({ error: "Failed to create task template" });
    }
  });

  // PATCH /api/pms/task-templates/:id - Update task template
  app.patch("/api/pms/task-templates/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validated = updateTaskTemplateSchema.parse(req.body);
      const template = await taskTemplatesRepository.update(req.params.id, validated);
      if (!template) {
        return res.status(404).json({ error: "Task template not found" });
      }
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating task template:", error);
      res.status(500).json({ error: "Failed to update task template" });
    }
  });

  // DELETE /api/pms/task-templates/:id - Delete task template (soft delete)
  app.delete("/api/pms/task-templates/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const success = await taskTemplatesRepository.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Task template not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task template:", error);
      res.status(500).json({ error: "Failed to delete task template" });
    }
  });

  // ===== SETTINGS ENDPOINTS =====

  // GET /api/pms/settings - Get PMS settings
  app.get("/api/pms/settings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Most fields below are still stub defaults awaiting a real settings
      // table. projectCreationMode is real: it reads the same
      // drm.gm_sales_workflow_config "projectGenerationMode" key that already
      // gates auto-project-creation on invoice approval (see
      // server/routes/invoice-routes.ts and server/services/invoice-workflow.service.ts).
      const mode = await getConfigValue("projectGenerationMode");
      const projectCreationMode = mode === PROJECT_GENERATION_MODE.AUTOMATIC ? "Automatic" : "Manual";

      const settings = {
        projectPrefix: "PRJ",
        taskPrefix: "TSK",
        defaultPriority: "medium",
        autoAssignment: false,
        notificationsEnabled: true,
        maxTasksPerUser: 10,
        projectCreationMode,
      };

      res.json(settings);
    } catch (error) {
      console.error("Error fetching PMS settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // POST /api/pms/settings - Update PMS settings
  app.post("/api/pms/settings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only projectCreationMode is actually persisted today; other fields
      // are still stubs (see GET handler above) and are just echoed back.
      let projectCreationMode: "Manual" | "Automatic" | undefined;
      if (req.body?.projectCreationMode === "Automatic" || req.body?.projectCreationMode === "Manual") {
        if (!isManagerialRole((req.user as any).activeRoleId || (req.user as any).roleId)) {
          return res.status(403).json({ error: "Only managerial/admin roles may change the project creation trigger" });
        }
        const { config } = await patchConfig(
          {
            projectGenerationMode:
              req.body.projectCreationMode === "Automatic"
                ? PROJECT_GENERATION_MODE.AUTOMATIC
                : PROJECT_GENERATION_MODE.MANUAL,
          },
          (req.user as any).userId,
        );
        projectCreationMode = config.projectGenerationMode === PROJECT_GENERATION_MODE.AUTOMATIC ? "Automatic" : "Manual";
      }

      console.log("[PMS Settings] Updated:", req.body);

      res.json({ success: true, settings: { ...req.body, ...(projectCreationMode ? { projectCreationMode } : {}) } });
    } catch (error) {
      console.error("Error updating PMS settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // GET /api/pms/department-assignments — legacy webxl_department PMS distribute grid
  app.get("/api/pms/department-assignments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const data = await listPmsDepartmentAssignments(pool);
      res.json(data);
    } catch (error) {
      console.error("Error fetching PMS department assignments:", error);
      res.status(500).json({ error: "Failed to fetch department assignments" });
    }
  });

  // POST /api/pms/department-assignment - Save department assignment (legacy ms_depart_id)
  app.post("/api/pms/department-assignment", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!isManagerialRole((req.user as any).activeRoleId || (req.user as any).roleId)) {
        return res.status(403).json({ error: "Only managerial roles may update PMS department assignment" });
      }

      const departmentId =
        req.body?.departmentId != null
          ? String(req.body.departmentId)
          : req.body?.ms_depart_id != null
            ? String(req.body.ms_depart_id)
            : "";
      const ratio = req.body?.ratio != null ? String(req.body.ratio) : "0:0";
      let userIds: string[] = [];
      if (Array.isArray(req.body?.userIds)) {
        userIds = req.body.userIds.map((x: unknown) => String(x).trim()).filter(Boolean);
      } else if (Array.isArray(req.body?.user_list)) {
        userIds = req.body.user_list.map((x: unknown) => String(x).trim()).filter(Boolean);
      } else if (typeof req.body?.assign === "string" && req.body.assign.trim()) {
        userIds = req.body.assign.split(",").map((x: string) => x.trim()).filter(Boolean);
      }

      if (!departmentId) {
        return res.status(400).json({ error: "departmentId is required" });
      }

      const saved = await savePmsDepartmentAssignment(pool, { departmentId, userIds, ratio });
      if (!saved.ok) {
        const status = saved.error === "Department not found" ? 404 : 400;
        return res.status(status).json({ error: saved.error ?? "Failed to save" });
      }

      const data = await listPmsDepartmentAssignments(pool);
      res.json({ success: true, departmentId, ratio, userIds, ...data });
    } catch (error) {
      console.error("Error saving department assignment:", error);
      res.status(500).json({ error: "Failed to save assignment" });
    }
  });

  // GET /api/pms/department-stats - backward-compatible alias for assignment grid
  app.get("/api/pms/department-stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const data = await listPmsDepartmentAssignments(pool);
      res.json(data);
    } catch (error) {
      console.error("Error fetching department stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
}


