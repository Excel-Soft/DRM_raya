# Real Salary Creation & Reporting

## What & Why
Patch 2 Stage 4. Turn the Salary Create (`/reports/salary-create`) and Salary
Report (`/reports/salary`) screens into a complete, database-backed payroll
workflow: preview real salary from live HR data, save runs as drafts, generate
them, approve/finalize with locking, edit allowed line items, and report on the
results with filters, totals, pagination, and export.

The salary tables and a basic backend already exist (from Stage 3) and the pages
are already wired to real endpoints — this is a **gap-fill to spec, not a
rebuild**. The current model only computes `gross = basic_salary` and
`net = gross − absence deduction`; the spec wants a fuller, transparent payroll
calculation plus a real approval lifecycle, permissions, audit, and reporting.

**Critical reconciliation (decided during planning):** the live tables use the
column names `salary_runs.period_month/period_year` and
`salary_run_items.run_id/user_id` with a smaller column set than the spec's
proposed names (`month/year`, `salary_run_id/employee_id`). To avoid breaking the
existing pages/endpoints, **keep the existing column names and EXTEND the tables
with the additional columns** (no renames). Map spec field names to the real
columns in the API/JSON layer. `npm run db:push` is broken repo-wide, so all
schema changes must be idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
(and index `IF NOT EXISTS`) applied at boot via `server/db/ensure.ts`, mirrored
in `shared/schema.ts`.

## Done looks like
- On Salary Create: pick month/year (+ optional branch/department/employee),
  click Preview, and see real per-employee lines computed from live attendance,
  leave, overtime, penalties, plus editable bonus/allowance/manual-adjustment
  fields with inline numeric validation and live recalculation.
- Save Draft persists the run and survives a browser refresh; Generate creates a
  GENERATED run; Approve/Finalize move it through the lifecycle and Finalized
  runs are locked from further edits.
- The system refuses to create a duplicate **Finalized** salary for the same
  employee + month + year, and never shows a success toast unless the API call
  actually succeeded.
- Unauthorized users cannot preview, generate, approve, finalize, or export
  salary; an executive can only see their own salary.
- On Salary Report: filter by employee/department/branch/month/year/salary
  status/payment status/generated-by, see salary components + deductions + net,
  approval/final status and payment status, a totals footer, pagination, and an
  export that matches the active filters.
- Every state-changing action (create/generate/approve/finalize/cancel/item
  edit) writes an audit record.
- A `PATCH2_STAGE4_SALARY_CHANGELOG.md` documents files, APIs, DB changes,
  formulas, assumptions, permissions, export behavior, tests, and limitations.
- `tsc` stays at the pre-existing baseline (no new errors) and `npm test` passes.

## Formulas & documented assumptions (transparent, no fabricated numbers)
- `perDaySalary = basicSalary / 30` (keep existing convention; `basic_salary` is
  a TEXT column — parse to number, treat blank/non-numeric as 0).
- `grossSalary = basicSalary + allowanceAmount + bonusAmount + overtimeAmount`.
- `unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary`, where
  `unpaidLeaveDays` = approved `leave_requests` with `leave_type = 'Unpaid'`
  overlapping the period (other approved leave types count as informational
  `leaveDays` with no deduction).
- `absenceDeduction = absentDays * perDaySalary` (attendance `status='Absent'`).
- `lateDeduction = 0` — no late-penalty policy exists in the system;
  `lateMinutes` is shown as informational only (documented assumption).
- `overtimeMinutes = sum(time_spent)` of approved `overtime_records` in the
  period; `overtimeAmount = 0` because there is no overtime-rate policy
  (informational; documented assumption — adjustable manually).
- `penaltyAmount = sum(amount)` of approved `penalties` for the employee in the
  period (`penalty_date` within range).
- `loanDeduction = 0` — there are no loan tables in this DB (documented; manual
  field, default 0).
- `bonusAmount` / `allowanceAmount` default 0 (no source table) — manual inputs.
- `totalDeductions = unpaidLeaveDeduction + absenceDeduction + lateDeduction +
  penaltyAmount + loanDeduction + otherDeductions`.
- `netSalary = grossSalary − totalDeductions`;
  `payableSalary = max(0, netSalary)`.
- Persist a `calculation_snapshot` (jsonb) per item capturing the inputs and
  formula outputs so a saved line is auditable even if source data later changes.

## Status lifecycle
`DRAFT → GENERATED → APPROVED → FINALIZED`, plus `CANCELLED`. Keep the existing
`LOCKED` value working as a synonym for fully-locked (treat FINALIZED and LOCKED
as locked). Only DRAFT/GENERATED runs and their items are editable; APPROVED is
read-only except an admin correction path; FINALIZED is locked.

## Permissions (role-based, action-aware)
- admin / super_admin / administrator / super_hod: all actions.
- account_manager / accountant / accounts_office: generate, view, export, and
  approve/finalize.
- hr / hr_manager: generate, view, export, approve.
- hod: view + approve their department's salary.
- manager: view their team's salary summary only.
- executive: own salary report only — no generate/approve/export.
Enforce on the server (the current flat allow-list must become per-action
checks); reuse `normalizeRole` / `isManagerialRole` from `server/utils/role-utils.ts`.

## Out of scope
- Building loan, allowance, or bonus source tables (don't exist; manual/0 with
  documented assumptions).
- Configurable salary formula/rate engine (per-day = basic/30 stays fixed).
- Renaming existing salary columns or changing existing business structure.
- Advance-salary / create-all-salary / salary-only screens (separate items).
- Payslip emailing/PDF (print/CSV export only here).

## Steps
1. **Lock scope with the architect** (`responsibility: plan`) before coding:
   confirm the extend-don't-rename table strategy, the status lifecycle,
   the duplicate-FINALIZED guard approach, and the permission matrix.
2. **Extend the schema idempotently** in `server/db/ensure.ts` and mirror in
   `shared/schema.ts`: add the missing spec columns to `salary_runs`
   (generated_by/finalized_by user refs, finalized_at, remarks, deleted_at) and
   `salary_run_items` (basic_salary, leave_days, unpaid_leave_days, late_minutes,
   overtime_minutes, penalty_amount, loan_deduction, bonus_amount,
   allowance_amount, total_deductions, payable_salary, payment_status default
   'UNPAID', calculation_snapshot jsonb). Add a unique index on
   `(run_id, user_id)` and the indexes needed for reporting — all `IF NOT EXISTS`.
3. **Rebuild the preview computation** to source attendance, leave (incl. Unpaid),
   overtime, and penalties and produce the full per-line shape + totals, applying
   the documented formulas; never fabricate values where no source exists.
4. **Expand the salary APIs** in `server/salary-routes.ts`: `GET /api/salary/preview`
   (filters month/year/branch/department/employeeId/includeDraft), `POST /api/salary/runs`
   (mode DRAFT|GENERATED, manualAdjustments, remarks; validate all numerics;
   block duplicate FINALIZED per employee/month/year; audit), `GET /api/salary/runs`
   (full filter + pagination set from spec), `PATCH /api/salary/runs/:id/status`
   (APPROVED|FINALIZED|CANCELLED with lifecycle + lock rules + audit), and
   `PATCH /api/salary/run-items/:id` (edit only DRAFT/GENERATED items, only
   bonus/allowance/manual-adjustment/remarks, full numeric validation incl.
   payable not negative). Replace the flat allow-list with per-action permission
   checks and add audit logging after commit.
5. **Add the report endpoint** `GET /api/reports/salary` (compat route for the
   report screen) honoring the spec filters with pagination + totals; register it
   so it is matched before any reports catch-all router.
6. **Rebuild Salary Create frontend** (`client/src/pages/salary-create.tsx`):
   real filters, Preview, editable adjustment fields with inline validation and
   recalculation, Save Draft / Generate / Approve / Finalize buttons gated by
   role, duplicate-finalized warning, loading/empty/error states, and toasts only
   after real API success (remove any placeholder copy).
7. **Rebuild Salary Report frontend** (`client/src/pages/salary-report.tsx`):
   full filter set, table of components/deductions/net/status/payment status,
   totals footer, pagination, and export/print honoring the active filters.
8. **Verify + document**: run `tsc` (must equal baseline, no new errors) and
   `npm test`; smoke the new endpoints against the live DB; write
   `PATCH2_STAGE4_SALARY_CHANGELOG.md`; close with an architect
   `responsibility: evaluate_task` review. Final chat message must be
   "Patch 2 Stage 4 salary workflow complete" followed by the lists the spec
   requires (files changed, APIs added, DB changes, formulas used, permissions,
   tests run, unresolved issues).

## Critical constraints
- No mock data, no fake-success toasts, no silent overwrite of salary records.
- No duplicate FINALIZED salary for the same employee/month/year (enforced in
  service logic, backed by the unique index).
- `db:push` is broken — schema changes only via idempotent ALTER in `ensure.ts`.
- Keep existing column names and existing endpoints working; map spec field names
  in the API layer. Secrets stay in env. No destructive SQL.
- Raw SQL joining `users` (uuid id) to `attendance`/`leave_requests`/
  `overtime_records` (varchar `user_id`) needs `::text` casts; `penalties.employee_id`
  is uuid (no cast vs users.id).

## Relevant files
- `client/src/pages/salary-create.tsx`
- `client/src/pages/salary-report.tsx`
- `client/src/App.tsx:359-360`
- `client/src/components/app-sidebar.tsx:253-254`
- `client/src/routes/route-registry.ts:240-241`
- `server/salary-routes.ts`
- `server/routes.ts:286,304`
- `server/db/ensure.ts`
- `server/utils/role-utils.ts`
- `server/middleware/report-permission.ts`
- `server/services/activity-service.ts`
- `server/stage3-reports-routes.ts`
- `shared/schema.ts:788-866`
