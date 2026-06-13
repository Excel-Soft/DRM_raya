# Patch 3 — Stage 4: Workflow Transition Service (hardening + cleanup)

Scope: a **surgical** hardening, cleanup, and documentation patch on top of the
already-existing centralized `WorkflowTransitionService`. The state machine engine,
the per-entity workflow timeline, the notification service, and
`WORKFLOW_STATE_MACHINE.md` were already present and wired before this stage; this
patch closes one write-path bypass, removes fabricated workflow data from one
dashboard, adds an advisory read-only helper, and corrects Software-screen wording.

**Hard rules honored:** no workflow-UI rewrite, no business status/phase renames,
no localStorage/mock workflow state introduced, existing manager/executive/QA/
verification queues untouched, no destructive DB changes (no migrations, no
table/column drops).

---

## 1. Close the PMS project-update bypass (spec C)

**File:** `server/pms-routes.ts` — `PUT /api/pms/projects/:id`

Previously the handler spread the entire request body into the update
(`const { ownerUserId, ...updateData } = req.body`), so a manager/owner could set
workflow-owned columns (e.g. `status`, `currentPhase`, `invoiceId`) directly,
skipping the state machine.

Now the handler is **fail-closed**:

- **Reject (HTTP 400, no DB write)** any request that includes a workflow-sensitive
  field: `status`, `currentPhase`/`current_phase`/`phase`, `departmentType`,
  `invoiceId`, `ownerUserId`, the manager/executive/QA/verification actor-id fields
  (`assignedToUserId`, `managerUserId`, `qaUserId`, `qaManagerUserId`,
  `verificationUserId`, `verificationManagerUserId`, `executiveUserId`),
  `isDeleted`, `id`, and the `createdAt`/`updatedAt` timestamps (camelCase and
  snake_case variants are both detected). The response lists the offending `fields`.
- **Allowlist** of editable metadata only (keys matched to the Drizzle column
  names): `name`, `description`, `workSpace`, `customerId`, `startDate`, `endDate`,
  `notes`. Anything else is ignored.
- If, after filtering, there is nothing editable to write → **400** "No editable
  fields provided" (no DB write).

Editing ordinary metadata still works; workflow state can only move through the
centralized service.

## 2. Software wording fix (spec L)

**File:** `server/routes/software-workflow-routes.ts`

- Default assign-task **title** `Product Posting - ${project.name}` →
  `Software - ${project.name}`.
- Default assign-task **description** `...for product posting workflow of...` →
  `...for software workflow of...`.
- Audit-log detail string `Assigned product posting task to executive...` →
  `Assigned software task to executive...`.

**Intentionally left as-is:** the executive-dashboard routing URL
(`/product-posting/executive`) for `PRODUCT_POSTING`/`SOFTWARE` departments. That is
functional routing (Software shares the Product Posting executive dashboard), not a
display string; changing the target would alter navigation and is out of scope for a
wording fix.

## 3. `getAllowedWorkflowActions` helper (spec J, partial)

**File:** `server/services/workflow-transition.service.ts`

Added a **pure, read-only** projection of `WORKFLOW_TRANSITIONS`:

```ts
getAllowedWorkflowActions({ fromPhase, actorRole?, actorRoles? }): AllowedAction[]
```

It returns the actions a role could legally initiate from a phase, using the same
action/legal-state + role semantics as `validateTransition` (admin always passes;
a `null` role-set means unrestricted at this layer; no role context → no
role-filtering). It performs **no DB writes** and never throws. It is **advisory
only** — ownership/content rules and the authoritative guard still run at write
time.

**Deferred (documented, not built):** wiring this to an endpoint and gating the
workflow UI buttons against it — that is a multi-screen UI change and a rewrite
risk.

## 4. Remove Software Manager mock workflow tables (spec J)

**File:** `client/src/pages/software-manager-dashboard.tsx`

The fabricated, hard-coded workflow/project arrays were neutralized to `[]` (typed
`any[]`), so no invented company names or "Alibaba Product Posting" rows render:

- `pmsSettingRows`
- `taskCreateRows` (seed rows removed; `useState<any[]>([])`)
- `pendingProjectRows`
- `projectTaskRows`
- `projectReportRows`
- `departmentProjectRows`
- `performanceRows`
- `projectListRows`

Layout, tabs, search, and export controls are unchanged. The two primary queue
tables (pending projects, project tasks) now render an honest empty state
("No pending projects" / "No project tasks") matching the dashboard's existing
empty-state pattern; the remaining secondary report/analytics tables render
header-only when empty (no fabricated rows).

**Deferred (documented, not built):** live-wiring these dashboard tables to real
endpoints (e.g. `/api/software/manager/queue`). The legacy table markup renders the
id inside a small avatar circle and includes `hod`/`dep` approval columns the queue
endpoint does not supply, so a faithful wiring is a layout change, not a drop-in.
The real software-manager queue remains available through the already-wired
dashboard widgets.

**Left untouched (out of scope):** the HR tabs (overtime / loans / leaves, served by
the real `/api/admin/*` endpoints) and the team / leave-balance tables
(`teamRows`, `teamBalanceRows`) — these are HR data, not workflow mock state.

## 5. Documentation (spec M)

- **This file** created.
- `WORKFLOW_STATE_MACHINE.md` updated with:
  - an "Allowed-actions projection (advisory)" section documenting
    `getAllowedWorkflowActions` and the deferred UI gating, and
  - a "Source-of-truth file paths" table citing the real paths
    (`server/services/notification-service.ts`,
    `client/src/components/workflow-timeline.tsx`, the workflow routes, etc.),
    including the note that the timeline component is intentionally **not** moved
    into a `workflow/` subdirectory.

---

## Validation

- `npm run check` — TypeScript error count **56**, within the known pre-existing
  baseline (~57–58); no new errors in any file touched by this stage.
- `npm test` — **125 / 125** passing (8 files).
- App boots cleanly on the `Start application` workflow.

## Deliberate defers (not built this stage)

- UI-wide `allowedActions` button gating (workflow-UI rewrite risk).
- Live-wiring the Software Manager dashboard tables to real endpoints (legacy table
  layout mismatch).
- Moving `workflow-timeline.tsx` into a `workflow/` subdirectory (would break
  imports for no functional gain).
- New DB tables / migrations; D&D read-only routes unchanged; no status/phase
  renames.
