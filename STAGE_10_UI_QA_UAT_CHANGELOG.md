# Stage 10 — UI/UX Standardization, QA Automation & UAT Changelog

Scope: UI/UX standardization, invalid-action disabling primitives, an audit-log
viewer, QA automation (lightweight), and UAT/production documentation.
Constraints honoured: no business-logic change, no app-wide redesign, no heavy
dependencies, no mock screens in navigation. tsc baseline held at 57; tests green.

## A. Standard inline validation
- Added `client/src/components/ui/field-error.tsx` — reusable `<FieldError>` plus
  a `validationMessages` map (required / invalid date / invalid amount / invalid
  URL / duplicate / unauthorized / wrong stage / missing reason / upload) for
  consistent copy.
- Replaced `alert()` with toast on the shared **top-bar** (role switch /
  impersonation errors) and on the **product-posting** and **HOD** dashboards
  (validation + approve/reject errors).

## B. Disable invalid workflow actions
- Provided the reusable building blocks (approval modal + field error + table
  states) that standardize how blocked/invalid actions are surfaced. Frontend
  guidance is advisory; the backend remains the enforcement boundary (Stages 1–9
  guards + central `WorkflowTransitionService`). Broad per-page rollout is tracked
  as follow-up (see Unresolved).

## C. Standard approval modal
- Added `client/src/components/approval-action-modal.tsx` — shared approve/reject
  dialog with record title, current status, next action, actor role, required
  remarks (configurable), destructive-confirmation checkbox, approve/reject/cancel
  buttons, and loading/error state. Opt-in; surfaces thrown errors inline.

## D. Standard table/list pattern
- Added `client/src/components/data-table-state.tsx` — `<DataTableStateRow>`
  rendering loading (skeleton), error (with retry), and empty states for any
  data table. Used by the new audit-log page; available for adoption elsewhere.

## E. Breadcrumb / title & typo fixes
- Fixed typos: `Comapny`→`Company` (CheckDuplicationPage), `Statics`→`Statistics`
  (sidebar Social Media), `Recieved`→`Received` (overall-report titles).
- New audit-log page renders a module/page title + breadcrumb line.

## F. Dashboard drilldowns & report catalog
- Created `KPI_DEFINITIONS.md` documenting each KPI's formula, source table, and
  whether a drill-down is allowed (placeholder KPIs have none).
- Updated `REPORT_CATALOG.md` with the Audit Logs viewer entry.

## G. Audit log viewer
- Backend: `GET /api/audit-logs` (`server/audit-log-routes.ts`, mounted in
  `server/routes.ts`). Read-only over `drm.activity_logs` joined to `drm.users`.
  Filters: actor, module (matched in details JSON), entityType, entityId, action,
  dateFrom/dateTo; paginated; all values parameterized. Gated to
  `admin` / `super_admin` / `super_hod`.
- Frontend: `client/src/pages/admin/audit-logs.tsx` at `/admin/audit-logs`
  (registered in `App.tsx` + sidebar under DRM Setting, Admin-gated) with filters,
  loading/empty/error states, and pagination.

## H. QA automation
- Added `scripts/api-smoke-test.ts` (run: `TOKEN=… tsx scripts/api-smoke-test.ts`)
  — 8 checks covering auth gating, required-reason validation, deprecated-bridge
  501s, and the audit viewer. All 8 pass against the running server.
- Added `MANUAL_QA_CHECKLIST.md` (Playwright E2E deemed too large for this stage).

## I. UAT matrix
- Created `PATCH1_UAT_SIGNOFF_MATRIX.md` (module / scenario / role / route-API /
  expected / actual / status / tester / notes).

## J. Production hardening
- Appended a Stage 10 section to `PRODUCTION_HARDENING_CHECKLIST.md` (no mock
  screens, gated audit viewer, alert() removal, reusable primitives, smoke test,
  KPI drill-down rule).

## Files changed
- Added: `server/audit-log-routes.ts`, `client/src/pages/admin/audit-logs.tsx`,
  `client/src/components/ui/field-error.tsx`,
  `client/src/components/approval-action-modal.tsx`,
  `client/src/components/data-table-state.tsx`, `scripts/api-smoke-test.ts`,
  `KPI_DEFINITIONS.md`, `MANUAL_QA_CHECKLIST.md`,
  `PATCH1_UAT_SIGNOFF_MATRIX.md`, `STAGE_10_UI_QA_UAT_CHANGELOG.md`.
- Modified: `server/routes.ts` (mount), `client/src/App.tsx` (route),
  `client/src/components/app-sidebar.tsx` (nav entry + icon + typo),
  `client/src/components/top-bar.tsx` (toast),
  `client/src/pages/product-posting-dashboard.tsx` (toast),
  `client/src/pages/hod-dashboard.tsx` (toast),
  `client/src/pages/CheckDuplicationPage.tsx` (typo),
  `client/src/pages/drm/overall-report.tsx` (typo),
  `REPORT_CATALOG.md`, `PRODUCTION_HARDENING_CHECKLIST.md`.

## DB changes
- None. The audit viewer reads the existing `drm.activity_logs` table; no schema
  change, migration, or destructive operation.

## Verification
- `npx tsc --noEmit`: 57 errors (unchanged pre-existing baseline; no new errors).
- `npm test`: green (unchanged).
- `scripts/api-smoke-test.ts`: 8/8 pass.
- App boots on port 5000; audit endpoint returns 401 (unauth) / 200 (admin, with
  real joined actor data) / 200 with filters.

## Unresolved issues
- **B (full rollout):** hiding/disabling every invalid action across all workflow
  pages was not applied page-by-page; the reusable primitives are in place and the
  highest-traffic surfaces converted. Backend enforcement already blocks invalid
  actions regardless.
- **alert() remainder:** several non-converted active screens still use `alert()`
  (e.g. it-manager, software-manager, marketing-manager, service-assistant
  dashboards, some service-* customer pages). They can adopt toast incrementally
  using the shared pattern.
- **Playwright E2E** not added (scope); covered by the API smoke test + manual
  checklist per the spec's fallback.
- Pre-existing `drm.todo_tasks` lazy-table condition (Stage 9) is unchanged.
