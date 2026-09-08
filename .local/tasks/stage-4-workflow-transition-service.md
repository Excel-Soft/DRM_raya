# Stage 4 Workflow Transition Service

## What & Why
Create a centralized WorkflowTransitionService that governs all phase changes
across PMS, Product Posting, D&D/Software, QA, and Verification, so transitions are
validated consistently (legal state, role, ownership, evidence/reason), applied
atomically with related records, and recorded in history. Replaces ad-hoc,
name-text-based routing and any localStorage/mock queue behavior. Builds on Stage 2
(audit/notification) and Stage 3 (invoice → project handoff).

## Done looks like
- A single service decides whether a transition is allowed and performs it; illegal
  state changes return 400, wrong role/ownership returns 403, and no DB write
  happens on rejection.
- Work moves only through legal phases (Project Pending → Project Overview → Task
  Assignment → Running → Manager Review → QA Review → Verification Pending →
  Completed), with defined return/rework paths.
- Executives can only act on their own assigned tasks in the right stage; managers
  only on their team/department tasks; QA only at QA stage; Verification only at
  Verification stage; admins can override only with a reason (audited).
- Changing a phase updates the related workflow phase, PMS task status, project
  status, and history rows together in one transaction (no partial updates).
- Evidence submissions require a valid URL/file reference, block duplicates for the
  same task, and enforce the minimum count where a business rule exists.
- Manager/QA/Verification returns require a reason, track a return count, surface
  rework history, and escalate past a configurable threshold
  (WORKFLOW_REWORK_ESCALATION_COUNT, default 3).
- Overtime requests require positive minutes, a reason, task ownership, an eligible
  task, block duplicate pending requests, and go through approval with audit +
  notification.
- Routing uses structured fields (departmentType, serviceType, projectType,
  workflowType), not project/invoice name text.
- QA/Verification/Product/Software/PMS queues come only from the backend — no
  localStorage fallback or mock rows; empty states show when there is nothing;
  invalid action buttons are disabled based on backend-provided allowed actions.
- A reusable workflow timeline shows the full state history of an item.

## Out of scope
- Rewriting the entire workflow UI or changing business statuses without safe
  mapping of existing values.
- Stage 3 invoice work (separate, prerequisite task).

## Decisions / constraints
- Reuse existing enum values; map existing statuses safely; do not force new DB
  statuses if equivalents already exist.
- If records lack structured routing fields, add nullable columns safely or derive
  once during transition; keep text fallback only as temporary compatibility and
  document records needing cleanup.
- No destructive DB commands.

## Steps
1. **WorkflowTransitionService** — Create the central service with a single
   `transitionWorkflow(...)` entry point taking workflow/entity type, from/to
   state, actor + active role, ownership/department context, reason, evidence, and
   a transaction callback for related updates.
2. **Transition maps** — Define allowed transitions per workflow type using
   existing enum values, including the return/rework paths.
3. **Guard rules** — Enforce legal from→to state, allowed role per transition,
   ownership/management of the record, and required reason/evidence; 400 for
   illegal state, 403 for role/ownership, with no DB write on failure.
4. **Role-by-stage & ownership** — Apply executive/manager/QA/verification/admin
   rules and task-ownership checks for submit/return/complete actions.
5. **Atomic synchronization** — Within one transaction, update workflow phase, PMS
   task status, project status, task/workflow history, rework history, and
   notifications.
6. **Evidence validation** — Validate URL/file references, require title/type where
   supported, store actor/timestamp, block duplicates, and enforce minimum counts.
7. **Overtime validation** — Enforce positive minutes, reason, ownership,
   eligibility, duplicate-pending blocking, and approval with audit + notification.
8. **Return/rework** — Require reason, determine returned-to user/stage, track
   return count and rework history, and escalate past the configurable threshold.
9. **Structured routing** — Route by structured fields; add nullable columns or
   derive during transition where missing; document records needing cleanup.
10. **Backend-only queues** — Remove localStorage/mock queue behavior from
    QA/Verification/Product/Software/PMS frontends; show empty states; disable
    invalid actions from backend allowed-actions.
11. **Workflow timeline** — Add a reusable timeline component showing the full
    lifecycle of an item.
12. **Docs & verify** — Write STAGE_4_WORKFLOW_TRANSITION_CHANGELOG.md and
    WORKFLOW_STATE_MACHINE.md; run `npm run check` and `npm run dev`; run the 11
    workflow smoke tests.

## Relevant files
- `server/pms-routes.ts`
- `server/routes/task-execution-routes.ts`
- `server/routes/product-posting-workflow-routes.ts`
- `server/services/product-posting-workflow.service.ts`
- `server/routes/software-workflow-routes.ts`
- `server/services/software-workflow.service.ts`
- `server/routes/project-doc-routes.ts`
- `server/dd-manager-routes.ts`
- `server/dd-executive-routes.ts`
- `server/services/audit-log.service.ts`
- `server/services/notification-service.ts`
- `shared/schema.ts`
- `client/src/pages/pms-status.tsx`
- `client/src/pages/pms-tasks.tsx`
- `client/src/pages/pms-task-history.tsx`
- `client/src/pages/product-posting-dashboard.tsx`
- `client/src/pages/dd-manager-dashboard.tsx`
- `client/src/pages/dd-executive-dashboard.tsx`
