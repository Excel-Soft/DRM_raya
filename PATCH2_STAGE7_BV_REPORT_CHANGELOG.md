# Patch 2 — Stage 7: BV Report Data-Source Unification

**Date:** 2026-06-10
**Scope:** Make the BV Report list (`GET /api/reports/bv`), creation
(`POST /api/bv-reports`), and export (`GET /api/reports/bv/export`) all read and
write **one** canonical table — `drm.bv_reports`. Replace hardcoded metrics with
real formulas, enforce report-permission + row-scope, add an approval workflow,
and audit every mutation. The legacy `drm.bv_entries` table is left untouched as
a read-only sales feed (still consumed by `project-report.service.ts`).

> Companion design note: `BV_REPORT_DATA_SOURCE_DECISION.md`.

---

## Why

Before this stage the BV Report screen and its export read from a different
place than the create form wrote to, so reports a user created never appeared in
the report/export, and the displayed metrics were hardcoded placeholders rather
than values derived from stored data.

---

## What changed

### Canonical read + metrics — `server/services/bv-report.service.ts`
- `getBvReportData(filterUserIds, fromDate, toDate, filters?)` reads
  **exclusively** from `drm.bv_reports`, joined to `drm.customers` (company-name
  fallback) and `drm.users` (author + assignee display names; author `branch`).
- Date-range filter on `report_date`; optional row-scope
  `(user_id = ANY OR assigned_to = ANY)` when `filterUserIds` is provided; plus
  optional `status`, `company` (ILIKE on `coalesce(company_name, c.company_name)`),
  and `branch` (author `users.branch`) filters.
- Metrics are computed honestly over the **full filtered set** (never the page):
  - `totalTasks` = **COUNT** of report records (semantically "Total Reports").
  - `valueOfServiceSold` (alias `valueSold`) = SUM of `value_sold`.
  - `successRate` = `approvedCount / totalCount * 100`, or **`null`** with
    `missingMetrics:["successRate"]` when there are **zero** rows. No fabricated
    `0`/`100` placeholders.
  - `followUpsCompleted` / `missedLeads` = **`null`** (no auditable aggregate
    source) — named in `missingMetrics` and explained in `missingMetricReasons`.
    The per-report self-reported values stay visible per row.
  - `reportCount`, per-day `chartData`, and `pagination {page,limit,total,totalPages}`
    are included.
- **Additive shape (no renames):** all prior keys retained; added `valueSold`,
  `missingMetricReasons`, `pagination`, and `rows` (the paginated slice;
  `details` remains the full filtered set, which the metrics/CSV use).

### Routing — `server/reports-routes.ts`
- Registered **specific** `GET /reports/bv` and `GET /reports/bv/export` routes
  **before** the `/reports/:type` and `/reports/:type/export` catch-alls (Express
  matches in declaration order).
- Removed the `bv` case from both catch-all dispatch switches and the
  allowed-types array; deleted the old `getBvReport` placeholder.
- Both routes guarded by `requireReportPermission("bv_report", "view" | "export")`
  and scoped (executive → self, manager → department user-ids, global admin →
  unscoped). Export writes a `bv_report.export` audit entry (csv/json).
- Both routes parse query filters via `parseBvFilters` (fails closed: an
  out-of-range `status` or a supplied `package`/`method` is a **400**) and accept
  `startDate`/`endDate` as aliases for `from`/`to`. The list also paginates via
  `parseBvPaging` (`limit` clamped `1..500`); the **export never paginates**, so
  the exported row count equals `pagination.total`. The export **filename**
  includes the date range, selected user (`_user-<id8>`/`_user-all`), and status.
- CSV `bv` branch split out from the GM branch with its own columns; a `null`
  `successRate`/`followUpsCompleted`/`missedLeads` renders as `"N/A"` rather than
  crashing (the shared `ReportMetrics` type now allows `null`).

### CRUD + approval workflow — `server/reports-routes.ts`
- `POST /bv-reports` (create) and `PUT /bv-reports/:id` (edit) guarded by
  report-permission; status is clamped — setting `Approved`/`Rejected` requires an
  approver role, and rows already `Approved`/`Rejected` are locked for non-approvers.
- New `POST /bv-reports/:id/approve` and `POST /bv-reports/:id/reject` (approve
  guard): only a `Submitted` row may transition; any other source status returns
  **409**. Approve stamps `approved_by`/`approved_at`; **reject requires a
  non-empty `reason`** (else **400**) and stamps `rejected_by`/`rejected_at` +
  `rejection_reason`.
- `PUT /bv-reports/:id` and a new **`PATCH /bv-reports/:id` alias** share one
  handler (identical edit semantics + guards).
- Every create / update / approve / reject / export is audited via
  `ActivityLogService.log` (best-effort, never throws on the mutation path); the
  reject audit also records the reason.

### Repository — `server/repositories/bv-reports.repository.ts`
- `list(filterUserIds)`, `findById(filterUserIds | null, id)`, and
  `setStatus(id, status, {actorId?, reason?})` support manager team-visibility,
  unscoped approver lookups, and approval-metadata stamping. `setStatus` writes
  `approved_by`/`approved_at` on an Approve and `rejected_by`/`rejected_at`/
  `rejection_reason` on a Reject.
- `ensureBvReportsSchema()` idempotently adds the five approval columns
  (`approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`)
  via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (repo-wide `db:push` is broken),
  and `RETURNING_COLUMNS` now includes them. Mirrored in `shared/schema.ts`.
- **Migration fix (boot blocker):** `ensureBvReportsSchema()` upgrades the legacy
  `bv_reports` id columns to `uuid`. A legacy import had `assigned_to` as
  `varchar`, so the `add column if not exists assigned_to uuid` was a no-op and
  left it `varchar`; the subsequent `coalesce(assigned_to, user_id)` then failed
  with *"COALESCE types character varying and uuid cannot be matched"*, rolling
  back the whole transaction on every boot and leaving **all** id columns as
  `varchar`. That, in turn, made the canonical join (`uuid = varchar`) and every
  repository call (which runs `ensure` first) return **500**. Added a guarded
  `alter column assigned_to type uuid using nullif(assigned_to,'')::uuid` before
  the coalesce so the conversion completes idempotently. (Table was empty — zero
  data risk.)

### Frontend
- `client/src/pages/user-reports.tsx`: `ReportMetrics.successRate`,
  `followUpsCompleted`, and `missedLeads` are now `number | null` (render `—`
  when null); the report **export now sends the selected `userId`** so the export
  is scoped and filename-tagged to the chosen user (the list query already sent
  it). `BvReportTable` shows real `bv_reports` columns (#/Date/Title/Company/
  Author/Status/TotalTasks/ValueSold/SuccessRate/Follow-ups/MissedLeads); the
  per-row "Total Tasks" column keeps its name (it is the report's self-reported
  field, distinct from the new COUNT headline). No aggregate metric card is
  rendered on this screen, so there was no "Total Reports" card to relabel.
- `client/src/pages/bv-report-new.tsx`: Status is a `Select` (was free-text);
  non-approvers are restricted to `Draft`/`Submitted` (server remains
  authoritative). Verified to use its own per-report form fields (unchanged).

---

## Verification

- `npm run check` (`tsc --noEmit`): **56** errors total — all pre-existing
  baseline errors in unrelated files (loan/vas/gm/refund, project-assignments,
  etc.); **0** new errors in any file touched by this stage.
- `npm run dev`: server boots clean; `ensureBvReportsSchema()` completes, adding
  the five approval columns (`approved_by/at`, `rejected_by/at`,
  `rejection_reason`) and keeping `{id,user_id,customer_id,assigned_to}` as `uuid`.
- `npm test` (`vitest run`): **104** tests pass (no regressions).

### Smoke tests (all 10 passed; admin = minted `admin` JWT, non-approver = minted `sales_executive` JWT)

These mirror the spec's end-to-end checks. Temporary rows were created via the
real API and deleted afterward; no manual DB edits.

| # | Check | Result |
|---|-------|--------|
| 1 | `POST /bv-reports` (as non-approver) creates a report → `201` | PASS |
| 2 | The created report appears in `GET /reports/bv` | PASS |
| 3 | It surfaces with no DB intervention — single canonical source (`/reports/bv`) | PASS |
| 4 | Non-approver creating `status:"Approved"` is rejected → **403** | PASS |
| 5 | Non-approver hitting `POST /bv-reports/:id/approve` → **403** | PASS |
| 6 | `POST /bv-reports/:id/reject` with blank/missing reason → **400** | PASS |
| 7 | Metrics are real, not hardcoded: `totalTasks` = COUNT, `successRate` = approved-ratio, `followUpsCompleted`/`missedLeads` = `null` + `missingMetricReasons` | PASS |
| 8 | `userId` filter narrows both metrics and rows (`execTotal ≤ allTotal`) | PASS |
| 9 | Export carries the user filter — filename tagged `_user-<id8>` | PASS |
| 10 | Export is not paginated — exported rows == filtered `pagination.total` (even with list `limit=1`) | PASS |

---

## Out of scope / untouched
- `drm.bv_entries` (legacy sales feed) and `project-report.service.ts`.
- Salary tasks (#30–37) were explicitly excluded from this stage.
