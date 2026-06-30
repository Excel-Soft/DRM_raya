# Patch 7 Stage 7 — Reports / Salary / BV / Penalty Sign-off Closure (Changelog)

Date: 2026-06-30. Stage 7 is a **gap-closure and sign-off** stage, **not a
rebuild**. The report / salary / BV / penalty infrastructure was already delivered
and hardened in Patches 2 / 3 / 6. This stage **verifies that behaviour at
runtime** and **documents the closure**; the remaining business decisions are
carried forward as "pending management confirmation".

## Scope

REP-001 Raw Attendance, REP-002 Salary, REP-003 Event / Reception, REP-004 Daily
Target, REP-005 BV, PEN-001 Penalty, plus a global report-permission
re-verification.

## What changed in code

**Nothing.** No formula, permission, role, approval-logic, schema, route, UI, or
DB business-structure change was made. Constraints honoured: additive-only, no
rewrite, no mock/fallback rows, no dead controls. `npm run check` (tsc) passes
clean (**exit 0**).

> Note: the memory baseline mentioned ~57 pre-existing `tsc` errors. As of this
> stage `tsc` is **clean** — earlier patches resolved them. No new errors were
> introduced.

## What was verified (runtime)

A minted-JWT smoke suite was run against the live dev server (`localhost:5000`),
exercising real endpoints with role-scoped bearer tokens and **real DB rows**
(no fixtures, no mock data). **15 / 15 checks passed.** Full evidence:

- Export ↔ view parity: `PATCH7_REPORT_EXPORT_PARITY_RESULTS.md`
- Permission / role-scope: `PATCH7_REPORT_PERMISSION_MATRIX.md`
- Penalty schema + permission: `PENALTY_SCHEMA_PERMISSION_SIGNOFF.md`

Summary of the 15 checks:

| ID | Area | Result |
|---|---|---|
| S01 | Raw Attendance view↔export row parity (15 == 15) | PASS |
| S02 | Raw Attendance role scope (sales_exec 403, HOD export 403, HOD view 200, admin 200) | PASS |
| S03 | Salary FINALIZED run cannot be edited (status 409, line-item 409) | PASS |
| S04 | Salary view↔export row parity (6 == 6) | PASS |
| S05 | Event view↔export parity (0 == 0; low data) | PASS |
| S06 | Reception view↔export parity (0 == 0; low data) | PASS |
| S07 | Daily Target formula null-handling (pending=`null` when no target, never `0%`) | PASS |
| S08 | Daily Target structured export parity (detail rows 4 == list 4 == summary count 4) | PASS |
| S09 | BV report reads canonical source (`/reports/bv` 3 == `/bv-reports` 3) | PASS |
| S10 | BV metrics computed from data (successRate 33.33; followUps/missedLeads `null`) | PASS |
| S11 | BV export honours selected user filter (filename `_user-<id>`, scoped rows) | PASS |
| S12 | Penalty invalid update rejected (amount<0 → 400) | PASS |
| S13 | Penalty permission consistent (sales_exec create 403, admin list 200) | PASS |
| S14 | Salary view row-scoped to self; export denied; anon 401 (no cross-user leak) | PASS |
| S15 | Invalid input → error envelope, **not** fabricated rows (400, 0 rows) | PASS |

Code-verified (not runtime-exercised this stage, with reason):
- **Salary FINALIZE freeze logic** (`ALLOWED_NEXT`, `LOCKED_STATUSES`) — the
  irreversible terminal transition is code-verified; runtime confirmed only the
  *rejection* path (S03) to avoid polluting data with an irreversible FINALIZE.
- **UI loading / empty / error states** — code-verified (components render
  messages, never fabricated rows); S15 confirms the API contract behind them.
- **Daily Target formula arithmetic** — code-verified; live data currently has no
  assigned target in range, so S07 confirmed the **null-handling** branch rather
  than the arithmetic branch (honest gap, documented in
  `DAILY_TARGET_KPI_FORMULAS.md`).

## Documentation produced

Created (5): this changelog, `PATCH7_REPORT_EXPORT_PARITY_RESULTS.md`,
`PATCH7_REPORT_FORMULA_SIGNOFF_PENDING.md`, `PATCH7_REPORT_PERMISSION_MATRIX.md`,
`PENALTY_SCHEMA_PERMISSION_SIGNOFF.md`.

Updated — appended a "Patch 7 re-verification (2026-06-30)" section (3):
`SALARY_FORMULA_AND_FREEZE_SIGNOFF.md`, `DAILY_TARGET_KPI_FORMULAS.md`,
`BV_REPORT_METRIC_AND_MIGRATION_SIGNOFF.md`.

## Deferred — pending management confirmation

Carried forward from Patch 6 (defaults unchanged, behaviour preserved): **E**
(salary `/30` basis, no late penalty, FINALIZED locks), **F** (BV metric
definitions; legacy `package`/`method` filters retired → 400), **K** (Daily
Target achievement = Approved-GM only), **L** (raw attendance source =
`drm.attendance` only). New this stage: **M** (raw attendance has no row-scope —
HOD sees company-wide attendance, not department-restricted) and **N** (attendance
dates / working-minutes use server-local time; no per-branch timezone
normalization). Detail: `PATCH7_REPORT_FORMULA_SIGNOFF_PENDING.md`.

Penalty has **no export surface** — this is intentional (not a dead control);
"add export" is **not** required and would be out-of-scope without confirmation.

## Files

- Created: 5 docs above.
- Updated: 3 docs above.
- Code: **none**.
