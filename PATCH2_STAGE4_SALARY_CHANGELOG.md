# Patch 2 Stage 4 — Salary Create + Salary Report (DB-backed payroll workflow)

Turns the two salary screens from a thin gross/absence calculator into a real,
auditable payroll workflow: live preview → DRAFT/GENERATED run → APPROVED →
FINALIZED (locked), with CANCELLED as an off-ramp. No mock data, no
fake-success toasts, no duplicate finalized salary per employee/month/year.

## Schema (extended, never renamed)

`db:push` is broken repo-wide (pre-existing FK mismatch), so changes are applied
idempotently at boot via `ensureSalarySchema()` in `server/db/ensure.ts` and
mirrored in `shared/schema.ts`.

**`drm.salary_runs`** added: `generated_by`, `generated_at`, `finalized_by`,
`finalized_at`, `remarks`, `deleted_at` (soft delete). Indexes on `generated_by`
and `deleted_at`.

**`drm.salary_run_items`** added: `basic_salary`, `leave_days`,
`unpaid_leave_days`, `unpaid_leave_deduction`, `late_minutes`, `late_deduction`,
`overtime_minutes`, `penalty_amount`, `loan_deduction`, `bonus_amount`,
`allowance_amount`, `total_deductions`, `payable_salary`,
`payment_status` (default `UNPAID`), `remarks`, `calculation_snapshot` (jsonb).
Unique index `uq_salary_run_items_run_user (run_id, user_id)` (one line per
employee per run) plus an index on `payment_status`.

## Calculation (from live HR data only)

Per employee, for the selected month/year:

- `basicSalary` — from `users.basic_salary`.
- `perDaySalary = basicSalary / 30`.
- `daysPresent` — attendance rows with status Present/Late/HalfDay.
- `daysAbsent` — attendance rows with status Absent.
- `unpaidLeaveDays` — approved `leave_requests` of type `Unpaid` overlapping the
  period (whole-day overlap, clamped to the month). Other approved leave is
  counted into `leaveDays` (informational).
- `overtimeMinutes` — sum of approved `overtime_records.time_spent` in the period
  (informational).
- `penaltyAmount` — sum of APPROVED, non-VOIDED, non-deleted `penalties` in the
  period.

Formulas:

```
grossSalary          = basicSalary + allowance + bonus + overtimeAmount
unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary
absenceDeduction     = daysAbsent     * perDaySalary
totalDeductions      = unpaidLeaveDeduction + absenceDeduction + lateDeduction
                       + penaltyAmount + loanDeduction + otherDeductions
netSalary            = grossSalary - totalDeductions
payableSalary        = max(0, netSalary)
```

Every line stores a `calculation_snapshot` (inputs, outputs, assumptions,
timestamp) so the figure can always be explained later.

### Honest zeros (no fabricated values)

These have no source table in this DB and default to 0; they are only ever set
via **manual adjustments**, never invented:

- `allowanceAmount`, `bonusAmount` — manual.
- `overtimeAmount` — manual (overtime *minutes* are real, but there is no
  overtime-rate policy, so the payable amount is 0 unless entered).
- `loanDeduction` — manual (no loan ledger wired in).
- `lateMinutes` / `lateDeduction` — 0 (no late-minutes source column and no
  late-penalty policy); `lateMinutes` is shown as informational only.

## API (all under JWT auth)

- `GET  /api/salary/preview` — live computed lines + totals + employeeCount +
  `finalizedConflicts` (employees who already have a finalized salary this
  period). Not persisted.
- `POST /api/salary/runs` — persist a run as `DRAFT` or `GENERATED` with full
  lines + manual adjustments; validates numerics; blocks creation when any
  employee already has a finalized salary for that month/year (409); audited.
- `GET  /api/salary/runs` — list runs with filters (month, year, status, branch,
  department, generatedBy) + pagination + row scoping.
- `GET  /api/salary/runs/:id` — run + items (row-scoped).
- `PATCH /api/salary/runs/:id/status` — lifecycle transitions
  (`GENERATED|APPROVED|FINALIZED|CANCELLED`) with strict legal-state checks,
  finalize/locked immutability, HOD-own-department approval guard, finalize-time
  duplicate guard; audited.
- `PATCH /api/salary/run-items/:id` — edit only `bonusAmount`, `allowanceAmount`,
  `overtimeAmount`, `loanDeduction`, `otherDeductions`, `remarks`, and only while
  the run is `DRAFT`/`GENERATED`; recomputes the line + parent-run totals;
  audited.
- `GET  /api/reports/salary` — item-level report with filters (employee,
  department, branch, month, year, salary status, payment status, generatedBy,
  search), pagination, and all-filter totals; row-scoped. Registered before the
  `/reports/:type` catch-all so it wins.
- `GET  /api/reports/salary/export` — CSV honoring the same filters/scope;
  audited.

## Permissions (per action) + row scoping

Roles are normalized (`normalizeRole`) then classed:

| Class | Roles (normalized) | preview/generate | view | export | approve | finalize | edit | cancel |
|------|--------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| full | admin, super_hod | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| accounts | account_manager (accountant, accounts_office) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| hr | hr, hr_manager | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| hod | hod | ✗ | ✓ | ✗ | ✓ (own dept) | ✗ | ✗ | ✗ |
| manager | other managerial roles | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| executive | everyone else | ✗ | ✓ (own only) | ✗ | ✗ | ✗ | ✗ | ✗ |

Row scoping on every read: full/accounts/hr → all; hod/manager → their
department; executive → only their own salary lines.

## Audit

Every state change writes to `drm.activity_logs` via the best-effort
`recordAuditLog` helper: `salary.create_draft`, `salary.generate`,
`salary.edit_item`, `salary.approve`, `salary.finalize`, `salary.cancel`,
`salary.export` — with actor, before/after, status transition, and reason.

## Frontend

- **Salary Create** (`client/src/pages/salary-create.tsx`) — month/year/branch/
  department/**employee** filters (employee picker sourced from `/api/users`,
  passed through to preview and run creation), live preview, inline-editable
  allowance/bonus/overtime/loan/other fields with client-side recompute and
  totals footer, Save as Draft / Generate Run, a finalized-conflict warning
  banner, and a Recent Runs panel with role-gated **Generate** (DRAFT→GENERATED),
  Approve/Finalize/Cancel buttons. Toasts fire only on real success.
- **Salary Report** (`client/src/pages/salary-report.tsx`) — full filter set
  including **employee** and **generated-by** pickers (both sourced from
  `/api/users`), component/deduction/net/payable breakdown, salary + payment
  status badges, all-filter totals footer, pagination, and Export CSV / Print
  (export hidden for roles without permission). Errors are surfaced honestly,
  never as empty success.

### Pooled-client safety

`POST /runs` and `PATCH /run-items/:id` acquire a `pg` pool client. Client
release is done **only** in `finally` — early auth/validation/conflict returns
no longer call `client.release()` themselves (double-release on `pg` can throw
and destabilize the pool). Verified the pool stays healthy across repeated
early-return paths.

## Known limitations (documented, not hidden)

- `payment_status` defaults `UNPAID` and is fully reportable/filterable, but
  there is no mark-as-paid mutation in this stage (deferred).
- `allowance`/`bonus`/`loan`/`overtimeAmount` are manual because the DB has no
  authoritative source tables for them yet.

## Verification

- `tsc --noEmit`: 57 errors — unchanged pre-existing baseline; 0 in any salary
  file.
- `npm test`: 60 passed (6 files).
- Endpoint smoke test (admin): create→edit→approve→finalize succeed; edit after
  approve → 409; status change after finalize → 409; re-create same period →
  409 with the conflicting employee names; audit rows written for each step.
- Permission smoke test (executive): preview/generate/export → 403; report view
  → 200 (self-scoped).
