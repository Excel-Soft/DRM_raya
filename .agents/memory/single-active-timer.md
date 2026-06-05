---
name: single-active-timer invariant
description: How the one-running-timer-per-worker rule must be enforced on the task timer start route.
---

# Single active timer invariant

When a task timer "start" auto-stops a worker's other running timers, two
constraints are non-obvious and easy to get wrong:

- **Scope the invariant to the task's assignee, not the caller.** Managers/admins
  are allowed to start a timer on someone else's task. If you scope "other
  running tasks" to the caller's user id, a manager starting worker A's task
  won't stop A's other running timer, so A ends up with two running timers.
  Use `task.assignedToUserId` as the owner key.

**Why:** privileged callers (manager/admin) can act on tasks they don't own, so
caller-scoped enforcement silently leaks the invariant.

- **Stop each other timer with an atomic compare-and-set, not select-then-update.**
  `UPDATE tasks SET timerStartedAt = null WHERE id = ? AND timerStartedAt = <observed value> RETURNING id`,
  and only write the time log / activity log when a row was actually claimed.
  A plain select-then-update lets two concurrent start requests both observe the
  same running interval and both log elapsed minutes (double-counted time).

**How to apply:** any new code path that auto-stops/auto-closes a running
interval (timers, sessions) must guard on the exact start timestamp and only
record elapsed time for the request that won the update.
