# Patch 7 Stage 3 — Workflow Synchronization Changelog

Cross-department workflow-sync hardening. The Stage-3 infrastructure (central
transition services, cross-department ledger, reconciliation report, audit +
notification) **already existed**; this stage closed the few genuine gaps and
documented the system. It is minimal and additive: no working workflow, approval
rule, role, permission, UI, API contract, or DB business structure was rewritten,
and there are no duplicate endpoints or tables.

## Genuine gaps closed

### C — Software assign-task label + executive routing
`server/routes/software-workflow-routes.ts`
- Default `taskTypeLabel` is now `"Software"` (was a Product-Posting label), so the
  assignee notification reads correctly for software tasks.
- The `SOFTWARE` department now routes to `/dashboard/software-executive`.
  Unchanged: `DND → /dd-executive-dashboard`,
  `PRODUCT_POSTING → /product-posting/executive`.
- The Product Posting assign-task route was **not** touched.

### A1 — Reconciliation check #8 (`pms_workflow_status_mismatch`)
`server/routes/workflow-reconciliation-routes.ts`
- Added a read-only check (run-check names `status_mismatch_product_posting` and
  `status_mismatch_software`) over `drm.product_posting_workflows` and
  `drm.software_workflows`.
- Flags a project with `status = 'Completed'` whose workflow `current_phase` is
  not the terminal `VERIFICATION_COMPLETE`.
- The reverse direction is intentionally excluded (it would be mass false
  positives — workflows complete the task, not the parent project). Per-check
  `try/catch`, `limit 500`, no writes.

### A2 — CrossDepartmentStatusService spec-named API + 3 new ledger hooks
`server/services/cross-department-status.service.ts`
- **New best-effort ledger hooks** (real implementations, never throw, never
  mutate business status, deduped by `event_key`): `onGmApproved`,
  `onInvoiceCreated`, `onPmsTaskAssigned`.
- **Spec-name delegates** over existing hooks (no behaviour change):
  `onHodInvoiceApproved → onInvoiceHodApproved`,
  `onAccountInvoiceApproved → onInvoiceAccountApproved`,
  `onDepartmentManagerCompleted → onWorkflowManagerCompleted`,
  `onQaApproved → onWorkflowQaCompleted`,
  `onVerificationCompleted → onWorkflowVerificationCompleted`,
  `onServiceStatusChanged` (generalises `onServiceComplaintRaised`).

### Wiring the 3 new hooks (post-success, best-effort, `notify: false`)
- `onGmApproved` → `server/gm-pool-routes.ts` at the three GM final-approval
  success points: account-manager-approve, sales-manager-approve (both-managers
  branch), super-hod-approve.
- `onInvoiceCreated` → `server/services/gm-invoice-generation.service.ts`, one
  call per created invoice in the post-insert audit loop (the single GM→invoice
  generation chokepoint, covering all callers).
- `onPmsTaskAssigned` → `server/routes/product-posting-workflow-routes.ts` and
  `server/routes/software-workflow-routes.ts`, after the assign-task assignee
  notification.

## Files changed
- `server/routes/software-workflow-routes.ts` — C fix + `onPmsTaskAssigned` wiring.
- `server/routes/workflow-reconciliation-routes.ts` — check #8.
- `server/services/cross-department-status.service.ts` — spec-named API + 3 new hooks.
- `server/gm-pool-routes.ts` — `onGmApproved` wiring (+ import).
- `server/services/gm-invoice-generation.service.ts` — `onInvoiceCreated` wiring (+ import).
- `server/routes/product-posting-workflow-routes.ts` — `onPmsTaskAssigned` wiring.
- Docs: this file (new) + updates to `CROSS_DEPARTMENT_STATUS_SERVICE.md`,
  `PMS_STATE_MACHINE.md`, `PRODUCT_SOFTWARE_QA_VERIFICATION_STATE_MACHINE.md`,
  `WORKFLOW_RECONCILIATION_REPORT.md`.

## Services added / modified
- No new service files. `CrossDepartmentStatusService` gained 9 public methods
  (3 real hooks + 6 spec-name delegates/generalisations); the core `record()`
  writer is unchanged.

## APIs added / modified
- No new routes and no changed request/response contracts. `GET
  /api/workflow/reconciliation` (existing, role-gated) gains one additional check
  type in its `summary`/`issues` output.

## Database changes
- None. No schema migration, no `db:push`. The pre-existing
  `drm.cross_department_status_history` ledger table is still provisioned at
  runtime via `ensureSchema()` (idempotent `CREATE TABLE IF NOT EXISTS`). No
  destructive operations.

## State machines
- No state machine was added or rewritten. PMS
  (`pms-transition.service.ts`) and Product-Posting/Software/QA/Verification
  (`workflow-transition.service.ts`) remain the sole authorities; the new hooks
  are post-commit ledger/audit records that never mutate status or phase.
  Terminal workflow phase for both PP and Software is `VERIFICATION_COMPLETE`.

## localStorage / mock source-of-truth removed
- None found and none introduced. All status reads/writes go through the existing
  server services and DB; the new code adds no client-side or mocked source of
  truth.

## Reports / dashboards updated
- Reconciliation report gains the `pms_workflow_status_mismatch` check. No
  dashboard data source changed; the software assign-task fix corrects the
  executive-dashboard deep link in the assignee notification.

## Spec-name → actual-name mapping
| Spec name | Actual implementation |
|-----------|-----------------------|
| `onGmApproved` | new real hook |
| `onInvoiceCreated` | new real hook |
| `onPmsTaskAssigned` | new real hook |
| `onHodInvoiceApproved` | delegate → `onInvoiceHodApproved` |
| `onAccountInvoiceApproved` | delegate → `onInvoiceAccountApproved` |
| `onDepartmentManagerCompleted` | delegate → `onWorkflowManagerCompleted` |
| `onQaApproved` | delegate → `onWorkflowQaCompleted` |
| `onVerificationCompleted` | delegate → `onWorkflowVerificationCompleted` |
| `onServiceStatusChanged` | generalises `onServiceComplaintRaised` |

## Path deltas vs. spec
- Workflow timeline component: actual `client/src/components/workflow-timeline.tsx`
  (no `client/src/components/workflow/` sub-directory).

## Verification
- `npm run check` (tsc `--noEmit`): exit 0, 0 errors.
