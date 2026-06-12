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

## Metrics formulas & honesty rule

Metrics are computed honestly from the real, **filtered** row set — never hardcoded:

| Metric | Formula |
|--------|---------|
| `totalTasks` | COUNT of BV report records in the filtered set (semantically "Total Reports"; the key name is kept for shared `ReportData`/CSV compatibility) |
| `valueOfServiceSold` (alias `valueSold`) | SUM of `value_sold` |
| `successRate` | `approvedCount / totalCount * 100`, or **`null`** when there are zero rows |
| `followUpsCompleted` | **`null`** — no auditable aggregate source |
| `missedLeads` | **`null`** — no auditable aggregate source |

Any metric that cannot be derived is returned as `null`, named in
`missingMetrics`, **and explained in `missingMetricReasons`** — never fabricated
as `0`/`100`. The UI renders such a value as `—` (and `"N/A"` in CSV export).

### Missing-metric limitations (followUpsCompleted / missedLeads)

These two have **no reliable relation to roll up** into a headline. The only
values available are the per-report *self-reported* `follow_ups_done` /
`missed_leads` columns. Summing self-reported numbers into a headline KPI would
be misleading, and there is no auditable follow-up/lead source to derive them
from, so both are returned as `null` + a `missingMetricReasons` entry. The
per-report values stay visible per row (`rows`/`details`) for transparency.

## Permissions & audit

- Read/create/edit/export/approve are each guarded by
  `requireReportPermission("bv_report", <action>)` and row-scoped (executive →
  self, manager → department members, global admin → unscoped).
- Status is server-authoritative: only approver roles may set
  `Approved`/`Rejected`; only a `Submitted` row may transition (else **409**).
- **Approval metadata is persisted.** Approving stamps `approved_by`/`approved_at`;
  rejecting stamps `rejected_by`/`rejected_at` and stores `rejection_reason`.
  A reject **requires a non-empty `reason`** in the body (else **400**).
- Every create / update / approve / reject / export is recorded via
  `ActivityLogService` (the reject audit also records the reason).

## Filters, pagination & export

`GET /api/reports/bv` (and the export) accept:

| Param | Behaviour |
|-------|-----------|
| `from` / `to` (aliases `startDate` / `endDate`) | date range on `report_date`; `from`/`to` win when both forms are present |
| `status` | must be one of `Draft`/`Submitted`/`Approved`/`Rejected` (else **400**); `all` clears it |
| `company` | case-insensitive `ILIKE` on `coalesce(r.company_name, c.company_name)` |
| `branch` | exact match on the author's `users.branch` |
| `userId` | row-scope narrowing (handled by `resolveBvScope`; `all` = no narrowing) |
| `page` / `limit` | list only; `limit` clamped to `1..500`; `rows` is the paginated slice |
| `package` / `method` | **unsupported** — supplying a non-empty value returns **400** (fails closed rather than silently ignoring) |

Metrics and `pagination.total` are **always computed over the full filtered
set**, never the paginated slice. `roleScope` is **N/A**: scope is derived from
the caller's role + `userId`, not a client-supplied parameter.

**Export** applies the same filters and row-scope as the list but is **never
paginated**, so the exported row count always equals `pagination.total`
(`reportCount`). The export filename includes the date range, the selected user
(`_user-<id8>` or `_user-all`), and the status filter when set.

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
