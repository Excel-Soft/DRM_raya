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
import { pool } from "../db";
import { NotificationService } from "./services/notification-service";
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
      let roleFilter = "";
      if (userRole === "dd_manager" || userRole === "d_d_manager" || userRole === "dd_executive" || userRole === "d_d_executive") {
          roleFilter = "AND (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%product posting%')";
      } else if (userRole === "software_manager" || userRole === "software_executive") {
          roleFilter = "AND NOT (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini-site%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%mini-site%' OR i.project_name ILIKE '%mini site%' OR i.project_name ILIKE '%product posting%')";
      } else if (userRole === "sales_executive") {
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole === "sales_manager") {
          // Self-only — never team/org data (explicit product decision).
          // getDepartmentFilterUserIds is a stub that always returns null,
          // which this branch used to misread as "global admin" and fall
          // through to unfiltered/org-wide for every Sales Manager.
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      }

      const { rows } = await pool.query(`
        SELECT
          p.id,
          p.project_number as "projectNumber",
          COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), i.project_name, p.name) as project,
          COALESCE(c.company_name, i.company_name, 'Unknown') as company, 
          p.status, 
          u.full_name as person, 
          p.created_at as date,
          COALESCE(fin.total_amount, 0) as "amount",
          COALESCE(i.hod_approved_at, CASE WHEN i.status IN ('PENDING_ACCOUNT', 'APPROVED', 'PAID') THEN i.updated_at END) as "hodApprovedAt",
          COALESCE(i.accounts_approved_at, CASE WHEN i.status IN ('APPROVED', 'PAID') THEN i.updated_at END) as "accountsApprovedAt",
          wf.data_verified_at as "verifiedAt",
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
           ORDER BY created_at DESC LIMIT 1) as "reuploadedDocId"
        FROM drm.projects p
        LEFT JOIN drm.customers c ON c.id = p.customer_id
        LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
        LEFT JOIN drm.users u ON u.id = p.owner_user_id
        LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
        LEFT JOIN drm.project_payments pay ON pay.project_id = p.id
        LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
        -- OnHold is included: a project only lands there via the Listing-Page-QA
        -- dependency gate, which blocks TASK ASSIGNMENT (see
        -- assertProductPostingDependencySatisfied), not the initial document
        -- upload — /api/projects/:id/documents has no status check at all, so
        -- the sales exec should still be able to upload here while it's held.
        WHERE (p.status = 'Documents Pending' OR p.status = 'Active' OR p.status = 'OnHold')
        AND ($1::uuid IS NULL OR p.owner_user_id = $1::uuid)
        ${roleFilter}
        AND coalesce(p.is_deleted, false) = false
        ORDER BY p.project_number::int ASC
      `, [scopeUserId]);
      
      // Add sentToManager flag for client display
      const enriched = rows.map(r => ({
        ...r,
        sentToManager: !!r.reuploadedDocId
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
      
      const userRole = req.user.roleId || (req.user as any).role || '';
      let roleFilter = "";
      if (userRole === "dd_manager" || userRole === "d_d_manager") {
          roleFilter = "AND (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%product posting%')";
      } else if (userRole === "dd_executive" || userRole === "d_d_executive") {
          roleFilter = `AND (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%product posting%') AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${req.user.userId}')`;
      } else if (userRole === "product_posting_executive" || userRole === "posting_executive" || userRole === "design_executive" || userRole === "developer_executive") {
          roleFilter = `AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${req.user.userId}')`;
      } else if (userRole === "software_manager" || userRole === "qa_manager" || userRole === "verification_manager") {
          roleFilter = "AND NOT (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini-site%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%mini-site%' OR i.project_name ILIKE '%mini site%' OR i.project_name ILIKE '%product posting%')";
      } else if (userRole === "software_executive") {
          roleFilter = `AND NOT (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR p.name ILIKE '%mini-site%' OR p.name ILIKE '%mini site%' OR p.name ILIKE '%product posting%' OR i.project_name ILIKE '%listing%' OR i.project_name ILIKE '%minisite%' OR i.project_name ILIKE '%mini-site%' OR i.project_name ILIKE '%mini site%' OR i.project_name ILIKE '%product posting%') AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${req.user.userId}')`;
      } else if (userRole === "sales_executive") {
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
      } else if (userRole === "sales_manager") {
          // Self-only — never team/org data (explicit product decision).
          // getDepartmentFilterUserIds is a stub that always returns null,
          // which this branch used to misread as "global admin" and fall
          // through to unfiltered/org-wide for every Sales Manager.
          roleFilter = `AND p.owner_user_id = '${req.user.userId}'`;
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
        params.push(`%${department.trim()}%`);
        extraFilter += ` AND u.department ILIKE $${params.length}`;
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

      const { rows } = await pool.query(`
        SELECT
          p.id,
          COALESCE(i.company_name, c.company_name, 'Unknown') as "company",
          COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), i.project_name, p.name) as "project",
          p.status,
          u.name as "assign",
          u.department as "department",
          c.city as "city",
          p.created_at as "date",
          COALESCE(fin.total_amount, 0) as "amount",
          i.status as "invoiceStatus",
          (SELECT COUNT(*) FROM drm.tasks t WHERE t.project_id = p.id) as "totalTasks",
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
           ) all_links) as "links"
        FROM drm.projects p
        LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
        LEFT JOIN drm.customers c ON p.customer_id = c.id
        LEFT JOIN drm.users u ON p.owner_user_id = u.id
        LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
        WHERE coalesce(p.is_deleted, false) = false
        ${roleFilter}
        ${extraFilter}
        ORDER BY p.updated_at DESC
      `, params);

      res.json(rows.map(row => ({
        ...row,
        time: row.totalTime ? `${Math.floor(row.totalTime / 60)}:${row.totalTime % 60}` : "0:0",
        date: row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"
      })));
    } catch (error) {
      console.error("Error fetching department status:", error);
      res.status(500).json({ error: "Failed to fetch department status" });
    }
  });

  // GET /api/pms/project-tasks/:projectId - Direct raw SQL tasks for modal (bypasses ORM user-scope)
  app.get("/api/pms/project-tasks/:projectId", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { projectId } = req.params;
      // Sales Manager: self-only even inside a workspace they own — only
      // tasks they personally created or are assigned to, never a
      // teammate's row on the same project (explicit product decision).
      const isSalesManagerRole = req.user.roleId === "sales_manager";
      const selfScopeClause = isSalesManagerRole
        ? "AND (t.owner_user_id = $2 OR t.assigned_to_user_id = $2)"
        : "";
      const queryParams = isSalesManagerRole ? [projectId, req.user.userId] : [projectId];
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
          u.full_name as "assigneeName",
          p.name as "projectName"
        FROM drm.tasks t
        LEFT JOIN drm.users u ON u.id = t.assigned_to_user_id
        LEFT JOIN drm.projects p ON p.id = t.project_id
        WHERE t.project_id = $1
        ${selfScopeClause}
        ORDER BY t.created_at DESC
      `, queryParams);
      res.json(rows);
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

      const [projectsList, usersList] = await Promise.all([
        projectsRepository.findAll("Active"),
        usersRepository.findAll(),
      ]);

      res.json({
        projects: projectsList.map((p) => ({ id: p.id, name: p.name })),
        users: usersList.map((u) => ({ id: u.id, name: u.name, roleId: u.roleId, branch: (u as any).branch })),
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

      if (task.assignedToUserId) {
        await NotificationService.notify({
          userId: task.assignedToUserId,
          message: `You have been assigned a new task: '${task.title}'`,
          type: "INFO",
          targetUrl: `/pms/tasks/${task.id}`,
        });
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
        await NotificationService.notify({
          userId: assignedToUserId,
          message: `You have been assigned a new task: '${createdTask.title}'`,
          type: "INFO",
          targetUrl: `/pms/tasks/${createdTask.id}`,
        });
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

      const newAssignee = req.body.assignedToUserId;
      if (newAssignee && newAssignee !== existing.assignedToUserId) {
        await NotificationService.notify({
          userId: newAssignee,
          message: `You have been assigned the task: '${existing.title}'`,
          type: "INFO",
          targetUrl: `/pms/tasks/${existing.id}`,
        });
      }

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

      const newAssignee = req.body.assignedToUserId;
      if (newAssignee && newAssignee !== existing.assignedToUserId) {
        await NotificationService.notify({
          userId: newAssignee,
          message: `You have been assigned the task: '${existing.title}'`,
          type: "INFO",
          targetUrl: `/pms/tasks/${existing.id}`,
        });
      }

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
            count(*) filter (where lower(status) = 'todo')::int as todo,
            count(*) filter (where lower(status) = 'inprogress' or lower(status) = 'in_progress')::int as in_progress,
            count(*) filter (where lower(status) = 'blocked')::int as blocked,
            count(*) filter (where lower(status) = 'completed')::int as completed,
            count(*) filter (where due_date < now() and lower(status) <> 'completed')::int as overdue
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

      return res.json({
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
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

      const logs = await taskTimeLogsRepository.findByTaskId(req.params.id);
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

      const { userId, dateFrom, dateTo, limit } = req.query;

      const filters: any = {
        limit: limit ? parseInt(limit as string) : 50,
      };
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

      const history = await taskStatusHistoryRepository.findRecent(filters);

      // Enrich with the company name behind each task's project (invoice's
      // customer, falling back to the invoice/project name) — the history
      // rows themselves carry no company info.
      const taskIds = Array.from(new Set(history.map((h) => h.task?.id).filter(Boolean)));
      let companyByTaskId: Record<string, string> = {};
      if (taskIds.length > 0) {
        const companyRows = await pool.query(
          `SELECT t.id AS task_id, COALESCE(c.company_name, inv.company_name, p.name) AS company
             FROM drm.tasks t
             LEFT JOIN drm.projects p ON p.id = t.project_id
             LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
             LEFT JOIN drm.customers c ON c.id = COALESCE(p.customer_id, inv.customer_id)
            WHERE t.id = ANY($1::uuid[])`,
          [taskIds],
        );
        companyByTaskId = companyRows.rows.reduce((acc: Record<string, string>, row: any) => {
          acc[row.task_id] = row.company;
          return acc;
        }, {});
      }

      const enriched = history.map((h) => ({
        ...h,
        company: h.task?.id ? companyByTaskId[h.task.id] ?? null : null,
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching task history:", error);
      res.status(500).json({ error: "Failed to fetch task history" });
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

  // POST /api/pms/department-assignment - Save department assignment
  app.post("/api/pms/department-assignment", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { department, assign, ratio } = req.body;

      // For now, just log and return success
      // In production, you'd save this to a database table
      console.log("[Department Assignment]", {
        department,
        assign,
        ratio,
        userId: req.user.userId,
      });

      res.json({ success: true, data: req.body });
    } catch (error) {
      console.error("Error saving department assignment:", error);
      res.status(500).json({ error: "Failed to save assignment" });
    }
  });

  // GET /api/pms/department-stats - Get department statistics
  app.get("/api/pms/department-stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // For now, return empty stats
      // In production, you'd query the database for actual stats
      res.json({});
    } catch (error) {
      console.error("Error fetching department stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
}


