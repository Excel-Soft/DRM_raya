import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db";
import { taskTimeLogsRepository } from "../repositories/task-time-logs.repository";
import { changeTaskStatus } from "./services/pms-transition.service";

function actorRoles(req: Request): string[] {
  const u = (req as any).user;
  if (!u) return [];
  const out: string[] = [];
  for (const v of [u.activeRoleId, u.roleId, u.role]) if (v) out.push(String(v));
  if (Array.isArray(u.roles)) for (const r of u.roles) if (r) out.push(String(r));
  return out;
}

// Backs the "Assigned Project" (Today/Waiting) widget and the per-task
// timer controls on product-posting-executive-widget.tsx (and any other
// executive dashboard reusing the same pattern). This router used to be an
// empty stub -- every route below 404'd, which is why a freshly-assigned
// task never showed up here even though it was created successfully.
const router = Router();

// Real disk-backed file storage for the Task System "Files" modal — mirrors
// project-doc-routes.ts's established multer setup.
const TASK_FILES_UPLOAD_DIR = path.join(process.cwd(), "uploads", "task-files");
fs.mkdirSync(TASK_FILES_UPLOAD_DIR, { recursive: true });
const taskFilesUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TASK_FILES_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
}).array("files", 10);

function userId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// GET /api/tasks/my-executions — tasks assigned to the current user, most
// recent first. Same underlying data as GET /api/hod/daily-report (drm.tasks
// filtered by assigned_to_user_id), just shaped for this widget instead of
// a daily activity log.
router.get("/my-executions", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `select
         t.id,
         t.id as "taskId",
         t.project_id as "projectId",
         t.title,
         t.status,
         t.timer_started_at as "timerStartedAt",
         t.created_at as "createdAt",
         t.due_date as "dueDate",
         coalesce(c.company_name, p.name, 'N/A') as "companyName",
         p.name as "workSpace"
       from drm.tasks t
       left join drm.projects p on p.id = t.project_id
       left join drm.customers c on c.id = p.customer_id
       where t.assigned_to_user_id = $1 and coalesce(t.is_deleted, false) = false
       order by t.created_at desc
       limit 100`,
      [uid],
    );

    const data = rows.map((r) => ({
      ...r,
      phaseLabel: r.status,
      timerStatus: r.timerStartedAt ? "RUNNING" : "STOPPED",
      evidenceLinks: [],
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching task executions:", error);
    res.status(500).json({ error: "Failed to fetch assigned tasks" });
  }
});

// POST /api/tasks/:id/timers/start — only the task's own assignee can start
// its timer. No-ops (returns the existing start time) if already running,
// so a duplicate click can't lose the original start time. Also moves the
// task into InProgress if it isn't already (ToDo -> InProgress on first
// start, Blocked -> InProgress when the executive resumes work after a
// manager rejection) — routed through the real PMS transition gate so a
// task still awaiting manager review (READY_FOR_QA) correctly can't be
// silently reopened this way.
router.post("/:id/timers/start", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, assigned_to_user_id, status, timer_started_at from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (taskRes.rows[0].assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "Only the assigned executive can start this task's timer." });
    }

    if (taskRes.rows[0].status !== "InProgress") {
      const transition = await changeTaskStatus({
        taskId: req.params.id,
        toStatus: "InProgress",
        actorUserId: uid,
        actorRoles: actorRoles(req),
      });
      if (!transition.success) {
        return res.status(transition.status || 400).json({ error: transition.error, code: (transition as any).code });
      }
    }

    const result = await pool.query(
      `update drm.tasks set timer_started_at = coalesce(timer_started_at, now()), updated_at = now() where id = $1 returning timer_started_at as "timerStartedAt"`,
      [req.params.id],
    );
    res.json({ success: true, timerStartedAt: result.rows[0].timerStartedAt });
  } catch (error) {
    console.error("Error starting task timer:", error);
    res.status(500).json({ error: "Failed to start timer" });
  }
});

// POST /api/tasks/:id/timers/stop — logs the elapsed time as a real
// drm.task_time_logs row (the same table GET /api/hod/daily-report's
// "spent" column already sums from) and clears the running timer.
router.post("/:id/timers/stop", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, assigned_to_user_id, timer_started_at from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    const task = taskRes.rows[0];
    if (task.assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "Only the assigned executive can stop this task's timer." });
    }

    if (task.timer_started_at) {
      const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(task.timer_started_at).getTime()) / 60_000));
      await taskTimeLogsRepository.create({
        taskId: req.params.id,
        userId: uid,
        timeSpentMinutes: elapsedMinutes,
        logDate: new Date(task.timer_started_at),
      } as any);
    }

    await pool.query(`update drm.tasks set timer_started_at = null, updated_at = now() where id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping task timer:", error);
    res.status(500).json({ error: "Failed to stop timer" });
  }
});

// GET /api/tasks/:id/files — everyone with visibility on the task (owner or
// assignee) can see what's been submitted against it.
router.get("/:id/files", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, owner_user_id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    const task = taskRes.rows[0];
    if (task.owner_user_id !== uid && task.assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "You don't have access to this task's files." });
    }

    const { rows } = await pool.query(
      `select f.id, f.file_url as "fileUrl", f.file_name as "fileName", f.description, f.created_at as "createdAt",
              coalesce(u.full_name, u.name, u.username) as "uploadedByName"
       from drm.task_files f
       left join drm.users u on u.id = f.uploaded_by_user_id
       where f.task_id = $1
       order by f.created_at desc`,
      [req.params.id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching task files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// POST /api/tasks/:id/files — multipart form: files[] + description. Only
// the task's own assignee submits their work here (matches the same
// ownership rule as timers/complete above).
router.post("/:id/files", (req, res, next) => {
  taskFilesUpload(req as any, res as any, (err: any) => {
    if (err) {
      console.error("Error uploading task files:", err);
      return res.status(400).json({ error: err.message || "Failed to upload files" });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (taskRes.rows[0].assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "Only the assigned executive can submit files for this task." });
    }

    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const files = ((req as any).files as Express.Multer.File[] | undefined) || [];

    if (files.length === 0 && !description) {
      return res.status(400).json({ error: "Attach at least one file or add a description." });
    }

    const inserted: any[] = [];
    if (files.length > 0) {
      for (const file of files) {
        const row = await pool.query(
          `insert into drm.task_files (task_id, uploaded_by_user_id, file_url, file_name, description)
           values ($1, $2, $3, $4, $5) returning id, file_url as "fileUrl", file_name as "fileName", description, created_at as "createdAt"`,
          [req.params.id, uid, `/uploads/task-files/${file.filename}`, file.originalname, description || null],
        );
        inserted.push(row.rows[0]);
      }
    } else {
      const row = await pool.query(
        `insert into drm.task_files (task_id, uploaded_by_user_id, description)
         values ($1, $2, $3) returning id, file_url as "fileUrl", file_name as "fileName", description, created_at as "createdAt"`,
        [req.params.id, uid, description],
      );
      inserted.push(row.rows[0]);
    }

    res.status(201).json({ success: true, data: inserted });
  } catch (error) {
    console.error("Error saving task files:", error);
    res.status(500).json({ error: "Failed to save files" });
  }
});

// POST /api/tasks/:id/complete — { linksPosted, outputNotes }
// The executive's "submit for review" action — records a drm.task_results
// row (linksPosted + total time actually spent, summed from the real
// task_time_logs rows the timer start/stop endpoints above create), then
// moves the task to READY_FOR_QA (not straight to Completed — that would
// skip the manager's review/QA-handoff step entirely). The manager then
// approves (-> Completed) or rejects (-> Blocked, back to this executive)
// from the PMS Task History review queue via the same transition gate.
router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (taskRes.rows[0].assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "Only the assigned executive can complete this task.", code: "WORKFLOW_OWNERSHIP_FORBIDDEN" });
    }

    const linksPosted = Number(req.body?.linksPosted) || 0;
    const totalDurationMinutes = await taskTimeLogsRepository.getTotalTimeByTask(req.params.id);

    await pool.query(
      `insert into drm.task_results (task_id, links_posted, total_duration_minutes, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (task_id) do update set links_posted = excluded.links_posted, total_duration_minutes = excluded.total_duration_minutes, updated_at = now()`,
      [req.params.id, linksPosted, totalDurationMinutes],
    );

    const notes = typeof req.body?.outputNotes === "string" && req.body.outputNotes.trim() ? req.body.outputNotes : null;
    const transition = await changeTaskStatus({
      taskId: req.params.id,
      toStatus: "READY_FOR_QA",
      actorUserId: uid,
      actorRoles: actorRoles(req),
      notes,
    });
    if (!transition.success) {
      return res.status(transition.status || 400).json({ error: transition.error, code: (transition as any).code });
    }

    res.json({ success: true, status: transition.task.status });
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ error: "Failed to complete task" });
  }
});

// POST /api/tasks/:id/extensions — { requestedTimeMinutes, reason }
// Validation order and error codes match the regression spec in
// tests/task-extension-routes.test.ts: ownership before payload validation,
// then minutes, then reason, then the one-pending-request-at-a-time rule.
router.post("/:id/extensions", async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    if (!uid) return res.status(401).json({ error: "Not authenticated" });

    const taskRes = await pool.query(`select id, assigned_to_user_id from drm.tasks where id = $1`, [req.params.id]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (taskRes.rows[0].assigned_to_user_id !== uid) {
      return res.status(403).json({ error: "Only the assigned executive can request overtime for this task.", code: "WORKFLOW_OWNERSHIP_FORBIDDEN" });
    }

    const requestedTimeMinutes = Number(req.body?.requestedTimeMinutes);
    if (!Number.isFinite(requestedTimeMinutes) || requestedTimeMinutes <= 0) {
      return res.status(400).json({ error: "requestedTimeMinutes must be a positive number.", code: "EXTENSION_MINUTES_INVALID" });
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return res.status(400).json({ error: "A reason is required.", code: "EXTENSION_REASON_REQUIRED" });
    }

    const pending = await pool.query(`select id from drm.task_time_extensions where task_id = $1 and status = 'PENDING'`, [req.params.id]);
    if ((pending.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: "A request is already pending for this task.", code: "EXTENSION_DUPLICATE_PENDING" });
    }

    const inserted = await pool.query(
      `insert into drm.task_time_extensions (task_id, requested_time_minutes, reason, status)
       values ($1, $2, $3, 'PENDING') returning id`,
      [req.params.id, requestedTimeMinutes, reason],
    );
    res.status(201).json({ success: true, id: inserted.rows[0].id });
  } catch (error) {
    console.error("Error requesting task extension:", error);
    res.status(500).json({ error: "Failed to request overtime" });
  }
});

export const taskExecutionRouter = router;
