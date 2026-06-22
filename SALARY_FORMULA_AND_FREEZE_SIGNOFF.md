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
