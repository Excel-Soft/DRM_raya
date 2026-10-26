# Main Reports — migration module doc

Assigned scope per the non-finance migration brief: "Main Reports," the legacy `permKey:
"Reports"` sidebar group in `app-sidebar.tsx` (20 items) — explicitly separate from the
already-migrated **User Reports** module (Loan/Vas/Gm/Bv personal-scope reports) even though
several items visually share a name.

**Status: 18 of 20 items now on Next** (14 newly-built pages + 1 alias to an already-migrated
page + 3 items that reuse the already-built User Reports dynamic route with `?scope=company`,
verified below). 3 items were already covered before this pass (Link Report via Posting Data, and
the pre-existing nav entries for Attendance/Salary/Projects Report, which this pass actually
built real pages for). 2 more items (Increment, Add Penalty) were showing as Legacy in this same
nav group but aren't actually part of this module's real "Reports" sidebar group at all — both are
now also built on Next; see note at the bottom of this doc.

## Route inventory

| Legacy path | Label | Status |
|---|---|---|
| `/reports/raw-attendance` | Raw Attendance | **Built** |
| `/reports/bv-pending-rc` | Bv Pending RC Only | **Built** (honest empty-state — see below) |
| `/reports/loan?scope=company` | Loan Report | **Built** (reuses User Reports' `/dashboard/reports/loan?scope=company`, verified) |
| `/reports/salary-create` | Salary Create | **Built** |
| `/reports/salary-bonuses` | Employee Bonuses | **Built** |
| `/reports/salary` | Salary Report | **Built** |
| `/reports/attendance` | Attendance Report | **Built** |
| `/reports/vas?scope=company` | Vas Report | **Built** (same as Loan Report, verified) |
| `/analytics/gm` | Gm Report | **Built** |
| `/reports/bv?scope=company` | Bv Report | **Built** (same as Loan Report, verified) |
| `/reports/bv-pending-ecnc` | Bv Pending EC/NC Only | **Built** |
| `/reports/diagnose` | Diagnose Report | **Built** |
| `/reports/follow-up` | Follow Up Report | **Built** |
| `/reports/projects` | Projects Report | **Aliased** to PMS's Project Report (see below) |
| `/reports/day-target` | Day Target Report | **Built** |
| `/posting-data/link-report` | Link Report | Already migrated (Posting Data module, pre-existing) |
| `/reports/department` | Department Report | **Built** |
| `/reports/event` | Event Report | **Built** |
| `/reports/reception` | Reception Report | **Built** |
| `/reports/edit-att` | Edit Att | **Built** |

## Projects Report — aliased, not re-ported

`frontend/src/pages/reports-projects.tsx` is a **literal one-line re-export** of
`pms-project-report.tsx` — legacy itself treats this as the exact same screen as PMS's Project
Report, not a separate implementation. The nav entry now points directly at
`PMS_PROJECT_REPORT` (`/dashboard/pms/project-report`, built in the PMS module pass) instead of
porting a second, inevitably-inconsistent copy of the same page.

## Bv Pending RC Only — honest empty state, not a real report

`frontend/src/pages/reports-bv-pending-rc.tsx` hardcodes `const REPORT_DATA: PendingBvRow[] = []`
with its own comment that this report has no backend data source yet. Ported faithfully: the
filter UI (user picker, search) is real and functional, but the table has nothing to show because
nothing upstream produces rows — this is a pre-existing gap in the legacy app, not something
introduced or concealed here.

## Loan / Vas / Bv Report (company scope) — resolved, now on Next

These three legacy sidebar entries point at `/reports/loan|vas|bv?scope=company` — the exact same
underlying pages as the already-migrated **User Reports** module's Loan/Vas/Bv Report, just with
a `scope=company` query param instead of the personal-scope default. The Next dynamic route
(`/dashboard/reports/[type]/page.tsx`) already threads a `scope` prop through to
`UserReportsView`, which has deliberate, extensive `scope === "company"` branching (person-picker
gating via `canSelectUser`, default-scope resolution, a company-wide person-totals row) — this was
not a guess, it's a fully-built feature on both sides: the frontend forwards `scope` as a query
param on every `/api/reports/:type` call, and `backend/src/server/routes/reports-routes.ts` has
matching `req.query.scope === "company"` branches for all three report types (loan: gated to
`COMPANY_WIDE_ROLES`; vas: routes to the `vas_reports`-backed `getVasReport()` instead of the
legacy office_vas path; bv: routes to `getBvReportCompanyWide()`), each with its own comment
explaining the split from the personal-scope path.

One blocker remained: `isNextMigratedPath()` in `migrated-routes.ts` did an exact-string Set
membership check, so a href carrying a query string (`/dashboard/reports/loan?scope=company`)
never matched the bare-path Set entry for `/dashboard/reports/loan` even though the page fully
supports the param. Fixed by stripping the query string before the lookup (falls back to an exact
match first, then the bare path) — a one-line, backward-compatible change with no new Set entries
needed. The 3 nav hrefs now point at `${USER_REPORT_LOAN|VAS|BV}?scope=company`.

Live-verified post-fix: minted an admin JWT and hit all three endpoints directly
(`GET /api/reports/{loan,vas,bv}?...&scope=company`) — all three returned real company-wide
metrics and chart data, not stubs or errors.

## Increment / Add Penalty — not part of this module

The user's latest screenshot also showed "Increment" and "Add Penalty" as Legacy inside this same
Next sidebar group, but neither is actually part of legacy's real `permKey: "Reports"` sidebar
group (confirmed against `frontend/src/components/app-sidebar.tsx` lines 254-276) — they're
separate DRM-module pages (`/drm/increment`, `/drm/add-penalty`) that ended up filed under this nav
group for convenience at some point. Both are now built on Next (`/dashboard/increment`,
`/dashboard/add-penalty`) — see `docs/modules/increment-penalty.md` for their migration notes.

## Per-page notes worth keeping

- **Raw Attendance / Reception / Salary Report** — CSV export reuses the shared
  `downloadAuthedFile` + `buildFileName` helpers (auth-aware, proper error surfacing) in place of
  each legacy page's own hand-rolled `fetch`+blob logic.
- **Department Report** — the commission/"Total" row logic (per-status display rules,
  `verify-commission` action) was ported exactly, including the comment-documented legacy quirk
  that "Project Create" status shows a simple amount total while the four completion statuses
  show a manager/assistant commission split instead.
- **Reception Report** — dual view mode (per-meeting list vs. team summary) and the "Month Wise +
  specific user" combination's blocked state (no payments-received ledger exists to compute a
  tiered commission honestly) were both preserved as real UI states, not silently dropped.
- **Edit Attendance** — approve/reject/create workflow ported with its salary-lock (`423`)
  override-reason prompt flow intact; role is resolved via `/api/auth/me` + the existing
  `isManagerialRole`/`normalizeRole` helpers in `src/lib/auth/role-utils.ts` rather than reading
  `sessionStorage` directly (no direct equivalent exposed client-side in this app).
- **Salary Create / Bonuses / Report** — full payroll lifecycle (DRAFT → GENERATED → APPROVED →
  FINALIZED/CANCELLED), manual per-employee adjustments with live recompute, bulk per-run
  mark-paid/unpaid, and the finalize/cancel confirmation dialogs were all ported faithfully. Role
  gating (`canGenerate`/`canApprove`/`canFinalize`/`canEdit`/`canCancel`/`canMarkPaid`) is
  UI-only, matching legacy's own comment that the server is the real authority.
- All "Select User" role-grouped pickers (Follow Up, Day Target, Diagnose, Bv Pending EC/NC, Bv
  Pending RC, Gm Report) reuse the identical `/api/users?assigned=true` (or `/api/users`)
  grouped-by-role pattern already established across these legacy pages — kept as separate
  per-page queries rather than factored into a shared hook, matching the legacy convention of
  each page owning its own copy.

## Files touched this pass

- `src/lib/navigation/reports-routes.ts` (new — 15 route constants, sidebar-paths array,
  legacy-redirect array)
- `src/lib/navigation/reports-routes.test.ts` (new)
- `src/lib/navigation/migrated-routes.ts` / `legacy-redirects.ts` (added Reports import + spread;
  `isNextMigratedPath()` now strips the query string before the Set lookup, so
  `?scope=company` hrefs match their bare-path entry)
- `src/lib/navigation/navigation-config.ts` (Reports group — 18 of 20 hrefs now import canonical
  constants or aliases; `rep-loan`/`rep-vas`/`rep-bv` point at
  `${USER_REPORT_LOAN|VAS|BV}?scope=company`)
- `src/modules/reports/reports-ui.tsx` (new — `ReportsShell`, re-exports `DrmSection` et al.)
- `src/modules/reports/{raw-attendance,follow-up,day-target,diagnose,bv-pending-ecnc,event,
  attendance,gm-report,department,reception,bv-pending-rc,edit-attendance,salary-create,
  salary-bonuses,salary-report}-view.tsx` (new, 15 files)
- `src/app/(app)/dashboard/reports/{raw-attendance,follow-up,day-target,diagnose,
  bv-pending-ecnc,event,attendance,department,reception,bv-pending-rc,edit-att,salary-create,
  salary-bonuses,salary}/page.tsx` + `src/app/(app)/dashboard/analytics/gm/page.tsx` (new, 15
  route files)
- `package.json` (`test:navigation` script now includes `reports-routes.test.ts`)
- `docs/modules/reports.md` (this file)

## Verification

`npm run typecheck` clean, full `npm test` passing (51 assertions across 5 test scripts, 0
failures), production build compiles all 15 new routes as static pages with zero errors. Every
page's primary backing API live-tested with a JWT minted against a real admin user — response
shapes confirmed against real data (raw-attendance, department/filters, salary/preview,
salary/bonuses, attendance/edits, reception, reports/salary, follow-up, day-target all returned
real rows/shapes matching the ported types exactly; loan/vas/bv `?scope=company` re-verified after
the `isNextMigratedPath` fix, same method). Legacy → Next redirects spot-checked after a required
dev-server restart (Next only reloads `next.config.ts` redirects on restart). Browser click-through
still blocked — no Playwright/chromium tool in this environment.
