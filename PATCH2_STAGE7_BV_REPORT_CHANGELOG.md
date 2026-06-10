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

### Canonical read + metrics — `server/services/bv-report.service.ts` (new)
- `getBvReportData(filterUserIds, fromDate, toDate)` reads **exclusively** from
  `drm.bv_reports`, joined to `drm.customers` (company-name fallback) and
  `drm.users` (author + assignee display names).
- Date-range filter on `report_date`; optional row-scope
  `(user_id = ANY OR assigned_to = ANY)` when `filterUserIds` is provided.
- Metrics are computed from real stored rows:
  - `totalTasks`, `valueOfServiceSold`, `followUpsCompleted`, `missedLeads` = sums.
  - `successRate` = average over rows, or **`null`** with `missingMetrics:["successRate"]`
    when there are **zero** rows. No fabricated `0`/`100` placeholders.
  - `reportCount` and per-day `chartData` are included.

### Routing — `server/reports-routes.ts`
- Registered **specific** `GET /reports/bv` and `GET /reports/bv/export` routes
  **before** the `/reports/:type` and `/reports/:type/export` catch-alls (Express
  matches in declaration order).
- Removed the `bv` case from both catch-all dispatch switches and the
  allowed-types array; deleted the old `getBvReport` placeholder.
- Both routes guarded by `requireReportPermission("bv_report", "view" | "export")`
  and scoped (executive → self, manager → department user-ids, global admin →
  unscoped). Export writes a `bv_report.export` audit entry (csv/json).
- CSV `bv` branch split out from the GM branch with its own columns; a `null`
  `successRate` renders as `"N/A"` rather than crashing.

### CRUD + approval workflow — `server/reports-routes.ts`
- `POST /bv-reports` (create) and `PUT /bv-reports/:id` (edit) guarded by
  report-permission; status is clamped — setting `Approved`/`Rejected` requires an
  approver role, and rows already `Approved`/`Rejected` are locked for non-approvers.
- New `POST /bv-reports/:id/approve` and `POST /bv-reports/:id/reject` (approve
  guard): only a `Submitted` row may transition; any other source status returns
  **409**.
- Every create / update / approve / reject / export is audited via
  `ActivityLogService.log` (best-effort, never throws on the mutation path).

### Repository — `server/repositories/bv-reports.repository.ts`
- `list(filterUserIds)`, `findById(filterUserIds | null, id)`, and `setStatus(id, status)`
  support manager team-visibility and unscoped approver lookups.
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
- `client/src/pages/user-reports.tsx`: `ReportMetrics.successRate` is now
  `number | null` (renders `—` when null); `BvReportTable` reshaped to real
  `bv_reports` columns (#/Date/Title/Company/Author/Status/TotalTasks/ValueSold/
  SuccessRate/Follow-ups/MissedLeads); the Type filter became a Status filter
  (All/Draft/Submitted/Approved/Rejected); search covers company/title/author.
- `client/src/pages/bv-report-new.tsx`: Status is a `Select` (was free-text);
  non-approvers are restricted to `Draft`/`Submitted` (server remains
  authoritative).

---

## Verification

- `npm run check` (`tsc --noEmit`): **56** errors total — all pre-existing
  baseline errors in unrelated files (loan/vas/gm/refund, project-assignments,
  etc.); **0** new errors in any file touched by this stage.
- `npm run dev`: server boots clean; `ensureBvReportsSchema()` now completes and
  `drm.bv_reports.{id,user_id,customer_id,assigned_to}` are all `uuid`.

### Smoke tests (all 10 passed, authenticated as a minted admin JWT; non-approver = `sales_executive`)

| # | Check | Result |
|---|-------|--------|
| 1 | `GET /reports/bv` returns canonical shape (metrics + missingMetrics + reportCount + details) | PASS |
| 2 | `POST /bv-reports` creates a Draft report | PASS |
| 3 | Created report appears in `GET /reports/bv` (single source) | PASS |
| 4 | `GET /reports/bv/export?format=csv` returns reshaped CSV header | PASS |
| 5 | `GET /reports/bv/export?format=json` returns `type:"bv"` JSON | PASS |
| 6 | Empty window → `successRate: null` + `missingMetrics:["successRate"]` (no fabrication) | PASS |
| 7 | `POST /bv-reports/:id/approve` moves `Submitted → Approved` | PASS |
| 8 | Re-approving an `Approved` report → **409** | PASS |
| 9 | `POST /bv-reports/:id/reject` moves `Submitted → Rejected` | PASS |
| 10 | Non-approver cannot set `Approved` (403 on create) **and** approve route is forbidden (403) | PASS |

---

## Out of scope / untouched
- `drm.bv_entries` (legacy sales feed) and `project-report.service.ts`.
- Salary tasks (#30–37) were explicitly excluded from this stage.
