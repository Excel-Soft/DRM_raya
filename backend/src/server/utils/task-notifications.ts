import { pool } from "../db";
import { NotificationService } from "../services/notification-service";

/** In-app bell notification when a task is newly assigned or reassigned. */
export async function notifyTaskAssignee(params: {
  assigneeUserId: string;
  taskId: string;
  taskTitle: string;
  projectId?: string | null;
  previousAssigneeId?: string | null;
}): Promise<void> {
  const assignee = String(params.assigneeUserId || "").trim();
  if (!assignee) return;
  if (
    params.previousAssigneeId &&
    assignee === String(params.previousAssigneeId)
  ) {
    return;
  }

  let projectName = "";
  let companyLabel = "";
  if (params.projectId) {
    const r = await pool.query(
      `SELECT p.name, COALESCE(c.company_name, p.name) AS company
         FROM drm.projects p
         LEFT JOIN drm.customers c ON c.id = p.customer_id
        WHERE p.id = $1`,
      [params.projectId],
    );
    projectName = r.rows[0]?.name || "";
    companyLabel = r.rows[0]?.company || projectName;
  }

  const title = String(params.taskTitle || "Task").trim() || "Task";
  const context = companyLabel
    ? ` on ${companyLabel}${
        projectName && projectName !== companyLabel ? ` (${projectName})` : ""
      }`
  : "";

  const targetUrl = params.projectId
    ? `/pms/tasks?projectId=${encodeURIComponent(String(params.projectId))}`
    : `/pms/tasks/${params.taskId}`;

  await NotificationService.notify({
    userId: assignee,
    message: `You have been assigned a new task '${title}'${context}.`,
    type: "INFO",
    targetUrl,
    module: "pms",
    entityType: "task",
    entityId: params.taskId,
  });
}

/** Notify the manager when an executive submits a task for review (READY_FOR_QA). */
export async function notifyTaskSubmittedForReview(params: {
  taskId: string;
  taskTitle: string;
  projectId?: string | null;
  executiveUserId: string;
  managerUserId: string | null;
  executiveName?: string | null;
}): Promise<void> {
  const managerId = String(params.managerUserId || "").trim();
  if (!managerId || managerId === String(params.executiveUserId)) return;

  const executive = (params.executiveName || "An executive").trim();
  const title = String(params.taskTitle || "Task").trim() || "Task";
  const targetUrl = "/pms/task-history";

  await NotificationService.notify({
    userId: managerId,
    message: `${executive} submitted task "${title}" for your review.`,
    type: "INFO",
    targetUrl,
    module: "pms",
    entityType: "task",
    entityId: params.taskId,
    priority: "high",
  });
}