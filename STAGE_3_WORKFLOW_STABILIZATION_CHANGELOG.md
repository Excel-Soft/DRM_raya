# Stage 3 — Workflow Stabilization (PMS / Product-Posting / Software / QA / Verification)

Goal: make the workflow review screens backend-driven, remove localStorage and
hardcoded mock state that acted as a source of truth, surface workflow
transitions honestly, and enforce a single active timer. No business-workflow,
approval-logic, role, or permission changes were made beyond the timer
invariant, a final-completion notification, and label corrections. No UI
redesign — only data sources, states, notifications, and copy were touched
within the existing layouts.

## Files changed

- `client/src/components/qa-manager-widget.tsx`
- `client/src/components/verification-manager-widget.tsx`
- `client/src/pages/dd-manager-dashboard.tsx`
- `client/src/pages/dd-executive-dashboard.tsx`
- `client/src/pages/software-executive-dashboard.tsx`
- `server/routes/task-execution-routes.ts`
- `server/routes/product-posting-workflow-routes.ts`
- `server/routes/software-workflow-routes.ts`

## localStorage / mock workflow state removed

- **qa-manager-widget.tsx**
  - Removed the `localStorage('qa-projects')` 1s poller + storage listener and
    the derived `qaStorageProjects` rows.
  - Removed the hardcoded `defaultPendingData` demo rows.
  - Removed the `localStorage('mock_qa_hidden_keys')` persistence; hidden rows
    are now in-session only (a transient UI nicety until the backend queue
    refetches — not a source of truth).
  - Removed the Save-button mock handoff that wrote `mock_verification_queue`,
    `mock_dd_waiting_queue`, and `mock_pp_waiting_queue`. QA review is now solely
    the `qa-review` API call.
  - Stat cards (`Total Project`, `Complete`, `Changing`) now use real
    `pms/stats` values / derived counts instead of hardcoded `6030 / 5102 / 925`.
  - The queue list is now exactly the backend `product-posting/qa/queue` rows.

- **verification-manager-widget.tsx**
  - Removed the `localStorage('mock_verification_queue')` poller + `mockQaApproved`.
  - Removed the hardcoded `defaultPendingCompanies` demo rows.
  - Removed the Save-button mock handoff writing `mock_verification_queue`,
    `mock_dd_waiting_queue`, `mock_pp_waiting_queue`.
  - Stat cards now use real values instead of `6030 / 5102 / 925`.
  - The list is now exactly the backend `product-posting/verification/queue` rows.

- **dd-manager-dashboard.tsx**
  - Removed the `localStorage('mock_dd_approved_queue')` write inside
    `verifyDocMutation`.
  - Removed the `onError` handler that faked success ("verified successfully
    (Mock Mode)"); document verification now surfaces real API errors via a
    destructive toast.

- **dd-executive-dashboard.tsx**
  - Removed the `localStorage('software_tasks')` read/merge. That key's only
    writer (the team-workspace screen) was migrated to the backend in the prior
    stage, leaving this an orphaned read. The executive task list is now sourced
    purely from `/api/dd-executive/tasks/:tab`.

- **software-executive-dashboard.tsx**
  - Removed the `localStorage('software_tasks')` loader/writer and the
    `softwareTasks` state (never rendered here; the displayed list comes from
    `/api/dd-executive/tasks/:tab`). `handleMoveToWaiting` keeps its visible
    behaviour (switching to the Waiting tab) without the localStorage write.

After these changes, `localStorage.getItem/setItem` no longer appears in any of
the workflow surfaces (only explanatory comments remain). The theme provider's
localStorage use is unrelated and was intentionally left as-is.

## APIs used / modified

- **Used (unchanged contracts), now the sole source of truth:**
  - `GET /api/product-posting/qa/queue`
  - `GET /api/product-posting/verification/queue`
  - `GET /api/dd-executive/tasks/:tab`
  - `GET /api/pms/stats`
  - `POST /api/product-posting/tasks/:taskId/qa-review`
  - `POST /api/product-posting/tasks/:taskId/verification-review`
  - `PUT /api/projects/documents/:id/verify`

- **Modified (additive only):**
  - `POST /api/tasks/:id/timers/start` — now enforces a single active timer per
    user (see below).
  - `POST /api/product-posting/tasks/:taskId/verification-review` (complete
    branch) — now emits a final-completion notification.
  - `POST /api/software/tasks/:taskId/verification-review` (complete branch) —
    now emits a final-completion notification.

## Single active timer (backend enforcement)

`POST /api/tasks/:id/timers/start` now, before starting/restarting, finds any
other running task belonging to the **task's assignee** (scoped to
`task.assignedToUserId`, not the caller — so a manager starting a worker's task
still stops that worker's other timers), stops each via an **atomic
compare-and-set** (`UPDATE ... WHERE id = ? AND timerStartedAt = <observed>`
`RETURNING id`), and only logs elapsed minutes to `task_time_logs` /
`TIMER_AUTO_STOPPED` when the update actually claimed the row. The
compare-and-set guard prevents concurrent start requests from double-logging the
same running interval. Previously tracked time is preserved (no data loss, no
silent truncation).

## Final-completion notification

When a task clears verification (`VERIFICATION_COMPLETE`, the final phase) in
both the product-posting and software workflows, the assigned executive and the
owning manager now receive a `SUCCESS` notification. The entire notification
block is wrapped in `try/catch` so a notification failure is logged and
swallowed — it never turns an already-committed phase transition into a 500.

## Label corrections (software workflow surfaces)

The software workflow router (`/api/software/...`) had user-facing notification
copy copy-pasted from product-posting that read "Product Posting task". The
six notification messages (overtime, submit-to-manager, ready-for-QA,
ready-for-verification, QA-return, verification-return) now read "Software
task". Non-message, data-affecting defaults (task title template, the
`taskTypeLabel`/`executiveDashboardUrl` routing defaults) were intentionally
left untouched to avoid changing created records or downstream matching logic.

## Verified already-correct (no change needed)

- PMS pages (pms-tasks, pms-status, pms-task-history, pms-completed-projects,
  pms-project-report, pms-team-workspace) are already backend-driven via
  TanStack Query with loading/empty/error states and no localStorage source of
  truth (addressed in the prior stage).
- Backend already enforces evidence-URL validation + duplicate prevention
  (product-posting and software) and a required rework reason on QA and
  verification returns.
- `workflow-timeline.tsx` already exists and is embedded in the QA / verification
  / product-posting executive widgets.
- No genuine software *frontend* surface mislabels copy as "Product Posting"
  and no software dashboard calls a `/api/product-posting/*` endpoint; the only
  mislabels were the backend software-route notification strings fixed above.

## Verification

- `npm run check`: 58 TypeScript errors, identical to the pre-existing baseline;
  0 new errors, and none in any file changed by this stage (all baseline errors
  are in unrelated `reports-routes.ts` / `repositories/*`).
- App boots: `Start application` workflow serves on port 5000 with no runtime
  errors (only the expected unauthenticated `GET /api/auth/me -> 401`).

## Known limitations / not done

- The QA / verification "Project Details" modals still render some static
  placeholder rows (e.g. `Product_detail_add`, `Package`, `Phone`) because no
  per-task detail endpoint backs that modal. These are display placeholders, not
  workflow queue/state, and wiring a new detail endpoint is out of this stage's
  scope.
- The cross-module "Important" counters (delay / notice / complaints / event)
  on the QA / verification widgets remain static dashboard chrome; they are not
  part of the review workflow state and were left untouched to avoid scope creep.
- `software_tasks` is fully retired on the read side; no replacement personal
  "to-do" backend queue was added (its producer was already migrated upstream),
  so the software executive's "move to waiting" action only switches the tab and
  has no separate backend persistence.
