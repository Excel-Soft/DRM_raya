# Patch 7 — Report Formula / Scope Sign-off (Pending Management Confirmation)

Date: 2026-06-30. The report surfaces are export-, audit-, filename-, and
permission-ready and were re-verified at runtime this stage (15/15 smoke checks).
The remaining items are **business-rule decisions** about formulas, sources, and
scope. Per project constraint, **no formula, permission, role, source, or
approval-logic change is made until management confirms.** Defaults below preserve
existing behaviour, so none of these block the engineering work delivered. Patch 6
master list: `PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.

## Carried forward from Patch 6 (unchanged defaults)

| Item | Report | Decision required | Current default | Detail doc |
|---|---|---|---|---|
| **E** (REP-002) | Salary | `perDaySalary = basicSalary / 30`; no late-penalty policy; FINALIZED locks irreversibly | `/30`, no late penalty, finalize locks | `SALARY_FORMULA_AND_FREEZE_SIGNOFF.md` |
| **F** (REP-005) | BV | Confirm BV metric definitions; legacy `package`/`method` filters permanently retired | legacy filters rejected (400) | `BV_REPORT_METRIC_AND_MIGRATION_SIGNOFF.md` |
| **K** (REP-004) | Daily Target | Does "achievement" count **only Approved** GMs? | Approved-only | `DAILY_TARGET_KPI_FORMULAS.md` |
| **L** (REP-001) | Raw Attendance | Is `drm.attendance` the **sole** source of truth (vs. biometric import)? | `drm.attendance` only | this doc |

## New this stage

### Item M (REP-001) — Raw Attendance has no row-level scope

`raw_attendance` is gated **only at the role level**
(`server/middleware/report-permission.ts`): view = account_manager, hr, hr_manager,
hod (+ admin/super_hod always); export = account_manager, hr, hr_manager. There is
**no per-row/department filter** inside the handler — every permitted role sees
**company-wide** raw attendance. In particular a **HOD sees attendance for all
departments**, not just their own.

- **Runtime confirmation:** with date params, `hod` view → 200 (full set),
  `hod` export → 403, `sales_executive` view → 403, `admin` → 200.
- **Decision required:** is company-wide visibility for HOD intended, or should
  HOD raw attendance be department-scoped like penalties/day-target?
- **Current default until confirmed:** company-wide for all permitted roles
  (no row-scope). No code change made.

### Item N (REP-001) — Attendance timezone semantics

Attendance `date`, `check_in`/`check_out`, and derived `workingMinutes` are read
and computed in **server-local time**; there is no per-branch timezone
normalization. For multi-timezone branches this can drift a record across a day
boundary.

- **Decision required:** confirm server-local time is acceptable, or specify the
  per-branch timezone rule.
- **Current default until confirmed:** server-local time. No code change made.

## Daily Target — null-handling confirmed (item K context)

Live data currently has **no assigned target in the queried range**, so the
report returns `assignedTarget = null` and `pending = null` for every employee.
Runtime confirmed the report surfaces these as **`null`, never `0%` or a
fabricated value** (honesty guarantee). The achievement **arithmetic**
(`achievement% = round(amount/target*100)`) remains **code-verified** only until
target rows exist to exercise it.

## Raw Attendance source (item L)

`server/stage3-reports-routes.ts` reads raw attendance **only** from
`drm.attendance`; no biometric/import source is merged. View and export share the
query. **Current default until confirmed:** `drm.attendance` as sole source.

## Penalty export — not required (not a deferred gap)

Penalty has no export endpoint or button by design. The absence is intentional and
is **not** a dead control; adding an export is out-of-scope and would require
management confirmation. See `PENALTY_SCHEMA_PERMISSION_SIGNOFF.md`.

## Status

All items above are **blocking sign-off closure** for their report but
**non-blocking for the engineering work** delivered this stage. On confirmation,
update the corresponding detail doc and (only if the decision differs from the
default) make the change.
