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

## Patch 7 re-verification (2026-06-30)

Runtime re-verification this stage; **no metric or filter change made**.

- **Canonical source confirmed (runtime):** `/reports/bv` (report) returns 3 and
  `/bv-reports` (list/create sink) returns 3 — both read the same canonical
  `drm.bv_reports` table, so records created via the BV form appear in the report.
- **Metrics computed, not hardcoded (runtime):** `successRate = 33.33` derives
  from the live data (1 Approved of 3); `followUpsCompleted` and `missedLeads` are
  returned as **`null` by design** (no source column) rather than fabricated.
- **Export honours the user filter (runtime):** `?userId=<id>` yields a server
  `Content-Disposition` filename embedding `_user-<id-prefix>` and a row set ≤ the
  unfiltered export — the filter is applied, not cosmetic. The `bv_report_` prefix
  and timestamp suffix are preserved.
- Item F (metric definitions; legacy `package`/`method` filters retired → 400)
  remains **pending management confirmation**; default unchanged.
