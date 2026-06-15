# Patch 3 — Stage 9: BV Report (Data-Source Unification, Metrics, Approval, Export)

Scope: ensure the BV Report surfaces — the list/metrics (`/reports/bv`), the create
form (`/reports/bv/new`), and the CSV export — all read from and write to **one
canonical source of truth** (`drm.bv_reports`), with honest (never hardcoded)
metrics, approver-only finalization, and role-scoped export.

This stage is primarily a **verification + test + documentation** stage. The BV
Report was unified onto `drm.bv_reports` and hardened in **Patch 2 Stage 7** (see
`BV_REPORT_DATA_SOURCE_DECISION.md`), and recon confirmed it already satisfies the
Stage 9 hard rules. Rather than rewrite working, in-scope code (the user preference
is to run the imported app as-is with minimal changes), Stage 9 **locks the
behaviour down with an automated test suite** and documents the source decision,
metric formulas, and the two intentional UI deviations.

---

## Files changed

- `server/stage9-bv-report.test.ts` — **new**. DB-backed integration suite that
  drives the real wiring through `registerRoutes()` (the same entrypoint as
  `server/index.ts`) and asserts every Stage 9 hard rule (see "Tests run"). Mirrors
  the Stage 8 harness: seeds throwaway users, mints real JWTs via `authService`,
  soft-skips when Postgres is unreachable, and cleans up all seeded rows/users.
- `BV_REPORT_DATA_SOURCE_DECISION.md` — appended a **Stage 9 addendum**: the
  `drm.follow_ups` relation was explicitly evaluated as a source for
  `followUpsCompleted` / `missedLeads` and rejected (no FK to `bv_reports`, indirect
  user+date relation, table currently empty → computing would fabricate a zero), and
  the two documented UI deviations (read-only user picker, client-side status filter
  vs. export).
- `PATCH3_STAGE9_BV_REPORT_CHANGELOG.md` — this file.

**No application source files were changed.** The server (`reports-routes.ts`,
`bv-report.service.ts`, `bv-reports.repository.ts`, `report-permission.ts`) and the
client (`user-reports.tsx`, `bv-report-new.tsx`) already conform to the spec; adding
unverified changes would violate the "run as-is / minimal changes" preference. No
schema migration, no new table, no new column.

---

## Canonical data source (single source of truth)

`/reports/bv` (list + metrics), `/reports/bv/new` (create → `POST /api/bv-reports`),
and `/api/reports/bv/export` all bind to **`drm.bv_reports`** — the same table the
create form writes to. The legacy `drm.bv_entries` table remains **read-only** and
is consumed only by `project-report.service.ts` (financial reconciliation); it is
never read or written by the BV Report. There is **no separate/invisible model**:
the Stage 9 test "canonical source (write/read symmetry)" proves a report created via
`POST /api/bv-reports` appears verbatim in `GET /api/reports/bv`.

---

## APIs (unchanged — verified, not modified)

- `GET /api/reports/bv` — list + honest metrics over the full filtered, role-scoped
  set. Gated by `report:bv_report:view`.
- `GET /api/reports/bv/export` — same filters + row-scope, never paginated. Gated
  separately by `report:bv_report:export`.
- `POST /api/bv-reports` — create. Status is server-authoritative: a non-approver
  supplying `Approved`/`Rejected` is rejected **403**.
- `PUT/PATCH /api/bv-reports/:id` — edit; finalized (Approved/Rejected) rows are
  locked.
- `POST /api/bv-reports/:id/approve` — approver-only; only a `Submitted` row may
  transition (else **409**).
- `POST /api/bv-reports/:id/reject` — approver-only; requires a non-empty `reason`
  (else **400**); only a `Submitted` row may transition (else **409**).

---

## Metrics / formulas (honest, never hardcoded)

Computed over the **full filtered set** (not the paginated slice):

| Metric | Formula |
|--------|---------|
| `totalTasks` | COUNT of BV report records in scope (semantically "Total Reports"; key name kept for shared `ReportData`/CSV compatibility) |
| `valueOfServiceSold` (alias `valueSold`) | `SUM(value_sold)` |
| `successRate` | `approvedCount / totalCount * 100`, or **`null`** when there are zero rows |
| `followUpsCompleted` | **`null`** — no auditable aggregate source (see decision doc) |
| `missedLeads` | **`null`** — no auditable aggregate source (see decision doc) |

Any non-derivable metric is returned as `null`, named in `missingMetrics`, and
explained in `missingMetricReasons` — never fabricated as `0`/`100`. The Stage 9 test
"metric honesty" asserts `followUpsCompleted`/`missedLeads` are `null` and listed in
`missingMetrics`, that `successRate` (when present) is within `0..100`, and that
metrics are computed over the full set even when `limit`/`page` are supplied.

---

## Filters & export

- `from`/`to` (aliases `startDate`/`endDate`) over `report_date`; `status`
  (whitelisted to `Draft`/`Submitted`/`Approved`/`Rejected`, `all` clears — anything
  else **400**); `company` (ILIKE); `branch` (author's `users.branch`); `userId`
  (row-scope narrowing); `page`/`limit` (list only).
- The legacy `package` / `method` filters are **unsupported** and fail closed with
  **400** (never silently ignored / never an unfiltered all-rows result).
- Export honors the same filters + row-scope, is **never paginated** (exported row
  count == `reportCount` == `pagination.total`), names the file with the date range +
  selected user (`_user-<id8>` / `_user-all`) + status when set, and rejects an
  unsupported `format` with **400**.

---

## Permissions (role-scoped, no export outside scope)

`bv_report` matrix (`server/middleware/report-permission.ts`), plus always-allowed
`admin`/`super_admin`/`super_hod`:

| Action | Roles |
|--------|-------|
| view | account_manager, hod, sales_manager, sales_assistant_manager, sales_executive, dd_manager |
| create / edit | sales_executive, sales_assistant_manager, sales_manager, account_manager |
| export | account_manager, hod, sales_manager |
| approve | account_manager, hod |

Row-scope: executive → self; managerial → department members; global admin →
unscoped (`resolveBvScope`). Export is gated independently of view, so a viewer who
lacks export permission is rejected **403** before any data leaves the server — the
Stage 9 test "export role-scope" asserts a `sales_executive` (view but no export) is
denied. Every create / edit / approve / reject / export is recorded via
`ActivityLogService` (reject also records the reason).

---

## Documented deviations (no fabrication, no UI rewrite)

- **`followUpsCompleted` / `missedLeads` = `null`.** `drm.follow_ups` has **no link
  column to `bv_reports`** (the only relation is indirect via user + date, which would
  change the metric's meaning) and the table is currently **empty** — computing would
  emit a fabricated `0` for everyone, which the spec forbids. Per-report self-reported
  `follow_ups_done` / `missed_leads` stay visible per row. (Full evidence in the
  decision-doc Stage 9 addendum.)
- **BV "Select User" picker is read-only / self.** This is the imported app's
  behaviour. The server still row-scopes authoritatively (`userId` is ignored beyond
  the caller's allowed scope), so this is a UI-affordance limitation, not a
  data-leak. Left as-is per the "run the imported app as-is" preference.
- **On-screen status sub-filter is client-side** and is not forwarded to the list
  query or the export request; at the default `status=all` the export therefore
  matches the on-screen dataset. The server export *does* honour a `status` param if
  one is sent. Documented rather than refactoring the shared report UI component tree.

---

## Tests run

- `npm run check` (tsc): **56 errors total, all pre-existing baseline errors** in
  unrelated files (e.g. `user.name` nullability in other repositories); **0 errors in
  the file added this stage**.
- `npx vitest run server/stage9-bv-report.test.ts`: **20 passed** — auth gate (401);
  non-approver create `Approved`/`Rejected` → 403 and create `Draft`/`Submitted` →
  201; approver create `Approved` → 201; status whitelist → 400; `package`/`method`
  → 400; metric honesty (`followUpsCompleted`/`missedLeads` null + in
  `missingMetrics`, `successRate` within range, full-set vs slice); approve as
  non-approver → 403; approve non-`Submitted` → 409; reject without reason → 400;
  approve & reject happy paths; export non-exporter → 403; CSV 200 + filename;
  export row count == `reportCount`; unsupported export format → 400; canonical
  write/read symmetry.
- Live boot smoke against the running app (`$REPLIT_DEV_DOMAIN`):
  1. `GET /` → 200 (app boots)
  2. `GET /api/reports/bv` (unauth) → 401
  3. `GET /api/reports/bv/export` (unauth) → 401
  4. `POST /api/bv-reports` (unauth) → 401
  5. `PATCH /api/bv-reports/:id` (unauth) → 401
  6. `POST /api/bv-reports/:id/approve` (unauth) → 401
  7. `POST /api/bv-reports/:id/reject` (unauth) → 401
  8. `GET /reports/bv/new` (SPA route) → 200
  9. Authed approver-gate / status-whitelist / transition-409 / null-metrics behaviours
     covered by the vitest suite above (require a signed JWT).
  10. Canonical write/read symmetry covered by the vitest suite above.

---

## Unresolved issues

- None functional. The 56 baseline `tsc` errors are pre-existing and unrelated to
  this stage; out of scope and unchanged.
- Pre-existing note (not introduced here): `.replit` contains a literal
  `JWT_SECRET` default; secrets should live only in Replit-managed env. Flagged for a
  future hardening pass; not touched this stage to avoid altering boot behaviour.
