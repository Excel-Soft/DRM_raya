# Patch 2 — Stage 8: Event & Reception Reports

Gap-closing / hardening pass making `/reports/event` and `/reports/reception`
fully real-backed with permissions, row-scoping, honest filter validation,
pagination, and filter-aware CSV export. Both pages already read real backends
from a prior stage; this stage closes the gaps identified in architect rulings
D1–D6.

**Principles honored:** no fake/synthetic rows (real persisted data only),
additive/minimal changes, no response-shape renames, Replit Postgres, secrets in
env, existing backups untouched.

---

## D-ruling → change map

| Ruling | Gap | Resolution |
| --- | --- | --- |
| D1 | Reception list not row-scoped by role | `resolveReceptionScope` (global → all, executive → own, manager → dept) applied to `created_by`/`user_id` |
| D2 | `userId` filter could widen beyond a user's scope | `userId` only narrows **within** the resolved scope; outside scope → empty sentinel |
| D3 | No reception export | Added `GET /api/reports/reception/export` (CSV) sharing the exact list filters + scope |
| D4 | Event report not permission-guarded | Guarded with `requireReportPermission("event_report","view")` |
| D5 | Invalid status silently dropped (dishonest "all rows") | Unknown status now → **400** on both event and reception reports |
| D6 | No automated coverage | Added `server/stage8-event-reception.test.ts` (13 DB-backed tests) |

---

## Files changed

### `server/middleware/report-permission.ts`
- Added `reception_executive` to `reception_report.view`. The role now resolves to
  a viewer, and row-scoping (below) limits it to its own rows.
  - `reception_report.view` = `[reception_manager, reception, reception_executive, account_manager, hod]` (+ always-allowed `admin`/`super_hod`).
  - `reception_report.export` unchanged = `[reception_manager, account_manager]` (+ `admin`/`super_hod`) — executives can view but not export.

### `server/events-routes.ts` — `GET /api/events/report`
- Guarded with `requireReportPermission("event_report","view")`.
- Invalid `status` now returns **400** (previously silently ignored → misleading all-rows result).
- Added `eventName` ILIKE filter.
- Clamped `pageSize` to ≤ 200 (`Math.min(200, …)`).

### `server/stage3-reports-routes.ts` — reception report
- `GET /api/reports/reception` guarded with `requireReportPermission("reception_report","view")`.
- `resolveReceptionScope(req)`: global roles → all rows; reception/reception_executive → own (`[self]`); other managerial roles → department user ids (via `getDepartmentFilterUserIds`); `userId` query param narrows **within** scope only.
- `buildReceptionFilters(req, scope)` shared by list + export:
  - date range (`startDate`/`endDate` on `meeting_date`),
  - status whitelist `expected | in_progress | ended` (**400** on invalid, `::text` compare against the enum),
  - `company` ILIKE, `customer` ILIKE,
  - scope applied as `(created_by = ANY($uuid[]) OR user_id = ANY($uuid[]))`.
- Added `GET /api/reports/reception/export` guarded with `("reception_report","export")` — streams CSV using the identical filters + scope, `LIMIT 5000`.
- A malformed `userId` query value now returns **400** (`receptionUserIdError` UUID check) on both the list and export, instead of reaching `ANY($n::uuid[])` and surfacing as a raw `22P02` → 500 (consistent with the D5 honest-input principle).
- Guarded the legacy/unused meetings-based `GET /api/reports/event` with view permission for consistency.

### `client/src/pages/reports-reception.tsx`
- `STATUS_OPTIONS` corrected to the real enum values: `expected | in_progress | ended` (were `scheduled/completed/cancelled`, which never matched any row).
- Added a **Company** filter input.
- Added an **Export CSV** button: authenticated `apiRequest` → blob download; disabled until filters are applied / while exporting; toast on success and on 403 / failure.
- `buildReceptionParams()` shared by the list query and the export so the export always honors the on-screen filters.

### `server/stage8-event-reception.test.ts` (new)
- DB-backed integration tests through `registerRoutes()` against real `drm.events` / `drm.meetings`; seeds + cleans up its own users/rows; soft-skips if the pool is unreachable.

---

## APIs touched

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/events/report` | `event_report:view` | + `eventName` filter, status→400, pageSize≤200 |
| GET | `/api/reports/reception` | `reception_report:view` | scoped + date/status/company/customer filters, status→400 |
| GET | `/api/reports/reception/export` | `reception_report:export` | **new** — CSV, same filters + scope, LIMIT 5000 |
| GET | `/api/reports/event` (legacy) | `event_report:view` | guarded for consistency (unused by UI) |

## Data sources (real, persisted — no synthetic rows)
- `drm.events` (event report).
- `drm.meetings` (reception report; `meeting_status` enum = `expected/in_progress/ended`).
- `drm.users` (department scope resolution via `getDepartmentFilterUserIds`).

## Filters
- **Event:** `eventName` (ILIKE), `status` (whitelist, 400 on invalid), date range, pagination (pageSize ≤ 200).
- **Reception:** date range (`meeting_date`), `status` (whitelist, 400 on invalid), `company` (ILIKE), `customer` (ILIKE), `userId` (narrows within scope), pagination. Export honors all of these.

---

## Tests

`server/stage8-event-reception.test.ts` — **14 tests, all passing**:
- Auth gate: 401 (no token) on all three endpoints.
- Permission gate: 403 for a role without view (`sales_executive`) on event + reception; 403 for reception export by a `reception_executive` (view-only).
- Event report: returns real persisted rows; `eventName` ILIKE returns only matches; unknown status → 400; valid status returns only those rows.
- Reception scope/filters: admin sees all; unknown status → 400; status filter excludes non-matching rows; a `reception_executive` sees only their own rows; a `userId` outside their scope yields an empty result; a malformed `userId` → 400.
- Reception export: admin CSV honors the status filter (includes own marker, excludes the other).

### Verification
- `npx vitest run` — **118 tests passing (8 files)**, no regressions.
- `npx tsc --noEmit` — **56 errors, all pre-existing baseline; 0 new**, none in touched files.
- Dev server (`Start application`) running; browser console clean.

## Unresolved / notes
- The repo carries a stable pre-existing `tsc` baseline (~56–57 errors) in unrelated files; this stage adds none.
- `npm run db:push` is broken repo-wide on an unrelated pre-existing FK mismatch; **no schema changes were needed** for this stage, so it was not exercised.
- The legacy `GET /api/reports/event` (meetings-based) remains unused by the UI; it was only permission-guarded, not otherwise changed.
