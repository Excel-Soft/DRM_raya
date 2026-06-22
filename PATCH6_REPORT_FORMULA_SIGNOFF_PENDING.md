# Patch 6 — Report Formula Sign-off (Pending Management Confirmation)

Date: 2026-06-22. The report surfaces in Patch 6 Stage 8 are export-/audit-/
filename-ready, but four **business-rule** decisions about their formulas and
sources remain open. Per project constraint, **no formula, permission, role, or
approval-logic change is made until management confirms.** Each item below is
config/flag-backed: the keys already exist, so a confirmed decision needs the
decision only — **no code change**. Master list:
`PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.

## Open items

| Item | Report | Decision required | Current default | Detail doc |
|---|---|---|---|---|
| **E** (REP-002) | Salary | `perDaySalary = basicSalary / 30`; no late-penalty policy; FINALIZED locks irreversibly | `/30`, no late penalty, finalize locks | `SALARY_FORMULA_AND_FREEZE_SIGNOFF.md` |
| **F** (REP-005) | BV | Confirm BV metric definitions; legacy `package`/`method` filters permanently retired | legacy filters rejected (400) | `BV_REPORT_METRIC_AND_MIGRATION_SIGNOFF.md` |
| **K** (REP-004) | Daily Target | Does "achievement" count **only Approved** GMs? | Approved-only | `DAILY_TARGET_KPI_FORMULAS.md` |
| **L** (REP-001) | Raw Attendance | Is `drm.attendance` the **sole** source of truth (vs. biometric import)? | `drm.attendance` only | this doc |

## Raw Attendance source (item L, REP-001)

`server/stage3-reports-routes.ts` reads raw attendance **only** from
`drm.attendance`. No biometric/import source is merged in. The view and export
share this query and row-scope. **Current default until confirmed:**
`drm.attendance` as the sole source.

## Status

All four are **blocking sign-off closure** for their report, but **non-blocking
for the engineering work** delivered this stage (the defaults preserve existing
behaviour). Once management confirms, update the corresponding detail doc and
flip the config key if the decision differs from the default.
