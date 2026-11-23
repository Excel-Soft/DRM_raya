import { Router, type Request, type Response } from "express";
import { pool } from "../db";
import { requireRole } from "../middleware/auth.middleware";
import { AuditLogService } from "./services/audit-log.service";
import { changeTaskStatus } from "./services/pms-transition.service";
import { sqlDepartmentFamilyIn } from "@shared/project-department-variants";

const SEO_DEPT_SQL = sqlDepartmentFamilyIn("p.department_type", "seo_smm");

// SEO/SMM manager's "Department Status Tracker" Pending/Approved tabs —
// sales-uploaded project documents routed to the SEO/SMM department.
// department_type is stored inconsistently in the wild — 'SEO_SMM' from some
// write paths, 'SEO/SMM' (literal slash) from others — so both are matched.
// Mirrors it-assets-routes.ts's /api/it/projects + /api/it/documents/:id/verify
// (same underlying tables, same reject -> rework-history -> sales-exec-reupload
// loop), scoped to this department's own roles instead of IT's.
const router = Router();

const SEO_SMM_ROLES = ["admin", "super_hod", "seo_smm_manager"];

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// GET /api/seo-smm/projects?status=pending|approved|in-progress
// "approved" = document approved and no task started yet (ToDo or unassigned).
// "in-progress" = document approved and the most recently assigned task has
// been started (InProgress) or finished (Completed) — this is what makes a
// project visually move from the Approved tab to the In Progress tab once
// the executive clicks "Start Working".
router.get("/projects", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const statusParam = req.query.status === "approved" ? "APPROVED" : req.query.status === "in-progress" ? "IN_PROGRESS" : "PENDING";
    // "in-progress" is a task-status filter layered on top of an APPROVED
    // document, not a real drm.project_documents.status value.
    const docStatus = statusParam === "IN_PROGRESS" ? "APPROVED" : statusParam;
    const taskFilter = statusParam === "APPROVED"
      ? `and (lt.status is null or lt.status = 'ToDo')`
      : statusParam === "IN_PROGRESS"
      ? `and lt.status in ('InProgress', 'Completed')`
      : "";
    const { rows } = await pool.query(
      `select
         p.id as "projectId",
         p.name as project,
         coalesce(c.company_name, 'Unknown') as company,
         pd.id as "documentId",
         pd.document_url as "documentUrl",
         pd.status as "documentStatus",
         pd.created_at as "uploadedAt",
         pdet.package_name as "packageName",
         pdet.minisite_url as "minisiteUrl",
         pdet.phone as "phone",
         pdet.mobile as "mobile",
         pdet.address as "address",
         pdet.reference as "reference",
         pdet.categories as "categories",
         pdet.detail_notes as "detailNotes",
         lt.id as "taskId",
         lt.title as "taskTitle",
         lt.status as "taskStatus",
         lt.due_date as "taskDueDate",
         lt.timer_started_at as "taskTimerStartedAt"
       from drm.projects p
       join lateral (
         select * from drm.project_documents pd2
         where pd2.project_id = p.id
         order by pd2.created_at desc
         limit 1
       ) pd on true
       left join drm.customers c on c.id = p.customer_id
       left join drm.project_details pdet on pdet.project_id = p.id
       left join lateral (
         -- Only a task created for THIS approval cycle counts -- a project
         -- can be rejected and re-uploaded/re-approved multiple times, and
         -- tasks aren't tied to a specific document, so without this cutoff
         -- a leftover task from a PRIOR cycle (e.g. already InProgress or
         -- Completed) would wrongly make a freshly-approved document look
         -- like it had already been started.
         select * from drm.tasks t2
         where t2.project_id = p.id and coalesce(t2.is_deleted, false) = false
           and t2.created_at >= pd.updated_at
         order by t2.created_at desc
         limit 1
       ) lt on true
       where ${SEO_DEPT_SQL}
         and pd.status = $1
         ${taskFilter}
       order by pd.created_at desc`,
      [docStatus],
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching SEO/SMM projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// PATCH /api/seo-smm/documents/:id/verify — { status: "APPROVED" | "REJECTED", reason?: string }
router.patch("/documents/:id/verify", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const status = req.body?.status;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
    }
    if (status === "REJECTED" && !reason) {
      return res.status(400).json({ error: "A rejection reason is required." });
    }

    const docRes = await pool.query(
      `update drm.project_documents set status = $1, updated_at = now() where id = $2 returning id, project_id`,
      [status, req.params.id],
    );
    if (docRes.rowCount === 0) return res.status(404).json({ error: "Document not found" });

    if (status === "REJECTED") {
      const wfRes = await pool.query(
        `select id, current_phase from drm.product_posting_workflows where project_id = $1`,
        [docRes.rows[0].project_id],
      );
      if (wfRes.rows[0]) {
        await pool.query(
          `insert into drm.product_posting_rework_history (workflow_id, from_phase, to_phase, action, remarks, actor_user_id)
           values ($1, $2, 'PENDING_PROJECT', 'DOCUMENT_REJECTED', $3, $4)`,
          [wfRes.rows[0].id, wfRes.rows[0].current_phase, reason, actorId(req)],
        );
      }
    }

    await AuditLogService.record({
      actorUserId: actorId(req) ?? undefined,
      action: "seo_smm_document.verify",
      module: "seo_smm",
      entityType: "project_document",
      entityId: req.params.id,
      after: { status, reason: reason || undefined },
      req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error verifying SEO/SMM document:", error);
    res.status(500).json({ error: "Failed to verify document" });
  }
});

// GET /api/seo-smm/dashboard/summary — KPI cards scoped to SEO/SMM projects only
// (not company-wide /api/hod/dashboard/important-stats or /api/pms/projects).
router.get("/dashboard/summary", requireRole(...SEO_SMM_ROLES), async (_req: Request, res: Response) => {
  try {
    const taskRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'InProgress' AND COALESCE(t.is_deleted, false) = false)::int AS "ongoingTasks",
        COUNT(*) FILTER (WHERE t.status = 'Completed' AND COALESCE(t.is_deleted, false) = false)::int AS "completedTasks",
        COUNT(*) FILTER (
          WHERE COALESCE(t.is_deleted, false) = false
            AND t.due_date IS NOT NULL
            AND t.due_date < NOW()
            AND t.status NOT IN ('Completed', 'Cancelled')
        )::int AS "criticalDelays"
      FROM drm.tasks t
      INNER JOIN drm.projects p ON p.id = t.project_id
      WHERE COALESCE(p.is_deleted, false) = false
        AND ${SEO_DEPT_SQL}
    `);
    const projectRes = await pool.query(`
      SELECT
        COUNT(*)::int AS "totalManaged",
        COUNT(*) FILTER (WHERE LOWER(COALESCE(p.status, '')) = 'onhold')::int AS "onHoldProjects"
      FROM drm.projects p
      WHERE COALESCE(p.is_deleted, false) = false
        AND ${SEO_DEPT_SQL}
    `);
    const t = taskRes.rows[0] || {};
    const p = projectRes.rows[0] || {};
    res.json({
      success: true,
      data: {
        ongoingTasks: Number(t.ongoingTasks || 0),
        totalManaged: Number(p.totalManaged || 0),
        completedTasks: Number(t.completedTasks || 0),
        criticalDelays: Number(t.criticalDelays || 0),
        onHoldProjects: Number(p.onHoldProjects || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching SEO/SMM dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// GET /api/seo-smm/projects/overview — projects in SEO/SMM dept with taskStats
router.get("/projects/overview", requireRole(...SEO_SMM_ROLES), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.status,
        p.work_space AS "workSpace",
        p.start_date AS "startDate",
        p.end_date AS "endDate",
        COALESCE(c.company_name, 'Unknown') AS "companyName",
        COALESCE(stats.total, 0)::int AS "taskTotal",
        COALESCE(stats.to_do, 0)::int AS "taskToDo",
        COALESCE(stats.in_progress, 0)::int AS "taskInProgress",
        COALESCE(stats.blocked, 0)::int AS "taskBlocked",
        COALESCE(stats.completed, 0)::int AS "taskCompleted"
      FROM drm.projects p
      LEFT JOIN drm.customers c ON c.id = p.customer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE t.status = 'ToDo')::int AS to_do,
          COUNT(*) FILTER (WHERE t.status = 'InProgress')::int AS in_progress,
          COUNT(*) FILTER (WHERE t.status = 'Blocked')::int AS blocked,
          COUNT(*) FILTER (WHERE t.status = 'Completed')::int AS completed
        FROM drm.tasks t
        WHERE t.project_id = p.id AND COALESCE(t.is_deleted, false) = false
      ) stats ON true
      WHERE COALESCE(p.is_deleted, false) = false
        AND ${SEO_DEPT_SQL}
      ORDER BY p.updated_at DESC
      LIMIT 500
    `);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status,
        workSpace: r.workSpace,
        companyName: r.companyName,
        startDate: r.startDate,
        endDate: r.endDate,
        taskStats: {
          total: r.taskTotal,
          toDo: r.taskToDo,
          inProgress: r.taskInProgress,
          blocked: r.taskBlocked,
          completed: r.taskCompleted,
        },
      })),
    );
  } catch (error) {
    console.error("Error fetching SEO/SMM projects overview:", error);
    res.status(500).json({ error: "Failed to fetch projects overview" });
  }
});

// GET /api/seo-smm/daily-report?period=today|yesterday|weekly|monthly
router.get("/daily-report", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const period = String(req.query.period || "today").toLowerCase();
    let dateFilter = "AND t.updated_at >= CURRENT_DATE";
    if (period === "yesterday") {
      dateFilter = "AND t.updated_at >= CURRENT_DATE - INTERVAL '1 day' AND t.updated_at < CURRENT_DATE";
    } else if (period === "weekly") {
      dateFilter = "AND t.updated_at >= date_trunc('week', CURRENT_DATE)";
    } else if (period === "monthly") {
      dateFilter = "AND t.updated_at >= date_trunc('month', CURRENT_DATE)";
    }

    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.name), ''), u.username) AS name,
        COALESCE(c.company_name, 'Unknown') AS company,
        COALESCE(NULLIF(TRIM(p.name), ''), '—') AS project,
        t.title AS task,
        t.status,
        COALESCE(SUM(ttl.duration_minutes), 0)::int AS spent
      FROM drm.tasks t
      INNER JOIN drm.projects p ON p.id = t.project_id
      LEFT JOIN drm.users u ON u.id = t.assigned_to_user_id
      LEFT JOIN drm.customers c ON c.id = p.customer_id
      LEFT JOIN drm.task_time_logs ttl ON ttl.task_id = t.id
      WHERE COALESCE(t.is_deleted, false) = false
        AND COALESCE(p.is_deleted, false) = false
        AND ${SEO_DEPT_SQL}
        ${dateFilter}
      GROUP BY t.id, u.full_name, u.name, u.username, c.company_name, p.name, t.title, t.status, t.updated_at
      ORDER BY t.updated_at DESC
      LIMIT 50
    `,
    );
    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name || "Unassigned",
        company: row.company,
        project: row.project,
        task: row.task,
        status: row.status,
        spent: `${row.spent || 0} mins`,
      })),
    });
  } catch (error) {
    console.error("Error fetching SEO/SMM daily report:", error);
    res.status(500).json({ success: false, message: "Failed to load daily report" });
  }
});

// GET /api/seo-smm/executives — assignable SEO/SMM executives for the
// "Assign Task" dropdown on an approved document. Mirrors GET /api/it/executives.
router.get("/executives", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `select id, coalesce(full_name, name, username) as name, email
       from drm.users
       where is_active = true
         and (role_id = 'seo_smm_executive' or role = 'seo_smm_executive' or 'seo_smm_executive' = any(roles))
       order by coalesce(full_name, name, username)`,
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching SEO/SMM executives:", error);
    res.status(500).json({ error: "Failed to fetch executives" });
  }
});

const SEO_SMM_WRITE_ROLES = ["admin", "super_hod", "seo_smm_manager"];

// PATCH /api/seo-smm/tasks/:id/status — { status: "ToDo" | "InProgress" | "READY_FOR_QA" }
// The SEO/SMM executive's own "start working" / "submit for review" actions.
// Used to deliberately bypass the generic PMS task-transition service
// because it was a no-op stub; that's fixed now, so this routes through the
// same real changeTaskStatus() gate everything else does — Completed is no
// longer reachable from here (only the SEO/SMM manager's review, via the
// central Kanban status endpoint, can move a submitted task to Completed).
router.patch("/tasks/:id/status", async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });
    const status = req.body?.status;
    if (!["ToDo", "InProgress", "READY_FOR_QA"].includes(status)) {
      return res.status(400).json({ error: "status must be ToDo, InProgress, or READY_FOR_QA" });
    }

    const taskRes = await pool.query(`select id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });

    const userId = actorId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const isAssignee = taskRes.rows[0].assigned_to_user_id === userId;
    const isWriteRole = SEO_SMM_WRITE_ROLES.includes((req as any).user?.roleId) || ((req as any).user?.roles || []).some((r: string) => SEO_SMM_WRITE_ROLES.includes(r));
    if (!isAssignee && !isWriteRole) {
      return res.status(403).json({ error: "Only the assigned executive or a SEO/SMM manager can update this task." });
    }

    const roles = [(req as any).user?.activeRoleId, (req as any).user?.roleId, (req as any).user?.role, ...(((req as any).user?.roles) || [])].filter(Boolean);
    const transition = await changeTaskStatus({
      taskId: req.params.id,
      toStatus: status,
      actorUserId: userId,
      actorRoles: roles,
    });
    if (!transition.success) {
      return res.status(transition.status || 400).json({ error: transition.error, code: (transition as any).code });
    }

    // Starting the timer on entry into InProgress (never overwritten on a
    // later re-entry) is what the "In Progress" tab's countdown is measured
    // from — changeTaskStatus itself only ever clears timer_started_at, it
    // doesn't set one, so that's still done here.
    if (status === "InProgress") {
      await pool.query(`update drm.tasks set timer_started_at = coalesce(timer_started_at, now()) where id = $1`, [req.params.id]);
    }

    res.json({ success: true, status: transition.task.status });
  } catch (error) {
    console.error("Error updating SEO/SMM task status:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

export default router;
