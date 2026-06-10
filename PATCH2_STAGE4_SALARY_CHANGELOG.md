# Patch 2 — Stage 4: Real Salary Creation & Reporting

Scope: convert `/reports/salary-create` and `/reports/salary` from a thin
basic-salary-minus-absence preview into a full DB-backed payroll workflow —
preview → draft → generate → approve → finalize (lock), with editable manual
adjustments, audit logging, per-action role permissions, and a filterable,
paginated, exportable report. No mocks, no fake-success, no silent overwrite,
and **no duplicate FINALIZED salary** for the same employee/month/year. All
formulas are computed from real source data and documented; where the system has
no source (overtime rate, late policy, loan schedule) the value is `0` and the
assumption is recorded in each line's `calculation_snapshot`.

Existing column names (`period_month`/`period_year`, `run_id`, `user_id`) and
the existing endpoints were preserved; spec field names are mapped in the API
layer only (no renames). `db:push` is broken repo-wide (pre-existing FK type
mismatch), so schema is applied via idempotent `ALTER ... ADD COLUMN IF NOT
EXISTS` at boot and mirrored in `shared/schema.ts`.

## Files changed

- `server/db/ensure.ts` — new idempotent `ensureSalarySchema()` (wired into
  `ensureDbOnce`) that adds the lifecycle/actor columns to `salary_runs` and the
  full per-employee breakdown columns to `salary_run_items`, plus a unique index
  `(run_id, user_id)` and a `payment_status` index.
- `shared/schema.ts` — mirrored the new columns and the unique index on the
  Drizzle table definitions (added the `uniqueIndex` import).
- `server/salary-routes.ts` — fully rewritten: a documented computation engine
  (`computeItems`), live preview, run persistence (DRAFT/GENERATED), run listing
  & detail, a guarded status-transition endpoint (advisory-lock finalize guard),
  per-line manual-adjustment editing, and the report + CSV export endpoints.
- `client/src/pages/salary-create.tsx` — rebuilt: period/branch/department
  filters, live preview, Save-as-Draft / Save-&-Generate, re-attach to a saved
  draft on refresh, editable bonus/allowance per line with inline numeric
  validation + server recompute, role-gated lifecycle buttons
  (Generate/Approve/Finalize/Back/Cancel), duplicate-finalized conflict banner,
  missing-basic-salary warning, and honest loading/empty/error states.
- `client/src/pages/salary-report.tsx` — rebuilt: month/year/department/branch/
  run-status/payment-status filters, totals footer, server pagination, name
  search over the current page, and a filtered CSV export download.

## Computation engine (per employee, per period)

```
basic              = parsed users.basic_salary (TEXT; commas/symbols stripped, blank/NaN -> 0)
perDay             = basic / 30
gross              = basic + allowance + bonus + overtimeAmount
absenceDeduction   = absentDaysNotCoveredByApprovedLeave * perDay
unpaidLeaveDeduct  = approvedUnpaidLeaveDays(clamped to period) * perDay
lateDeduction      = 0   (no late policy configured; lateMinutes informational)
overtimeAmount     = 0   (no overtime rate configured; overtimeMinutes informational)
penaltyAmount      = SUM(penalties WHERE status='ACTIVE' AND deleted_at IS NULL, dated in period)
loanDeduction      = manual (no loan table; default 0)
otherDeductions    = manual (default 0)
totalDeductions    = absence + unpaidLeave + late + penalty + loan + other
net                = gross - totalDeductions
payable            = max(0, net)
```

- **No double-deduction:** an `Absent` attendance day that falls inside an
  approved leave is *not* counted in `absenceDeduction` (`NOT EXISTS` against
  `leave_requests`), so an unpaid-leave day is deducted once, via the
  unpaid-leave term only.
- Leave/absence are inclusive calendar days within the period (no working
  calendar exists in the system); leave ranges are clamped to the period bounds.
- Penalty filter is `status='ACTIVE'` (the Stage 2 void lifecycle), **not**
  `'Approved'`.
- Enum columns (`attendance.status`, `leave_requests.status`/`leave_type`,
  `overtime_records.status`) are compared as `::text` so an unexpected value
  yields an empty bucket instead of a raw `22P02` error.

## APIs added / changed (`server/salary-routes.ts`)

- `GET  /api/salary/preview` — management only. Live, non-persisted computed
  lines for `month`/`year` (+ optional `branch`/`department`/`userId`). Returns
  `{ period, items[], totals, employeeCount, missingData[] }`. `missingData`
  surfaces employees with no `basic_salary` so they are not silently paid 0.
- `POST /api/salary/runs` — management only. Persists a run as `DRAFT` (default)
  or `GENERATED`. Validates the period and any `manualAdjustments` numerics,
  blocks a duplicate run for the same month/year/branch/department (**409** with
  `existingRunId`), computes + inserts all line items in one transaction, and
  audits `salary.run.created`. Returns `{ run, items[] }`.
- `GET  /api/salary/runs` — management only. Lists runs with optional
  `month`/`year`/`status`/`branch`/`department` filters.
- `GET  /api/salary/runs/:id` — management only. Run + its line items.
- `PATCH /api/salary/runs/:id/status` — management only. Enforces an explicit
  transition matrix (`DRAFT→GENERATED/CANCELLED`, `GENERATED→APPROVED/DRAFT/
  CANCELLED`, `APPROVED→FINALIZED/GENERATED/CANCELLED`; `FINALIZED` and legacy
  `LOCKED` are terminal). Invalid transition → **409** with `allowedTransitions`.
  Finalize takes a per-period advisory lock and, inside the txn, blocks if any
  employee in the run already has a `FINALIZED` salary for that month/year in
  another run (**409** with `conflicts[]`). Audits `salary.run.status_changed`.
- `PATCH /api/salary/run-items/:id` — management only. Edits `bonusAmount`,
  `allowanceAmount`, `loanDeduction`, `otherDeductions` **only while the run is
  DRAFT or GENERATED** (else **409**), validates finite numbers, recomputes the
  line and the parent run aggregates, and audits `salary.item.edited` (before/
  after). Editing a FINALIZED run's line is rejected.
- `GET  /api/reports/salary` — registered before the reports catch-all so the
  exact path wins. Management sees all; everyone else is hard-scoped to their own
  `user_id` (the client `employeeId`/`userId` filter is ignored for them).
  Filters: `userId`/`employeeId`, `department`, `branch`, `month`, `year`,
  `status`, `paymentStatus`, `generatedBy`. Paginated (`page`, `limit≤200`).
  Returns `{ filters, rows[], summary, pagination }`.
- `GET  /api/reports/salary/export` — same filters and the same self-scoping;
  streams a CSV (cap 5000 rows).

## DB changes (idempotent, applied at boot; mirrored in `shared/schema.ts`)

`drm.salary_runs`: `generated_by_user_id uuid`, `generated_at timestamp`,
`finalized_by_user_id uuid`, `finalized_at timestamp`, `remarks text`,
`deleted_at timestamp`.

`drm.salary_run_items`: `basic_salary`, `leave_days`, `unpaid_leave_days`,
`late_minutes`, `overtime_minutes`, `penalty_amount`, `loan_deduction`,
`bonus_amount`, `allowance_amount`, `total_deductions`, `payable_salary`
(all numeric/integer `NOT NULL DEFAULT 0`), `payment_status text NOT NULL
DEFAULT 'UNPAID'`, `calculation_snapshot jsonb`.

Indexes: `uq_salary_run_items_run_user UNIQUE (run_id, user_id)` (one line per
employee per run) and `idx_salary_run_items_payment (payment_status)`. The
"one FINALIZED per employee/month/year" rule is enforced transactionally in the
service layer (advisory lock + existence check), not by a DB constraint, because
it spans multiple runs. No data migration, no drops, no destructive statements.

## Permissions

A narrow management allow-list (`admin`, `super_admin`, `administrator`,
`super_hod`, `hod`, `account_manager`, `accountant`, `hr`, `hr_manager`, plus any
managerial role) may preview, create, list, view, transition, edit, and export
runs — these surfaces expose every employee. Non-management users get **no**
access to preview/runs/create/edit; they may only read the report, hard-scoped to
their own salary lines (and the export honors the same scope). The frontend
mirrors this allow-list to gate UI affordances, but the server is the source of
truth (it returns 403 regardless of the UI).

## Key correctness fix found during verification

The `salary_runs` insert reused the actor id parameter (`$12`) both directly in
`created_by_user_id` (a `uuid` column) and inside a `CASE` for
`generated_by_user_id`. Postgres deduced the `CASE`-context param as `text`
while the direct column forced `uuid`, raising `42P08 inconsistent types deduced
for parameter $12 (text versus uuid)` and 500-ing every create. Fixed by casting
the parameter explicitly (`$12::uuid`) in both positions.

## Security fix found during code review

The salary routes derived authorization from a list of role "candidates" that
**included the client-supplied `x-acting-role` HTTP header**. Because the check
grants management access if *any* candidate matches, and the frontend sends
`x-acting-role` from `sessionStorage` on every request, any authenticated
low-privilege user could forge `x-acting-role: hr` (or `admin`) and gain full
payroll management — view every employee's salary, create/edit/approve/finalize
runs, and bypass the self-scoping on the report/export. The real JWT auth
middleware never trusts this header; only the salary routes did. Fixed:
`actorRoleCandidates()` now derives roles **solely** from the signed JWT
(`req.user.roleId` / `role` / `roles`); the header is a UI hint only and is never
an authority. Verified live: a non-management token with a forged
`x-acting-role` header gets 403 on preview/runs and self-only rows on the report,
while a genuine admin token retains full access.

Additionally hardened the report/export filters: `i.user_id` and
`r.generated_by_user_id` are `uuid` columns, so a non-uuid filter value (or the
old `'__none__'` self-scope fallback) raised `22P02` (a 500). Invalid-uuid
filter values now resolve to an honest empty result instead of an error.

## How to test

1. Start the app (`npm run dev`, port 5000) and log in as a management user.
   (QA fixtures for May 2026 are seeded by `scripts/seed-salary-qa.ts`:
   employees QA Alice/Bob/Carol with numeric basic salaries plus Absent
   attendance, an Unpaid leave, approved overtime, and an ACTIVE penalty.)
2. **Preview:** open `/reports/salary-create`, pick May / 2026. Confirm the
   computed lines (e.g. Alice: basic 30000, absence 3000, unpaid-leave 2000,
   penalty 500, payable 24500) and the totals footer. A non-management user gets
   an access-denied panel; the preview/runs endpoints return 403 for them.
3. **Draft + edit:** click **Save as Draft** — the run persists and the page
   re-attaches to it (refresh the page and it stays on the saved draft). Edit a
   line's Bonus/Allowance and click **Save**: the payable recomputes server-side
   (Alice + bonus 1000 + allowance 500 → 26000). Non-numeric/negative input is
   rejected inline.
4. **Lifecycle:** **Generate → Approve → Finalize**. Each transition is gated
   and the status badge updates. After Finalize the lines are read-only and
   further transitions/edits return 409 (the UI shows the locked state).
5. **Duplicate-finalize guard:** create a second run for the same period whose
   employees overlap a finalized run and try to finalize it — it is blocked with
   a conflict banner listing the affected employees.
6. **Report:** open `/reports/salary`. Filter by month/year/department/branch/
   run-status/payment-status; confirm rows, the totals footer, pagination, and
   that **Export CSV** downloads a file honoring the active filters. A
   non-management user sees only their own records (with a notice) and the export
   is scoped the same way.

## Unresolved / notes (intentional, to avoid scope creep)

- **No mark-paid mutation.** `payment_status` exists (default `UNPAID`) and is a
  filter/column now; flipping it to `PAID` is deferred to a later stage.
- **No overtime rate / late policy / loan table** exist, so `overtimeAmount`,
  `lateDeduction` and the source-less `loanDeduction` are `0` (loan is manual);
  this is recorded in each line's `calculation_snapshot.assumptions`.
- **perDay = basic / 30** (fixed divisor) because no working-calendar config
  exists; documented in the snapshot.
- **Daily Target Report (Stage 5) is deferred** per the plan.
- `db:push` remains broken repo-wide (pre-existing FK type mismatch); schema is
  maintained via the idempotent ensure path.
- `tsc --noEmit` stays at the pre-existing baseline of 57 errors (no new errors);
  `npm test` is green (60/60). The backend workflow was verified end-to-end with
  a temporary live smoke harness (29/29 assertions) covering auth/permissions,
  the computed formulas, the full lifecycle, the locking guards, and the report/
  export; the harness was removed after passing (the QA seed script is kept).
```
