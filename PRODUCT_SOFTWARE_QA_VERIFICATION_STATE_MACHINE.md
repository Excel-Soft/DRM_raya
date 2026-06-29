# Product Posting / Software / QA / Verification State Machine

> **Status: pre-existing, documented in Patch 6 Stage 4.** This document records
> the workflow machine that already governs the Product Posting, Software, QA, and
> Verification phases. Stage 4 did **not** rewrite it; it only documents it and
> adds the reconciliation report (see `WORKFLOW_RECONCILIATION_REPORT.md`) that
> surfaces drift in this chain.

## Authority

`server/services/workflow-transition.service.ts` is the central legal-transition
authority for the Product Posting and Software department workflows. It owns:

- the phase model stored in `drm.product_posting_workflows.current_phase` and
  `drm.software_workflows.current_phase` (text, default `PENDING_PROJECT`);
- `WorkflowTransitionError` (carrying an HTTP `status` + `code`) and a
  response-mapping helper;
- validation of each phase move (illegal moves are rejected, not silently
  applied), plus QA rework / escalation accounting
  (`WORKFLOW_REWORK_ESCALATION_COUNT`, env-overridable);
- best-effort audit + notification on each transition.

Modules do **not** mutate these phases independently — they call the service.

## Phase chain (high level)

```
PENDING_PROJECT → IN_EXECUTION → READY_FOR_QA → (QA review)
   QA pass → QA_COMPLETE → (verification review)
       verification pass → VERIFIED / COMPLETE
       verification fail → back for rework
   QA fail → returned for rework (rework counter increments;
             repeated failures escalate)
```

Key timestamps on each workflow row:
- `qa_reviewed_at` — when QA signed off.
- `verification_reviewed_at` — when verification signed off (null ⇒ still pending).
- `verification_user_id`, `verification_remarks` — verification actor + notes.

## Cross-department coupling

- **Listing-page → Product-posting dependency.** A Product Posting INVOICE_ROOT
  project can be held (`OnHold`) until its prerequisite Listing Page passes QA.
  This is tracked in `drm.project_dependencies`
  (`dependency_type = 'LISTING_PAGE_QA_APPROVAL'`, `status`, `satisfied_at`). When
  the prerequisite's QA is approved the dependency is satisfied and the dependent
  project is released. The reconciliation report flags any project left `OnHold`
  while its dependency is already satisfied.
- **Status propagation to dashboards/reports.** Dashboards and reports read the
  stored official phase/status (no client-side guessing); see
  `CROSS_DEPARTMENT_FLOW.md`.

## QA / Verification reconciliation hooks

The Stage 4 reconciliation report (`GET /api/workflow/reconciliation`) reads these
tables read-only to surface:
- QA-complete items whose verification has been pending longer than
  `WORKFLOW_VERIFICATION_PENDING_MAX_DAYS` (default 3) — uses
  `qa_reviewed_at is not null and verification_reviewed_at is null`;
- projects `OnHold` with a satisfied listing-QA dependency.

No phase is mutated by the report.

## Patch 7 Stage 3 — additions

Stage 3 made three additive changes here; no phase model or transition was
rewritten.

- **Software assign-task label + executive routing fix.** In
  `server/routes/software-workflow-routes.ts` the assignment notification now
  defaults `taskTypeLabel = "Software"` (was a Product-Posting label) and routes
  the `SOFTWARE` department to `/dashboard/software-executive`. The other
  department targets are unchanged: `DND → /dd-executive-dashboard`,
  `PRODUCT_POSTING → /product-posting/executive`. The Product Posting route was
  not touched.
- **Spec-named QA/verification hooks.** The QA → verification hand-offs are now
  also reachable under their Patch-7 names — `onDepartmentManagerCompleted`,
  `onQaApproved`, `onVerificationCompleted` — as thin delegates over the existing
  `onWorkflowManagerCompleted` / `onWorkflowQaCompleted` /
  `onWorkflowVerificationCompleted` hooks (see
  `CROSS_DEPARTMENT_STATUS_SERVICE.md`). Behaviour is identical.
- **Reconciliation check #8** (`pms_workflow_status_mismatch`) was added to
  `GET /api/workflow/reconciliation` — see `WORKFLOW_RECONCILIATION_REPORT.md`.
  It flags a project marked `Completed` whose PP/Software workflow has not
  reached the terminal `VERIFICATION_COMPLETE` phase.

### Note on the workflow timeline component path

The client workflow-timeline component lives at
`client/src/components/workflow-timeline.tsx` (there is **no**
`client/src/components/workflow/` sub-directory). Any spec reference to
`client/src/components/workflow/workflow-timeline.tsx` is a path delta — the
actual file is the one above.
