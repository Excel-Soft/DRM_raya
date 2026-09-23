import { Router, type Request, type Response } from "express";
import { pool } from "../db";
import { requireRole } from "../middleware/auth.middleware";
import { AuditLogService } from "./services/audit-log.service";

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
       where p.department_type in ('SEO_SMM', 'SEO/SMM')
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

// PATCH /api/seo-smm/tasks/:id/status — { status: "ToDo" | "InProgress" | "Completed" }
// Deliberately bypasses the generic PMS task-transition service (a stub that
// throws) with a direct, department-scoped update, mirroring
// PATCH /api/it/tasks/:id/status. Only the task's own assignee or a
// SEO/SMM write-role may move it.
router.patch("/tasks/:id/status", async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });
    const status = req.body?.status;
    if (!["ToDo", "InProgress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "status must be ToDo, InProgress, or Completed" });
    }

    const taskRes = await pool.query(`select id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });

    const userId = actorId(req);
    const isAssignee = taskRes.rows[0].assigned_to_user_id === userId;
    const isWriteRole = SEO_SMM_WRITE_ROLES.includes((req as any).user?.roleId) || ((req as any).user?.roles || []).some((r: string) => SEO_SMM_WRITE_ROLES.includes(r));
    if (!isAssignee && !isWriteRole) {
      return res.status(403).json({ error: "Only the assigned executive or a SEO/SMM manager can update this task." });
    }

    // Starting the timer only on the ToDo -> InProgress transition (never
    // overwritten on a later re-entry into InProgress) is what the "In
    // Progress" tab's countdown is measured from.
    if (status === "InProgress") {
      await pool.query(
        `update drm.tasks set status = $1, timer_started_at = coalesce(timer_started_at, now()), updated_at = now() where id = $2`,
        [status, req.params.id],
      );
    } else {
      await pool.query(`update drm.tasks set status = $1, updated_at = now() where id = $2`, [status, req.params.id]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating SEO/SMM task status:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

export default router;
