# Salary Formula & Freeze — Sign-off

Date: 2026-06-22. Documents the salary computation and the freeze/finalize
lifecycle exactly as implemented, for management sign-off. **No formula change
was made** in Patch 6 Stage 8; this records the current, live behaviour. The
open business decision is tracked as item **E** in
`PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.

## Source of truth

`server/salary-routes.ts` — `computeSalaryLine` (preview computation builds full
per-employee payroll lines from live data only). Original formula derivation:
`PATCH2_STAGE4_SALARY_CHANGELOG.md`.

## Formulas (as implemented)

```
perDaySalary         = basicSalary / 30
grossSalary          = basicSalary + allowance + bonus + overtimeAmount
unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary
absenceDeduction     = daysAbsent     * perDaySalary
lateDeduction        = 0   (no late-penalty policy; lateMinutes informational)
penaltyAmount        = SUM of APPROVED, non-voided penalties in the period
allowanceAmount      = SUM of fixed users.* allowance columns (real source)
bonusAmount          = SUM of APPROVED drm.employee_bonuses for the period
loanDeduction        = SUM of outstanding instalments on active loan_requests
overtimeAmount       = 0   (no overtime rate; minutes informational, manual)
totalDeductions      = unpaidLeave + absence + late + penalty + loan + other
netSalary            = grossSalary - totalDeductions
payableSalary        = max(0, netSalary)
```

All lines are computed from real, filtered DB data — no fabricated rows.

## Freeze / finalize lifecycle

- A salary run progresses through its lifecycle states via `ALLOWED_NEXT`.
- **FINALIZED locks the run irreversibly** — once finalized, the run cannot be
  reopened or recomputed.

## Pending management confirmation (item E, REP-002)

Confirm all three, or specify the change:

1. `perDaySalary = basicSalary / 30` is the correct per-day basis.
2. The **no late-penalty** policy is intended (`lateDeduction = 0`).
3. **FINALIZED** is intended to lock the run irreversibly.

**Current default until confirmed:** `/30` basis, no late penalty, finalize
locks. These are flag/config-backed, so a confirmed decision needs no code
change — only the decision.

## Patch 7 re-verification (2026-06-30)

Runtime re-verification this stage; **no formula or lifecycle change made**.

- **FINALIZE freeze enforced (runtime):** a PATCH to advance the live FINALIZED
  run (`status` change) returns **409**, and editing a FINALIZED line item returns
  **409** ("Finalized/locked salary runs cannot be modified" /
  "only DRAFT/GENERATED lines editable"). The irreversible terminal transition
  itself is code-verified (`ALLOWED_NEXT.FINALIZED = []`, `LOCKED_STATUSES`); only
  the **rejection** path was exercised at runtime to avoid an irreversible
  FINALIZE on real data.
- **View ↔ export parity (runtime):** salary report list = 6 rows, export = 6 rows
  over identical filters/scope.
- **No cross-user leak (runtime):** `sales_executive` salary **view** returns 200
  but **0 rows** (self-scoped via `resolveScope`) vs admin's 6; salary **export**
  is denied (403); anonymous is 401.
- Items E (perDay `/30`, no late penalty, finalize locks) remain **pending
  management confirmation**; defaults unchanged.
