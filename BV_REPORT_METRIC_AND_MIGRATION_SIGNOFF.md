# BV Report — Metric & Legacy Migration Sign-off

Date: 2026-06-22. Documents the BV report metric definitions and the legacy-filter
migration exactly as implemented, for management sign-off. **No metric or filter
change** was made in Patch 6 Stage 8. The open business decision is item **F** in
`PATCH6_MANAGEMENT_CONFIRMATION_REQUIRED.md`.

## Source of truth

`server/reports-routes.ts` — canonical BV source `bv_reports`:
`GET /reports/bv` (view) and `GET /reports/bv/export` (export), plus the
`bv-reports` CRUD/approve/reject routes. Original derivation:
`PATCH2_STAGE7_BV_REPORT_CHANGELOG.md`.

## Metric & status model (as implemented)

- BV status vocabulary: `Draft`, `Submitted`, `Approved`, `Rejected`.
- Only approvers (`bv_report.approve` roles) may create or move a report into
  `Approved`/`Rejected`; a finalized BV report can no longer be edited.
- The view and the export use the **same** query and the **same** row-scope
  (`resolveBvScope`); the export returns the full filtered set.

## Legacy migration — `package` / `method` filters retired

- BV query parsing **fails closed**: an out-of-range `status`, or any legacy
  `package` / `method` filter, is rejected with **400** — never silently
  ignored. Legacy filters are treated as permanently retired.

## Export filename

- `bv_report_<from>_<to>[user][status]_<timestamp>.csv` — the historical
  `bv_report_` prefix is **preserved** (asserted by `stage9-bv-report.test`); the
  timestamp suffix was added this stage for filename parity.

## Pending management confirmation (item F, REP-005)

Confirm both:

1. The BV metric definitions above are correct.
2. The legacy `package` / `method` filters are **permanently retired** (400).

**Current default until confirmed:** legacy filters rejected. Config-backed — a
confirmed decision needs no code change, only the decision.
