# Patch 2 — Permission QA Matrix (Stage 9)

**Purpose.** Per-route, per-action authorization for every Patch 2 report/admin
surface, expressed in the *normalized* role vocabulary actually used by the
backend guards. This is a QA artifact: it records the **expected** behavior
(derived from the live guard code) and the **tested** result (how that
expectation was verified this stage).

## How authorization is enforced

There are **three independent authorization systems**; this matrix documents all
of them and flags where they differ:

1. **Report middleware** — `server/middleware/report-permission.ts`
   (`requireReportPermission(reportKey, action)`). Governs: raw-attendance,
   event, reception, edit-att, day-target, and the bv-reports CRUD/approve
   endpoints. Fails closed (401 unauthenticated / 403 unauthorized) and returns
   the sanitized error envelope. Unit-tested by `server/report-permission.test.ts`.
2. **Salary class system** — `server/salary-routes.ts` (`CLASS_ACTIONS` /
   `salaryClassForRole` / `classCan`). Salary endpoints **do not** use the report
   middleware: each role maps to a *class* (`full` / `accounts` / `hr` / `hod` /
   `manager` / `executive`) and is checked against that class's per-action
   capability set, then row-scoped by `resolveScope` (all / department / self).
   Unit-tested by `server/salary-routes.test.ts`. The `salary_create` /
   `salary_report` entries that also exist in `report-permission.ts` are **not**
   the guard actually applied to salary routes (divergence — see B-07 in the
   final report).
3. **Route-level helpers** — `server/penalty-routes.ts` and
   `server/diagnosis-report-routes.ts` authorize with their own role helpers
   rather than the middleware (see notes ⑤ and ⑥). Tested by
   `server/penalty-routes.test.ts` and exercised via `stage10-smoke.test.ts`.

**Row-level scope** ("own data only" for ordinary executives, department scope
for managers/HODs) is enforced *inside the handlers*, not by the guard. A ✅ in
this matrix means "the action is permitted at all"; the visible rows may still be
filtered to the caller's own/department records.

## Role normalization (so the columns are unambiguous)

`normalizeRole()` is applied on both sides before comparison:

- `super_admin` / `administrator` → **`admin`**
- `accounts_office` / `account` → **`account_manager`** (the **Accounts Office** column)
- `dnd_manager` → **`dd_manager`** (the **D&D Manager** column)
- `super_hod` stays distinct
- **`admin`** and **`super_hod`** are allowed **every** action on **every** report
  (the `ALWAYS_ALLOWED` set). They are ✅ in every row below.

Column meanings: **HR** = `hr` and `hr_manager` (footnote ① where only
`hr_manager` qualifies). **Reception** = `reception_manager` / `reception` /
`reception_executive` (footnote ② where manager-only). **Executive** =
`sales_executive` / ordinary executives (own-row scope).

Legend: ✅ allowed · ❌ denied (403) · ✅* allowed but row-scoped to own/department.

## Matrix

| Route | Action | Admin | Super Admin | Super HOD | HOD | Accounts Office | HR | Reception | D&D Manager | Service Manager | Executive | Expected result | Tested result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| /reports/raw-attendance | view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Only attendance/payroll owners read source attendance | ✅ matrix unit-tested |
| /reports/raw-attendance | export (CSV) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | HOD may view but not export; CSV mirrors list filters+scope | ✅ matrix unit-tested |
| /reports/salary-create | view (runs list) | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | Every class may view; row-scoped (self/dept) ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | preview | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr` classes ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | generate (create run) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr` (HR **can** generate) ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | edit | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr` ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | approve | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr`/`hod` ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | finalize (status) ④ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts` ONLY (HR ❌); dialog + optional reason ④⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | cancel (status) ④ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr` (HR **can** cancel); dialog + optional reason ④⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | export (CSV) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr`; HOD ❌ ⑩ | ✅ salary-routes.test.ts |
| /reports/salary-create | mark_paid | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts` ONLY ⑩ | ✅ salary-routes.test.ts |
| /reports/salary | view | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ | ✅* | ✅* | ✅* | ✅* | Every class may view; row-scoped ⑩ | ✅ salary-routes.test.ts |
| /reports/salary | export (CSV) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `full`/`accounts`/`hr`; HOD view-only ⑩ | ✅ salary-routes.test.ts |
| /reports/event | view | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅② | ❌ | ❌ | ❌ | Accounts/HOD + Reception **manager** | ✅ stage8-event-reception.test.ts |
| /reports/event | export (client CSV) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Export gated to view set (no server export endpoint ③) | ✅ stage8-event-reception.test.ts |
| /reports/reception | view | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅* | ❌ | ❌ | ❌ | Reception mgr/exec (exec own-scope) + Accounts/HOD | ✅ stage8-event-reception.test.ts |
| /reports/reception | export (CSV) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅② | ❌ | ❌ | ❌ | Reception **manager** + Accounts only; exec ❌ | ✅ stage8-event-reception.test.ts |
| /reports/edit-att | view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Attendance-correction reviewers | ✅ matrix unit-tested |
| /reports/edit-att | approve | ✅ | ✅ | ✅ | ✅ | ✅ | ✅① | ❌ | ❌ | ❌ | ❌ | `hr_manager` yes, plain `hr` no ① | ✅ matrix unit-tested |
| /reports/edit-att | finalize | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Only Accounts + HOD lock a correction | ✅ matrix unit-tested |
| /reports/day-target | view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅② | ✅ | ✅ | ❌ | Broad management view (+ `sales_manager`) ⑦ | ✅ matrix unit-tested |
| /reports/day-target | export (CSV) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Accounts/HOD export only | ✅ matrix unit-tested |
| /reports/diagnose | view | ✅ | ✅ | ✅ | ✅* | ✅ | ✅* | ✅* | ✅* | ✅* | ✅* | Any authenticated role views **own** rows ⑤; HOD/managers=team; Accounts=all | ✅ code-verified; manual |
| /reports/diagnose | export (CSV) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | admin/super_hod/Accounts/HOD only ⑤ | ✅ code-verified; manual |
| /reports/bv | view | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅* | Sales chain + DnD (+ sales asst mgr/mgr) ⑦ | ✅ performance-routes.team.test.ts |
| /reports/bv/new | create | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | Sales executives/asst-mgr/mgr + Accounts; HOD ❌ | ✅ performance-routes.team.test.ts |
| /reports/bv | edit | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅* | Same set as create | ✅ performance-routes.team.test.ts |
| /reports/bv | export (CSV) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Accounts/HOD (+ sales_manager) ⑦ | ✅ performance-routes.team.test.ts |
| /reports/bv | approve/reject ⑧ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Approval UI lives outside Patch 2 routes ⑧ | ✅ matrix unit-tested |
| add-penalty (service / drm) | create | ✅ | ✅ | ✅ | ✅ | ✅⑥ | ❌ | ❌ | ✅ | ✅ | ❌ | Route helper `canCreate` = full-access/HOD/managerial ⑥ | ✅ penalty-routes.test.ts |
| add-penalty (reports/list) | view | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ | ❌ | ✅* | ✅* | ❌ | Monthly report = full-access/HOD/HR; managers see dept ⑥ | ✅ penalty-routes.test.ts |
| penalty (backend only) | approve/reject ⑨ | ✅ | ✅ | ✅ | ✅ | ❌⑥ | ❌ | ❌ | ❌ | ❌ | ❌ | `canDecide` = full-access + HOD **only** ⑥⑨ | ✅ penalty-routes.test.ts |
| penalty (backend only) | void (reason req.) ⑨ | ✅ | ✅ | ✅ | ✅ | ❌⑥ | ❌ | ❌ | ❌ | ❌ | ❌ | Same authority as approve; `reason` required, audited ⑨ | ✅ penalty-routes.test.ts |
| penalty (backend only) | delete (soft) ⑨ | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ | ❌ | ✅* | ✅* | ❌ | Creator-own & **pending only**; voided ❌ ⑨ | ✅ penalty-routes.test.ts |

## Footnotes

- **①** `edit_attendance.approve` permits `hr_manager` but **not** plain `hr`.
  The HR column is ✅ for `hr_manager` only on that row.
- **②** Reception **manager** only (`reception_manager`). `reception` /
  `reception_executive` may *view* the reception report (own-scoped) but cannot
  export it, and are not on the event report at all.
- **③** The events report export is a **client-side CSV** built from the loaded
  rows (there is no `/export` server endpoint for events). It therefore mirrors
  exactly what the user can already see (same filters + row scope). All other
  exports are server endpoints that re-apply the list filters + role scope.
- **④** Salary **finalize** and **cancel** are terminal status transitions on
  `PATCH /api/salary/runs/:id/status`. Per the salary class system (⑩) **finalize**
  is `full`/`accounts` only (HR **cannot** finalize), while **cancel** is
  `full`/`accounts`/`hr`. The UI now wraps both in a confirmation dialog with an
  **optional reason** that the backend records on the status change (audit).
  Generate/Approve remain direct (reversible).
- **⑤** `/reports/diagnose` is authorized by **route-level role logic** in
  `server/diagnosis-report-routes.ts` (`accessLevel()`), not the report
  middleware. View access: `admin` / `super_hod` / `account_manager` → **all**
  rows; `hod` + any managerial role (incl. `hr_manager`, `reception_manager`,
  `dd_manager`, `service_manager`, `sales_manager`) → **team/department**; **every
  other authenticated role** (incl. plain `hr`, `reception_executive`,
  `sales_executive`) → their **own** rows. So no authenticated role is denied
  *view* — they differ only by scope. Export (`canExport()`) is restricted to
  `admin` / `super_hod` / `account_manager` / `hod`.
- **⑥** Penalty endpoints are authorized by **`server/penalty-routes.ts`** helpers,
  not the report middleware. `canCreate` = full-access (`admin`/`super_hod`) OR
  `hod` OR any managerial role (anything normalizing with a manager/admin/hod/
  head/supervisor term — this includes `account_manager`, `dd_manager`,
  `service_manager`). `canDecide`/`canVoid` = full-access OR `hod` **only**
  (so `account_manager` can create but **cannot** approve/reject/void).
  `canViewReports` (monthly report) = full-access OR `hod` OR `hr`. **This diverges
  from the `penalty_report` entry in `report-permission.ts`** (see business
  confirmation B-04 in the final report).
- **⑦** Extra allowed roles with no dedicated column: `day_target.view` also
  allows `sales_manager`; `bv_report.view` also allows `sales_assistant_manager`
  and `sales_manager`; `bv_report.export` also allows `sales_manager`.
- **⑧** BV approve/reject endpoints (`POST /api/bv-reports/:id/approve|reject`)
  are guarded by `requireReportPermission("bv_report","approve")`
  (admin/super_hod/account_manager/hod). The Patch 2 BV pages in scope
  (`/reports/bv`, `/reports/bv/new`) are list/create/edit; the approval UI is on
  other (non-Patch-2) screens, so no approval control was added here.
- **⑨** Penalty approve/reject/void/delete have **no UI surface on the Patch 2
  add-penalty pages** (those pages are create + list only). The rows above
  document the backend authority for completeness. Because there is no
  destructive penalty control in the Patch 2 UI, no client confirmation dialog
  was added there; the destructive backend `void` already requires a `reason`.
- **⑩** Salary rows reflect the **salary class system** in `server/salary-routes.ts`
  (not the report middleware). `salaryClassForRole` maps: `admin`/`super_hod` →
  `full`; `account_manager` → `accounts`; `hr`/`hr_manager` → `hr`; `hod` → `hod`;
  any other managerial role → `manager`; everything else → `executive`. Per-action
  capability (`CLASS_ACTIONS`): **full**/**accounts** = all actions;
  **hr** = preview, generate, view, export, approve, edit, cancel (**no** finalize,
  **no** mark_paid); **hod** = view + approve; **manager**/**executive** = view only.
  Row scope (`resolveScope`): full/accounts/hr = all; hod/manager = department;
  executive = self. A ✅* on a salary view row therefore means "allowed, but only
  the caller's own/department rows".

## Verification basis

- **Middleware matrix tests** — `server/report-permission.test.ts` exercises
  `resolveReportRoles()` for representative report key/action cases (the
  `admin`/`super_hod` always-allowed invariant plus per-report allow/deny
  samples), not an exhaustive cross-product of every key × action.
- **Salary class tests** — `server/salary-routes.test.ts` directly asserts
  `salaryClassForRole()` and `classCan()` for every class/action (e.g. HR may
  generate/edit/export/cancel but not finalize; manager/executive view-only).
- **Endpoint tests** — `penalty-routes.test.ts`,
  `stage8-event-reception.test.ts`, `performance-routes.team.test.ts`, and
  `stage10-smoke.test.ts` exercise the live handlers (role gating + row scope).
- **Manual** — rows marked "manual" (diagnose) were confirmed by reading the
  guard code; full interactive run-through is auth-gated (JWT) and is listed in
  the QA checklist as a manual sign-off item.
- Full suite this stage: **125 passing across 8 files**; `tsc --noEmit` clean
  (56 pre-existing baseline errors, 0 new); production `npm run build` succeeds.
