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

---

## Stage 9 addendum (Patch 3, 2026-06-15)

Stage 9 re-verified the decision above end-to-end and locked it down with an
automated suite (`server/stage9-bv-report.test.ts`). No application source changed;
the addendum records the evidence behind two judgement calls so future work does not
silently "fix" them by fabricating data.

### `follow_ups` evaluated as a metric source — and rejected

`followUpsCompleted` / `missedLeads` stay **`null` + a `missingMetricReasons`
entry**. Before re-affirming this, `drm.follow_ups` was explicitly evaluated as a
possible aggregate source and rejected on three independent grounds:

1. **No structural relation.** `drm.follow_ups` has **no foreign key / link column to
   `drm.bv_reports`** (no `bv_report_id`). The only way to associate a follow-up with
   a BV *report* is indirectly via `user_id` + a date window — which is a CRM
   follow-up count, not a property of a BV report. Rolling it into a BV-report headline
   would silently change the metric's meaning.
2. **No data to aggregate.** The table is currently **empty**, so any computed
   aggregate would be `0` for every scope — a fabricated zero, which the honesty rule
   and the Stage 9 spec explicitly forbid ("do not fake zero if the relation does not
   exist").
3. **Self-reported alternative is per-row only.** The per-report `follow_ups_done` /
   `missed_leads` columns are self-reported and stay visible per row (`rows`/`details`)
   for transparency; summing self-reported numbers into a headline KPI would be
   misleading.

Conclusion: there is **no reliable relation to roll up**, so `null` + reason is the
spec-mandated outcome, not an under-delivery. If a real, auditable, FK-linked
follow-up source is added later, revisit this and compute the metric honestly.

### Documented UI deviations (intentional, no rewrite)

These are imported-app behaviours left as-is under the "run the app as-is / minimal
changes" preference. Neither is a data-leak — the server is authoritative in both
cases.

- **BV "Select User" picker is read-only / self.** The client does not let a manager
  pick another user from the BV tab; `userId` is still sent (self) and the server
  row-scopes authoritatively via `resolveBvScope` (executive → self, managerial →
  department, global admin → unscoped). A user can never widen their scope by editing
  the request — the server clamps it.
- **On-screen status sub-filter is client-side.** The BV table filters the displayed
  rows by status in the browser; this value is **not** forwarded to `GET
  /api/reports/bv` or to the export. At the default `status=all` the export therefore
  matches the on-screen dataset. The server export *does* honour a `status` query
  param when one is supplied, so the capability exists server-side; only the client
  wiring is omitted. Documented rather than refactoring the shared report-tab
  component tree (which all report types share).
