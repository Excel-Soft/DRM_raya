# PMS State Machine (Patch 6 Stage 4)

Central, single chokepoint for PMS task/project status changes:
`server/services/pms-transition.service.ts`.

Before Stage 4 the two PMS status endpoints wrote status ad hoc with no shared
legal-transition map, no audit, and no notification. They now route through this
service. **The default config preserves every legacy HTTP outcome byte-for-byte;**
stricter behaviour is opt-in via env flags (all default `false`).

## Logical states → stored enum

Ten logical lifecycle states map onto the **existing** `task_status` enum
(no schema change). Several logical states collapse onto one stored value; the
richer state is recoverable from `task_status_history` + the audit trail.

| Logical state | Stored `task_status` |
|---------------|----------------------|
| CREATED       | `ToDo`               |
| ASSIGNED      | `ToDo`               |
| IN_PROGRESS   | `InProgress`         |
| BLOCKED       | `Blocked`            |
| RETURNED      | `Blocked`            |
| REVIEW        | `READY_FOR_QA`       |
| APPROVED      | `READY_FOR_QA`       |
| COMPLETED     | `Completed`          |
| REOPENED      | `ToDo`               |
| ARCHIVED      | `Completed`          |

Stored task enum: `ToDo, InProgress, Blocked, Completed, READY_FOR_QA, IN_EXECUTION`.
Stored project enum: `Active, Completed, OnHold, READY_FOR_QA, IN_EXECUTION`.

## Canonical transition maps

Defined as `PMS_TASK_TRANSITIONS` / `PMS_PROJECT_TRANSITIONS`. These are a
permissive superset and are **only enforced when strict mode is on**. In
permissive mode a non-canonical move is allowed and recorded as a `warning`
(persisted into the audit `after.warnings`), never rejected.

Task transitions:
- `ToDo → InProgress | Blocked | IN_EXECUTION | READY_FOR_QA | Completed`
- `InProgress → ToDo | Blocked | IN_EXECUTION | READY_FOR_QA | Completed`
- `IN_EXECUTION → ToDo | InProgress | Blocked | READY_FOR_QA | Completed`
- `Blocked → ToDo | InProgress | IN_EXECUTION | READY_FOR_QA | Completed`
- `READY_FOR_QA → ToDo | InProgress | Blocked | Completed`
- `Completed → ToDo | InProgress` (reopen)

Project transitions:
- `Active → OnHold | IN_EXECUTION | READY_FOR_QA | Completed`
- `OnHold → Active | IN_EXECUTION | READY_FOR_QA | Completed`
- `IN_EXECUTION → Active | OnHold | READY_FOR_QA | Completed`
- `READY_FOR_QA → Active | OnHold | IN_EXECUTION | Completed`
- `Completed → Active | IN_EXECUTION` (reopen)

## Orchestrators

`changeTaskStatus(input)` and `changeProjectStatus(input)` return a
`ChangeStatusResult` (`{ success, status, error, code, task|project, fromStatus,
warnings }`). The route maps `result.status`/`result.error` straight onto the HTTP
response so the legacy status codes and messages are preserved.

### Task status (`PATCH /api/pms/task/:id/status`)
1. Best-effort pre-read of the task (for `fromStatus`/history/notification only).
   The default path does **not** branch on it.
2. `validateTaskTransition` (permissive default; never rejects a legacy move).
3. Permission **and existence** are delegated to `tasksRepository.updateStatus`,
   exactly as the legacy route did. It returns `"Task not found"` for a missing
   task and `"Only the task owner or assignee can change the status"` otherwise —
   the route maps **both** to `403` (a missing task is `403 "Task not found"`,
   **not** `404`, matching legacy). A manager/admin may act on a task they do not
   own/assign **only** when `PMS_ALLOW_MANAGER_ACT=true`; that opt-in path returns
   `404 "Task not found"` for a missing task.
4. Record `task_status_history` (best-effort — same as the legacy route).
5. Best-effort audit (`PMS_TASK_STATUS_CHANGED`) + notification to the
   counterparty (the owner/assignee who is not the actor). Both never throw.
6. Return the updated task (`200`), unchanged body shape.

The route still pre-validates the 4 Kanban statuses
(`ToDo|InProgress|Blocked|Completed`) and `"Status is required"` before calling
the service, exactly as before.

### Project status (`PATCH /api/pms/running-projects/:id/status`)
The legacy endpoint had **no** enum validation and **no** role restriction. The
permissive default keeps both (any authenticated caller, any status string; same
`404` / `200`). Strict mode adds enum validation, canonical-transition
enforcement, and a manager/admin guard. Audit is recorded best-effort either way.
There is no project status-history table, so none is written (unchanged).

## Config (env-overridable, safe defaults)

| Env flag | Default | Effect when `true` |
|----------|---------|--------------------|
| `PMS_STRICT_TRANSITIONS`       | `false` | Enforce canonical maps; for projects also enforce enum + manager/admin guard. |
| `PMS_REQUIRE_RETURN_REASON`    | `false` | Require a `reason` when a task → `Blocked`. |
| `PMS_REQUIRE_SUBMIT_EVIDENCE`  | `false` | Require ≥1 evidence entry when a task → `READY_FOR_QA`. |
| `PMS_REQUIRE_COMPLETE_REMARKS` | `false` | Require `remarks` when a task → `Completed`. |
| `PMS_ALLOW_MANAGER_ACT`        | `false` | Let a manager/admin (not owner/assignee) change a task's status. |

With all flags at their defaults the service is a transparent pass-through that
adds only audit + notification side-effects.
