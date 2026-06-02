import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "./db";
import { isHodAllowed, normalizeRole } from "./utils/role-utils";

// Ensure audit table exists (id serial is acceptable for audit log)
const ensureAuditTable = pool.query(`
  create table if not exists hod_actions_log (
    id serial primary key,
    user_id uuid not null,
    action_type text not null,
    payload jsonb,
    created_at timestamptz not null default now()
  )
`);

async function logAction(userId: string, actionType: string, payload: any) {
  await ensureAuditTable;
  await pool.query(
    `insert into hod_actions_log (user_id, action_type, payload) values ($1, $2, $3)`,
    [userId, actionType, payload ?? {}],
  );
}

function send(res: Response, status: number, body: any) {
  return res.status(status).json(body);
}

function logErr(prefix: string, error: any) {
  const msg = error?.message ?? String(error);
  console.error(prefix, msg);
}

// Role guard specific to quick actions (reuse normalized role already set by auth middleware)
function ensureHod(req: Request, res: Response, next: () => void) {
  const rawRole = (req.user as any)?.roleId;
  const tokenRole = normalizeRole(rawRole);
  if (!req.user || !isHodAllowed(tokenRole)) {
    return send(res, 403, {
      success: false,
      message: "Access denied: HOD/Admin/Manager required.",
    });
  }
  next();
}

export function registerHodQuickActionRoutes(router: Router) {
  router.use("/quick-actions", ensureHod);

  // Pending leave requests list
  router.get("/quick-actions/leaves", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const offset = (page - 1) * limit;
      const status = String(req.query.status ?? "Pending");

      const [rows, count] = await Promise.all([
        pool.query(
          `select id, user_id, from_date, to_date, reason, status, created_at
           from drm.leave_requests
           where status = $1
           order by created_at desc
           limit $2 offset $3`,
          [status, limit, offset],
        ),
        pool.query(`select count(*)::int as count from drm.leave_requests where status = $1`, [status]),
      ]);

      return send(res, 200, {
        success: true,
        data: rows.rows,
        meta: { total: count.rows[0]?.count ?? 0, page, limit },
      });
    } catch (error) {
      logErr("[HOD QA] leaves list error", error);
      return send(res, 500, { success: false, message: "Failed to fetch leave requests" });
    }
  });

  // Approve leave
  router.post("/quick-actions/leaves/:id/approve", async (req, res) => {
    try {
      const id = req.params.id;
      await pool.query(
        `update drm.leave_requests set status = 'Approved', approved_by = $2, updated_at = now() where id = $1`,
        [id, req.user!.userId],
      );
      await logAction(req.user!.userId, "approve_leave", { leaveId: id });
      return send(res, 200, { success: true, message: "Leave approved" });
    } catch (error) {
      logErr("[HOD QA] approve leave error", error);
      return send(res, 500, { success: false, message: "Failed to approve leave" });
    }
  });

  // Reject leave
  router.post("/quick-actions/leaves/:id/reject", async (req, res) => {
    try {
      const id = req.params.id;
      const reason = (req.body?.reason as string) ?? null;
      await pool.query(
        `update drm.leave_requests set status = 'Rejected', approved_by = $2, reason = coalesce($3, reason), updated_at = now() where id = $1`,
        [id, req.user!.userId, reason],
      );
      await logAction(req.user!.userId, "reject_leave", { leaveId: id, reason });
      return send(res, 200, { success: true, message: "Leave rejected" });
    } catch (error) {
      logErr("[HOD QA] reject leave error", error);
      return send(res, 500, { success: false, message: "Failed to reject leave" });
    }
  });

  // Project escalation
  const escalationSchema = z.object({
    projectId: z.string(),
    priority: z.enum(["low", "medium", "high"]),
    reason: z.string(),
    note: z.string().optional(),
  });
  router.post("/quick-actions/projects/escalate", async (req, res) => {
    try {
      const payload = escalationSchema.parse(req.body);
      await logAction(req.user!.userId, "escalate_project", payload);
      return send(res, 200, { success: true, message: "Escalation recorded", data: payload });
    } catch (error: any) {
      logErr("[HOD QA] project escalation error", error);
      const message = error?.message?.includes("Required") ? "Invalid request data" : "Failed to escalate project";
      return send(res, 400, { success: false, message });
    }
  });

  // Reassign GM
  const reassignSchema = z.object({
    entityType: z.enum(["customer", "project"]),
    entityId: z.string(),
    fromUserId: z.string().optional(),
    toUserId: z.string(),
    note: z.string().optional(),
  });
  router.post("/quick-actions/gm/reassign", async (req, res) => {
    try {
      const payload = reassignSchema.parse(req.body);
      await logAction(req.user!.userId, "reassign_gm", payload);
      return send(res, 200, { success: true, message: "Reassignment recorded", data: payload });
    } catch (error: any) {
      logErr("[HOD QA] reassign gm error", error);
      const message = error?.message?.includes("Required") ? "Invalid request data" : "Failed to reassign";
      return send(res, 400, { success: false, message });
    }
  });

  // Notify Sales Team
  const notifySchema = z.object({
    message: z.string().min(1),
    audience: z.enum(["all", "department"]),
    department: z.string().optional(),
  });
  router.post("/quick-actions/notify-sales", async (req, res) => {
    try {
      const payload = notifySchema.parse(req.body);
      await logAction(req.user!.userId, "notify_sales", payload);
      return send(res, 200, { success: true, message: "Notification recorded", data: payload });
    } catch (error: any) {
      logErr("[HOD QA] notify sales error", error);
      const message = error?.message?.includes("Required") ? "Invalid request data" : "Failed to notify";
      return send(res, 400, { success: false, message });
    }
  });

  // View reports
  router.get("/quick-actions/reports", async (req, res) => {
    try {
      const type = String(req.query.type ?? "sales");
      const period = String(req.query.period ?? "today");
      await logAction(req.user!.userId, "view_reports", { type, period });
      return send(res, 200, { success: true, message: "Report data", data: { type, period, summary: {} } });
    } catch (error) {
      logErr("[HOD QA] reports error", error);
      return send(res, 500, { success: false, message: "Failed to load reports" });
    }
  });

  // Sync data
  router.post("/quick-actions/sync", async (req, res) => {
    const start = Date.now();
    try {
      const target = (req.body?.target as string) ?? "all";
      // placeholder sync
      await logAction(req.user!.userId, "sync_data", { target });
      const durationMs = Date.now() - start;
      return send(res, 200, {
        success: true,
        message: "Sync completed",
        data: { target, durationMs },
      });
    } catch (error) {
      logErr("[HOD QA] sync error", error);
      return send(res, 500, { success: false, message: "Failed to sync data" });
    }
  });
}

