# Patch 3 — Stage 7: Accounts Office HR Reports (Raw Attendance, Edit Attendance, Salary Create, Salary Report)

## Summary
The four routes targeted by this stage —
`/reports/raw-attendance`, `/reports/edit-att`, `/reports/salary-create`,
`/reports/salary` — were **already real, database-backed workflows** before this
stage. They were delivered end-to-end in earlier patches (Stage 3 reports +
Salary/HR stages):

- **No mock/static data** — all four frontend pages use TanStack Query against
  live endpoints (`apiRequestJson`); the only `placeholder` strings are Radix
  `SelectValue` UI placeholders, not data.
- **No fake success** — every mutation reports success only after the API call
  resolves; the client invalidates queries on success.
- Attendance edits are **audited and approval-gated**; salary records are
  **never silently overwritten** (status state-machine + duplicate-finalized
  guards); unauthorized salary/attendance edits are **blocked server-side**.

Per the "do not create two engines / nothing more, nothing less" rule, this stage
**verified** the existing implementation rather than rebuilding it. During code
review **one genuine security gap was found and fixed** in the Edit Attendance
request path (see "Security gap found and fixed" below); no other source changes
were required.

## Files changed
- `server/attendance-edit-routes.ts` — closed an IDOR / salary-lock-bypass in the
  attendance edit request create/approve path (details below).
- `PATCH3_STAGE7_HR_SALARY_REPORTS_CHANGELOG.md` — this document.

## Security gap found and fixed (Edit Attendance)
**Before:** `POST /api/attendance/edits` (and the alias
`/api/attendance/edit-requests`) trusted client-supplied `userId`,
`attendanceId`, and `attendanceDate` with no scoping, and `approveEdit` ran the
salary-lock check against the request's claimed `user_id`/`attendance_date` while
`applyEditToAttendance` mutated the row located by `attendance_id` **without
verifying the row actually belonged to that employee/date**. A crafted pending
request could therefore display one (unlocked) employee while pointing
`attendanceId` at a different employee's row — and, once approved, mutate that
other (possibly salary-locked) employee's attendance, bypassing the lock.

**Fix (`server/attendance-edit-routes.ts`):**
1. `createEdit` — when an `attendanceId` is supplied, the target `user_id`/`date`
   are now **derived from the real attendance row**, never from the client; a
   non-existent `attendanceId` is rejected (400).
2. `createEdit` — **non-managerial callers may only request edits to their own
   attendance** (403 otherwise); managerial roles may request on behalf of
   employees.
3. `applyEditToAttendance` — defense-in-depth: when resolving a row by
   `attendance_id`, it now asserts (in SQL, `date::date` so it is timezone-safe)
   that the row's `user_id` **and** `date` match the request's `user_id` /
   `attendance_date` (409 otherwise). This covers crafted/legacy rows so a request
   can never apply onto a different employee **or** a different (possibly
   salary-locked) month than the lock check — `isMonthLocked(edit.user_id,
   edit.attendance_date)` — was evaluated against.

The non-`attendance_id` branch was already safe (it locates the row by
`user_id` + `attendance_date`, so the lock check and the mutated row are inherently
bound). The admin-only `PATCH /api/attendance/:id/correction` path was already safe
(it derives employee/date from the real row before the lock check) and is unchanged.

Note on managerial scope: managerial Edit-Attendance create/approve is **role-gated**
(`requireReportPermission("edit_attendance","approve")` + the managerial/own split
in create), not row-level department-scoped. Adding HOD/manager department scoping
to attendance edits is out of scope for this stage and listed as a limitation.

## Files verified already-complete (no change needed)
- Backend: `server/stage3-reports-routes.ts` (raw-attendance + export),
  `server/salary-routes.ts` (preview/runs/items/report/export),
  mounted in `server/routes.ts` via `registerStage3ReportsRoutes`,
  `registerAttendanceEditRoutes`, `registerSalaryRoutes` — all AFTER
  `authMiddleware` + `checkUrlPermission`. (`server/attendance-edit-routes.ts`
  was verified real/DB-backed but received the security fix described above.)
- Schema: `shared/schema.ts` — `drm.attendance` (line 720),
  `drm.attendance_edit_requests` (889), `drm.salary_runs` (814),
  `drm.salary_run_items` (846), `drm.employee_bonuses` (792).
- Frontend: `client/src/pages/reports-raw-attendance.tsx`,
  `reports-edit-att.tsx`, `salary-create.tsx`, `salary-report.tsx` — all on the
  live API with loading/empty/error states + pagination.

## APIs (all behind auth + URL-permission; verified, not added)
Raw Attendance:
- `GET /api/reports/raw-attendance` — paginated, filtered
  (`branch, department, userId, attendanceStatus, startDate, endDate, page, limit`);
  validates `startDate`/`endDate` required, `startDate <= endDate`, `limit ∈
  {10,25,50,100}`, `page >= 1`; rows carry `source: "attendance"`.
- `GET /api/reports/raw-attendance/export` — CSV honoring the same filters.
- `GET /api/attendance/raw` — honest empty set (no biometric source connected).

Edit Attendance (registered under BOTH `/api/attendance/edits` and the spec alias
`/api/attendance/edit-requests`):
- `GET .../edits` · `POST .../edits` · `PATCH .../edits/:id/approve` ·
  `PATCH .../edits/:id/reject`.
- `PATCH /api/attendance/:id/correction` — admin-only direct correction.

Salary:
- `GET /api/salary/preview` · `POST /api/salary/runs` · `GET /api/salary/runs` ·
  `GET /api/salary/runs/:id` · `PATCH /api/salary/runs/:id/status` ·
  `PATCH /api/salary/run-items/:id` (+ payment / bonuses / payment-summary).
- `GET /api/reports/salary` (+ `/export`) — item-level report with filters,
  totals footer, pagination, scope.

## DB changes
- **None.** All required tables already exist. `attendance_edit_requests` has the
  full field set (attendance_id, user_id, requested/reviewed_by, attendance_date,
  field, before/after_value, reason, status, salary_locked, override_reason,
  rejection_reason, timestamps). `salary_runs` / `salary_run_items` hold the full
  run + per-employee line schema.
- Statuses — salary run: `DRAFT → GENERATED → APPROVED → FINALIZED`, plus
  `CANCELLED` and a terminal `LOCKED`. Edit request: `Pending/Approved/Rejected`
  (existing system's capitalization, a real pg enum — left as-is, not renamed to
  the spec's uppercase to avoid a destructive enum migration).

## Formulas used (server/salary-routes.ts — match the spec)
- `perDaySalary  = basicSalary / 30`
- `grossSalary   = basicSalary + allowanceAmount + bonusAmount + overtimeAmount`
- `unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary`
- `absenceDeduction     = daysAbsent * perDaySalary`
- `totalDeductions = unpaidLeaveDeduction + absenceDeduction + lateDeduction +
   penaltyAmount + loanDeduction + otherDeductions`
- `netSalary     = grossSalary - totalDeductions`
- `payableSalary = max(0, netSalary)`
- Bonuses pulled from APPROVED `employee_bonuses`; penalties from APPROVED
  penalties; loans from active loan deductions.

## Assumptions
- "Plenty"/biometric raw logs: no biometric device/import exists, so the raw
  report is sourced from `drm.attendance` (`source: "attendance"`), per spec.
- "Edit Att" label = **Edit Attendance** (not "Edit Allotment"); no management
  confirmation of "Allotment" was provided.
- `team` filter: there is no `team` column on `drm.users`; `department` is the
  effective grouping, so a separate team filter is intentionally omitted (not
  faked).
- Late/overtime amount policy: where no rate policy exists, late/overtime are
  carried as informational minutes and amounts default to 0.

## Salary lock behavior
- A month is "locked" for an employee when they appear on a `salary_run_items`
  line whose run status ∈ {FINALIZED, APPROVED, LOCKED}.
- Approving an edit request or applying a direct correction against a locked
  month returns HTTP **423** with `salaryLocked/requiresOverride` unless an
  **admin** supplies an explicit `overrideReason` (stored + audited).
- Salary runs cannot leave FINALIZED/LOCKED; duplicate FINALIZED salary for the
  same employee+month+year is blocked at both create (409) and finalize (409),
  and surfaced in preview as `finalizedConflicts`.

## Permissions (enforced server-side via `can(req, action)` + report-permission)
- `admin/super_admin/super_hod` — all actions.
- `account_manager/accounts_office` — generate/view/export/approve/finalize per
  policy.
- `hr/hr_manager` — generate/view/export/approve per policy.
- `hod` — department-scoped view/approve.
- `manager` — team/department summary view where allowed.
- `executive` — own salary report only (self scope).
- Attendance correction (`PATCH /:id/correction`) — admin only.

## Tests run
- `npm run check` (tsc --noEmit) — 56 pre-existing baseline errors in unrelated
  files; **none** in any Stage 7 file.
- `npm test` (vitest) — 125 pass across 8 files (incl. `salary-routes.test.ts`).
- Boot smoke — all endpoints return **401** unauthenticated
  (`/api/reports/raw-attendance`, `/api/attendance/edits`,
  `/api/attendance/edit-requests`, `/api/salary/preview`, `/api/salary/runs`,
  `/api/reports/salary`).

## Known limitations
- No biometric raw-attendance source; raw report = `drm.attendance` rows. Metrics
  with no source column (`lateMinutes`, `earlyOutMinutes`, `overtimeMinutes`,
  `leaveType`, `penaltyAmount`) are returned as `null`, never fabricated.
- No `team` column on users; the `team` query param is not applied.
- No late/overtime rate policy table; those amounts default to 0 until a policy
  is added.
- Edit-request status enum keeps the existing `Pending/Approved/Rejected`
  capitalization (renaming would require a destructive pg enum migration, which
  is out of scope and forbidden by the stage rules).
