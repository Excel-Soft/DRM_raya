# Patch 2 — Stage 1: Shared Report Safety Foundation (Changelog)

Foundation stage. Adds shared safety primitives so report pages stop hiding
failures behind mock rows or fake success, **without** fully implementing each
report, removing routes, or changing unrelated modules.

## Files changed

### Added
- `server/middleware/report-permission.ts` — `requireReportPermission(reportKey, action)`
  + the report permission matrix + `resolveReportRoles()`.
- `client/src/lib/reportApi.ts` — shared report query/export helpers.
- `client/src/components/report/report-states.tsx` — shared report UI states.
- `server/report-permission.test.ts` — unit tests for the guard + route wiring.
- `PATCH2_REPORT_PERMISSION_MATRIX.md` — report ownership/permission matrix.
- `PATCH2_STAGE1_REPORT_SAFETY_CHANGELOG.md` — this file.

### Modified
- `server/reports-routes.ts` — imported `sendApiError` + `requireReportPermission`;
  registered a permission-gated `GET /api/reports/day-target` that returns an
  honest `501 NOT_IMPLEMENTED` (registered before the catch-all `GET /reports/:type`).
- `client/src/pages/reports-day-target.tsx` — removed the mock fallback; now uses
  `apiRequestJson` + real loading/error/empty states with a Retry button
  (`retry: false` so the error surfaces immediately).
- `client/src/pages/reports-diagnose.tsx` — switched the BV query to
  `apiRequestJson` so a backend failure surfaces a real error state with Retry
  instead of silently rendering an empty table.

## Shared components/helpers added

**UI states** (`report-states.tsx`): `ReportLoadingState`, `ReportEmptyState`,
`ReportErrorState` (with retry), `ReportValidationMessage`, `ReportToolbar`,
`ReportPagination`, `ReportExportButton`. The existing table-row variant
`DataTableStateRow` is re-exported for a single import surface.

**Query/export helpers** (`reportApi.ts`): `buildReportQueryParams`,
`validateDateRange` (start ≤ end), `validateRequiredFilter`,
`downloadReportExport` (checks `res.ok` **and** content-type before blobbing —
never saves a JSON error envelope as a `.csv`), `safeReportFilename`
(report name + date range + optional user/branch).

## Mock fallback removed
- `reports-day-target.tsx`: the hardcoded "Shaila Khaild" fallback rows in the
  query `catch` block — the only fake-data fallback found in the Patch 2 pages —
  were removed. A backend failure now shows an error state, not fabricated rows.

## Permissions helper added
- `requireReportPermission(reportKey, action)` — thin wrapper over
  `requireActionPermission`; fails closed (401/403) with the standard sanitized
  error envelope; matrix written in normalized role keys; `admin` + `super_hod`
  always allowed. Wired this stage onto `day_target/view` only (see matrix doc
  for the agreed target rollout for the remaining reports).

## Backend error envelope (Task D)
- Reused the existing `server/utils/api-error.ts` envelope
  (`{ success:false, error:{ code, message, details? }, message }`) — no stack
  traces, SQL, or secrets. The new day-target route emits it via `sendApiError`.

## Test commands run
- `npm run check` (tsc `--noEmit`) — baseline error count unchanged (57).
- `npm test` (vitest) — full suite green, including the new
  `server/report-permission.test.ts`.
- Manual: `GET /api/reports/day-target` unauthenticated → `401`; authorized
  admin → `501 NOT_IMPLEMENTED` (honest, not fake-empty).

## Known limitations / unresolved
- `requireReportPermission` is wired onto `day_target/view` only this stage. The
  remaining report endpoints keep their current gating; applying the full matrix
  per endpoint is deferred to the later per-report stages to avoid changing
  existing access behavior all at once (GLOBAL-001).
- The new shared UI/helper components are an opt-in library; existing report
  pages are not yet refactored to use them (out of scope for a foundation stage).
- The day-target report has no data source yet; it intentionally returns `501`
  until the report is implemented in a later stage.
- Permission matrix governs **API actions only**; sidebar visibility remains in
  `drm.menu_permissions` (kept as a separate source of truth).
