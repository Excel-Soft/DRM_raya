# Patch 6 Stage 4 — Workflow Synchronization Changelog

Central cross-department workflow synchronization + legal-transition services for
PMS, Product Posting, Software, QA, Verification, and dashboards/reports.

## Scope decision (what was already in place)

A recon pass found most of the spec already implemented in earlier stages. Stage 4
therefore **builds only the two genuine gaps** and **documents** the rest. No
working service was rewritten.

| Spec area | Verdict | Action |
|-----------|---------|--------|
| CrossDepartmentStatusService (ledger + audit + notify) | already implemented | documented; left as-is |
| Product/Software/QA/Verification legal-transition machine | already implemented (`workflow-transition.service.ts`) | documented |
| localStorage / mock-data removal | already done (only theme + auth tokens remain) | documented |
| Workflow timeline UI (`client/src/components/workflow-timeline.tsx`) | already present | documented |
| Dashboards/reports read official stored status | already done | documented |
| **PMS ad-hoc status updates** | **gap** | **built central PMS transition service + rewired endpoints** |
| **Broad workflow reconciliation report** | **gap** | **built `GET /api/workflow/reconciliation`** |

## Files changed

- **Added** `server/services/pms-transition.service.ts` — central PMS task/project
  transition machine (state map, canonical transitions, validation, orchestrators,
  best-effort audit + notify). Permissive by default.
- **Added** `server/routes/workflow-reconciliation-routes.ts` — read-only,
  role-gated workflow reconciliation report.
- **Modified** `server/pms-routes.ts` — routed `PATCH /api/pms/task/:id/status`
  and `PATCH /api/pms/running-projects/:id/status` through the new service; added a
  `collectActorRoles` helper. Legacy HTTP outcomes preserved.
- **Modified** `server/routes.ts` — mounted the reconciliation router at
  `/api/workflow`.
- **Added docs** `PMS_STATE_MACHINE.md`,
  `PRODUCT_SOFTWARE_QA_VERIFICATION_STATE_MACHINE.md`,
  `CROSS_DEPARTMENT_STATUS_SERVICE.md`, `WORKFLOW_RECONCILIATION_REPORT.md`,
  and this changelog.

## Services added

- `PmsTransitionService` (`changeTaskStatus`, `changeProjectStatus`,
  `validateTaskTransition`, `isLegalTaskTransition`, `isLegalProjectTransition`,
  `mapPmsError`, `PmsTransitionError`).

## APIs added / modified

- **Added** `GET /api/workflow/reconciliation` (admin / super_hod / super_admin),
  read-only.
- **Modified (behaviour-preserving)** `PATCH /api/pms/task/:id/status` and
  `PATCH /api/pms/running-projects/:id/status` — now go through the central
  service. With the default config the status codes, error messages, and response
  bodies are unchanged; the service additionally writes best-effort audit +
  notifications.

## DB changes

- **None.** No schema migrations, no new tables. The PMS service maps logical
  states onto the **existing** `task_status` / `project_status` enums; the
  reconciliation report is pure read-only SQL over existing tables. (`db:push`
  remains broken repo-wide; nothing here needs it.)

## State machines implemented

- **PMS task/project** — 10 logical states mapped onto existing enums, with
  canonical transition maps enforced only under strict mode. See
  `PMS_STATE_MACHINE.md`.
- Product Posting / Software / QA / Verification machine was **already**
  implemented; documented in `PRODUCT_SOFTWARE_QA_VERIFICATION_STATE_MACHINE.md`.

## localStorage / mock removed

- **None removed in this stage** — earlier stages had already removed business
  localStorage/mock usage. Remaining `localStorage` use is limited to UI theme and
  auth-token storage (legitimate); no mock/static business data was introduced.

## Config (env-overridable, safe defaults preserve current behaviour)

- `PMS_STRICT_TRANSITIONS=false`, `PMS_REQUIRE_RETURN_REASON=false`,
  `PMS_REQUIRE_SUBMIT_EVIDENCE=false`, `PMS_REQUIRE_COMPLETE_REMARKS=false`,
  `PMS_ALLOW_MANAGER_ACT=false`.
- `WORKFLOW_VERIFICATION_PENDING_MAX_DAYS=3` (reconciliation threshold).

## Tests run

- `npx tsc --noEmit` — clean (0 errors).
- `npx vitest run` on `workflow-transition.service`, `workflow-status.service`,
  `stage10-operational`, `stage10-smoke`, `sql-safety` — **75 passed**.
- Full prior suite baseline: 200 passed (13 files).
