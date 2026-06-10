# BV Report — Data-Source Decision

**Date:** 2026-06-10
**Status:** Adopted (Patch 2, Stage 7)

## Decision

The BV Report feature — the report **list/metrics** (`GET /api/reports/bv`), the
create form (`POST /api/bv-reports`), and the **export** (`GET /api/reports/bv/export`)
— uses **one canonical source of truth: `drm.bv_reports`**.

`drm.bv_entries` remains a **read-only legacy sales feed** and is **not** read or
written by the BV Report. It continues to serve `project-report.service.ts` for
financial reconciliation only.

## Context

There are two tables with overlapping names:

| Table | Role | Written by | Read by |
|-------|------|-----------|---------|
| `drm.bv_reports` | Canonical BV report records (the create form's target) | `POST /api/bv-reports` (+ approve/reject) | BV Report list, metrics, export |
| `drm.bv_entries` | Legacy sales/business-value feed | legacy import / sales flows | `project-report.service.ts` only |

Before this stage the BV Report list and export read from a *different* place
than the create form wrote to, so user-created reports never appeared, and the
on-screen metrics were hardcoded placeholders rather than values derived from
stored data.

## Why `drm.bv_reports` (not `bv_entries`)

1. **Write/read symmetry.** The create form already writes to `bv_reports`. A
   report a user submits must be the same record the list, approval workflow, and
   export operate on. Splitting source from sink is the root cause of the
   "my report doesn't show up" bug.
2. **It carries the report-level fields** the feature needs — `status`, `title`,
   `summary`, `assigned_to`, the metric columns (`total_tasks`, `value_sold`,
   `success_rate`, `follow_ups_done`, `missed_leads`) — and an approval lifecycle
   (`Draft → Submitted → Approved/Rejected`). `bv_entries` is a flat sales feed
   with no report identity or approval state.
3. **Least blast radius.** `bv_entries` is consumed elsewhere
   (`project-report.service.ts`). Treating it as read-only avoids disturbing
   financial reconciliation and respects the "run the imported app as-is" mandate.

## Honesty rule for metrics

Metrics are computed from real stored rows. A metric that cannot be derived —
specifically an **average `successRate` over zero rows** — is returned as `null`
and listed in `missingMetrics`, never fabricated as `0` or `100`. The UI renders
such a value as `—` (and `"N/A"` in CSV export).

## Permissions & audit

- Read/create/edit/export/approve are each guarded by
  `requireReportPermission("bv_report", <action>)` and row-scoped (executive →
  self, manager → department members, global admin → unscoped).
- Status is server-authoritative: only approver roles may set
  `Approved`/`Rejected`; only a `Submitted` row may transition (else **409**).
- Every create / update / approve / reject / export is recorded via
  `ActivityLogService`.

## Schema note

`drm.bv_reports`' id columns (`id`, `user_id`, `customer_id`, `assigned_to`) are
`uuid`, aligned with `users.id` and `customers.id`. `ensureBvReportsSchema()`
upgrades any legacy `varchar` id columns to `uuid` idempotently at boot so the
canonical joins are native `uuid = uuid` (see the Stage 7 changelog for the
specific migration fix).

## Consequences

- A report created via the form appears immediately in the list and export.
- Metrics reflect real data and are honest about missing values.
- `bv_entries`-based reconciliation is unaffected.
- Future BV work should extend `bv_reports`; do **not** reintroduce `bv_entries`
  as a BV Report source.
