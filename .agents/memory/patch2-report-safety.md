---
name: Patch 2 report safety foundation
description: Report API authz matrix conventions, the reports-routes /reports/:type catch-all ordering trap, and the honest-501 pattern for not-yet-built reports.
---

## requireReportPermission / matrix conventions
`requireReportPermission(reportKey, action)` (server/middleware/report-permission.ts)
is a thin wrapper over `requireActionPermission`. The matrix is written in
NORMALIZED role keys, because `normalizeRole`:
- collapses `super_admin`/`administrator` → `admin` (so listing `super_admin`
  separately in a matrix is DEAD config),
- keeps `super_hod` distinct,
- collapses `accounts_office`/`account` → `account_manager`,
- collapses `dnd_manager` → `dd_manager`.
`admin` + `super_hod` are baked in as always-allowed for every action.

## Rollout decision (do this gradually)
Wire the matrix onto report endpoints ONE report at a time, in each report's own
stage — not all at once.
**Why:** GLOBAL-001 — existing report endpoints have inconsistent / unknown
de-facto access sets; applying the full matrix everywhere at once risks 403ing
roles that legitimately use a report today.
**How to apply:** when implementing a report, add `requireReportPermission` to
that report's view/create/edit/export/approve/finalize/delete routes and verify
against the roles that actually use it now.

## reports-routes catch-all ordering trap
`GET /reports/:type` in server/reports-routes.ts is a CATCH-ALL registered early.
It only `next()`s for types in its hardcoded `specificRoutes` allowlist;
otherwise it handles (and usually 400s) the request.
**How to apply:** to add a new specific `/reports/<x>` route, either register it
BEFORE the catch-all (preferred — Express order wins) OR add `"<x>"` to the
`specificRoutes` array. Otherwise the catch-all answers first.

## Honest "not built yet" pattern
For a report with no data source, gate the route and return
`sendApiError(res, { status:501, code:"NOT_IMPLEMENTED", ... })`. Do NOT return
`{details:[]}` (fake "no data") and do NOT let the frontend `catch`→mock. The
frontend should use `apiRequestJson` + `retry:false` so the error surfaces as a
real error/retry state.
