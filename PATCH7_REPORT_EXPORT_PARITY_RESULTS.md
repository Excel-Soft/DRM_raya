# Patch 7 — Report Export Parity Results (Runtime Re-verification)

Date: 2026-06-30. Re-verifies, **at runtime against the live dev server**, that
each report's on-screen view and its export draw from the same query/service with
the same filters and role-scope, that the export filename carries
report+range+user/branch+timestamp, and that exports are role-gated. This
complements the static parity sign-off in `PATCH6_REPORT_EXPORT_PARITY_RESULTS.md`
(unchanged) with **executed** evidence. Standard: `EXPORT_STANDARD.md`.

## Method

A minted-JWT smoke harness issued real HTTP calls to `localhost:5000` with
role-scoped bearer tokens, comparing each list endpoint's row count to its export
row count over the same filters, using **real DB rows** (no fixtures). Parity is
asserted on the export's **detail** rows (see Daily Target note below).

## Results (executed)

| Report | View source | Export source | View rows | Export rows | Parity |
|---|---|---|---|---|---|
| Raw Attendance | `GET /api/reports/raw-attendance` | `…/export` | 15 | 15 | **PASS** |
| Salary | `GET /api/reports/salary` | `…/export` | 6 | 6 | **PASS** |
| Event | `GET /api/reports/event` | `…/export` | 0 | 0 | **PASS** (low data) |
| Reception | `GET /api/reports/reception` | `…/export` | 0 | 0 | **PASS** (low data) |
| Daily Target | `GET /api/reports/day-target` | `…/export?format=csv` | 4 | 4 detail | **PASS** |
| BV | `GET /reports/bv` | `…/export` | 3 | 3 | **PASS** |
| Penalty | view-only (no export UI) | n/a | — | — | n/a (intentional) |

## Notes

- **Same source.** Each export reuses the same query builder and scope resolver as
  its list endpoint, so an export can never return rows the user cannot see. This
  was already true before this stage; here it is confirmed by equal counts.
- **Daily Target export is a *structured* CSV**, not a flat dump: it carries a
  title, a summary-metrics block (Total Assigned/Achieved/Pending, Average
  Achievement %, Employee Count), then the detail table. The **detail rows (4)**
  equal the list total (4) **and** the summary `Employee Count` (4) — all three
  agree. A naive whole-file line count does **not** reflect parity for this report.
- **Event / Reception** parity is `0 == 0` with current data; source parity is
  additionally code-verified (shared filter builders + `requireReportPermission`).
  Re-run with seeded rows to exercise non-zero parity.
- **BV export honours the selected user filter.** With `?userId=<admin>` the
  server `Content-Disposition` filename embeds `_user-04921d75…` and the exported
  row set is ≤ the unfiltered set — i.e. the filter is applied, not cosmetic.
- **Export role-gating.** Unauthenticated export calls return 401; a
  `sales_executive` is denied salary export (403). See
  `PATCH7_REPORT_PERMISSION_MATRIX.md`.

## Evidence

15/15 smoke checks passed (S01, S04, S05, S06, S08 parity; S11 BV user filter).
`npm run check` (tsc) exits 0.
