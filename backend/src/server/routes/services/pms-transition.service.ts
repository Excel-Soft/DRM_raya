import { pool } from "../../db";
import { taskStatusHistoryRepository } from "../../repositories/task-status-history.repository";
import { taskTimeLogsRepository } from "../../repositories/task-time-logs.repository";
import { isManagerialRole } from "../../utils/role-utils";

// Real implementation — this used to be a no-op stub left over from an
// aborted MVC restructure (every call silently resolved `undefined`), so
// PUT/PATCH /api/pms/tasks/:id and PATCH /api/pms/task/:id/status never
// actually changed a task's status, and there was no real "executive
// submits -> manager approves (-> QA) / rejects (-> back to executive)"
// gate anywhere. The state machine below matches the one already encoded
// in tests/pms-lifecycle.test.ts (ToDo -> InProgress -> READY_FOR_QA ->
// Completed, with Blocked as the return-for-rework loop).
//
// NotificationService and AuditLogService (backend/src/server/routes/services/)
// are ALSO stubs in this checkout, so this service deliberately doesn't call
// them — the real, working "the other party finds out" mechanism today is
// the task_status_history row written below, which the PMS Task History
// page reads.

type SuccessResult = { success: true; task: any };
type FailureResult = { success: false; status: number; error: string; code?: string };
export type TransitionResult = SuccessResult | FailureResult;

const TASK_TRANSITIONS: Record<string, string[]> = {
  ToDo: ["InProgress"],
  InProgress: ["READY_FOR_QA", "Blocked"],
  READY_FOR_QA: ["Completed", "Blocked"],
  // Blocked -> InProgress: the executive resumes it themselves (e.g. via the
  // timer Play button) without the manager doing anything first.
  // Blocked -> ToDo: the manager explicitly hands it back ("Assign to Exec"
  // on the Task Complete page) — treated as a fresh assignment so it shows
  // under the executive's "Assign Project" tab instead of "Working Project".
  Blocked: ["InProgress", "ToDo"],
  Completed: [],
};

interface ChangeTaskStatusInput {
  taskId: string;
  toStatus: string;
  actorUserId: string;
  actorRoles: string[];
  reason?: string | null;
  notes?: string | null;
  remarks?: string | null;
  evidenceCount?: number;
  req?: any;
}

export async function changeTaskStatus(input: ChangeTaskStatusInput): Promise<TransitionResult> {
  const { taskId, toStatus, actorUserId, actorRoles, reason, notes, remarks } = input;

  const { rows } = await pool.query(
    `select id, status, owner_user_id, assigned_to_user_id, timer_started_at
       from drm.tasks where id = $1`,
    [taskId],
  );
  const task = rows[0];
  if (!task) {
    return { success: false, status: 404, error: "Task not found" };
  }

  const isManager = (actorRoles || []).some((r) => isManagerialRole(r));
  const isOwnerOrAssignee = task.owner_user_id === actorUserId || task.assigned_to_user_id === actorUserId;
  if (!isManager && !isOwnerOrAssignee) {
    return {
      success: false,
      status: 403,
      error: "Only the task owner, assignee, or a manager can update this task.",
    };
  }

  const fromStatus: string = task.status;
  if (fromStatus === toStatus) {
    return { success: true, task };
  }

  const allowed = TASK_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      success: false,
      status: 400,
      error: `Illegal PMS task transition from ${fromStatus} to ${toStatus}.`,
      code: "PMS_ILLEGAL_TRANSITION",
    };
  }

  // Returning a task for rework must always come with a reason — otherwise
  // the executive on the other end has nothing to act on.
  if (toStatus === "Blocked" && !(reason && String(reason).trim())) {
    return {
      success: false,
      status: 400,
      error: "A reason is required to return this task.",
      code: "PMS_REASON_REQUIRED",
    };
  }

  // Leaving InProgress with a timer still running: stop it and log the
  // elapsed time first, the same accounting /api/tasks/:id/timers/stop
  // does — a submit or a manager-triggered return shouldn't silently drop
  // time already worked.
  if (fromStatus === "InProgress" && task.timer_started_at) {
    const elapsedMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(task.timer_started_at).getTime()) / 60_000),
    );
    if (elapsedMinutes > 0) {
      await taskTimeLogsRepository.create({
        taskId,
        userId: actorUserId,
        timeSpentMinutes: elapsedMinutes,
        logDate: new Date(task.timer_started_at),
      } as any);
    }
  }

  const clearTimerClause = fromStatus === "InProgress" ? ", timer_started_at = null" : "";
  const { rows: updatedRows } = await pool.query(
    `update drm.tasks set status = $1, updated_at = now() ${clearTimerClause} where id = $2 returning *`,
    [toStatus, taskId],
  );
  const updatedTask = updatedRows[0];

  const historyNotes = reason
    ? JSON.stringify({ reason })
    : (notes ?? remarks ?? null);
  await taskStatusHistoryRepository.create({
    taskId,
    userId: actorUserId,
    fromStatus: fromStatus as any,
    toStatus: toStatus as any,
    notes: historyNotes,
  } as any);

  return { success: true, task: updatedTask };
}

interface ChangeProjectStatusInput {
  projectId: string;
  toStatus: string;
  actorUserId: string;
  actorRoles: string[];
  reason?: string | null;
  req?: any;
}

export async function changeProjectStatus(
  input: ChangeProjectStatusInput,
): Promise<{ success: true; project: any } | FailureResult> {
  const { projectId, toStatus, actorUserId, actorRoles } = input;

  const { rows } = await pool.query(
    `select id, status, owner_user_id from drm.projects where id = $1`,
    [projectId],
  );
  const project = rows[0];
  if (!project) {
    return { success: false, status: 404, error: "Project not found" };
  }

  const isManager = (actorRoles || []).some((r) => isManagerialRole(r));
  if (!isManager && project.owner_user_id !== actorUserId) {
    return {
      success: false,
      status: 403,
      error: "Only the project owner or a manager can update this project's status.",
    };
  }

  if (toStatus === project.status) {
    return { success: true, project };
  }

  const { rows: updatedRows } = await pool.query(
    `update drm.projects set status = $1, updated_at = now() where id = $2 returning *`,
    [toStatus, projectId],
  );
  return { success: true, project: updatedRows[0] };
}
