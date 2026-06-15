# Patch 3 — Stage 8: Operational Reports

Scope: make the four operational reports — **Daily Target**, **Diagnosis**,
**Event**, and **Reception** — real, DB-backed workflows that read only persisted
data (real rows or an honest empty set), with role-scoped CSV export. No mock,
demo, BV, or synthetic data is introduced anywhere.

Recon found Daily Target (A), Diagnosis (B), and Reception (D) already real and
passing the hard rules; the genuine fix was the **Event** report (C), which was
reading the wrong table, plus a small real-source enrichment for Reception (D).

---

## Files changed

- `server/events-routes.ts`
  - Extracted the events-report logic into two exported handlers,
    `eventsReportHandler` and `eventsReportExportHandler`, so the same code serves
    both `/api/events/report` and the Stage 8 `/api/reports/event`.
  - Enriched the report SELECT with per-event `speaker_count`, `duty_count`
    (real child-table counts) and `created_by_name` (join to `drm.users`).
  - Added `buildEventReportFilters` (shared by list + export) and
    `mapEventReportRow` (additive spec row).
  - Added an idempotent `ensureEventsTablesOnce` guard so the shared handler is
    safe when reached via the stage3 alias before `registerEventsRoutes` runs.
- `server/stage3-reports-routes.ts`
  - Replaced the legacy **meetings-based** `/api/reports/event` handler (wrong
    source) with the shared `eventsReportHandler`, and added
    `/api/reports/event/export` → `eventsReportExportHandler`. Registered before
    the `/reports/:type` catch-all so the path resolves to the real events handler.
  - Reception list + export SELECT now also return
    `m.created_by AS receptionist_id, ru.name AS receptionist_name` (the
    `drm.users ru` join was already present) and a "Receptionist" CSV column.
- `client/src/pages/reports-event.tsx`
  - Repointed the query to `GET /api/reports/event`; switched CSV export from
    client-side generation to the server endpoint
    `GET /api/reports/event/export` (honors the same filters and the export
    permission). Added columns **Start**, **End**, **Duties**, **Created By**;
    kept loading / empty / error / totals states.
- `client/src/pages/reports-reception.tsx`
  - Added a **Receptionist** column populated from `receptionist_name`.

No changes were made to Daily Target or Diagnosis source files (already correct).

---

## APIs added / changed

- **Added** `GET /api/reports/event` — Stage 8 canonical events report. Reads the
  real `drm.events` store via the shared handler. Replaces the previous
  meetings-based feed. Gated by `event_report:view`.
- **Added** `GET /api/reports/event/export` — CSV export of the events report,
  same filters/source, capped at 5000 rows. Gated by `event_report:export`.
- **Added** `GET /api/events/report/export` — same export handler exposed under the
  existing events-report path for symmetry. Gated by `event_report:export`.
- **Unchanged** `GET /api/events/report` — still served by the same shared handler
  (backward compatible response shape).
- **Unchanged** `GET /api/reports/reception` and `GET /api/reports/reception/export`
  — same endpoints; response/CSV now additionally include the receptionist.
- **Unchanged** `GET /api/reports/day-target` (+ export) and
  `GET /api/reports/diagnose` (+ POST/PATCH) — already real, no change.

---

## DB changes

None. No schema migrations, no new tables, no new columns. All new fields are
derived at query time from existing tables/columns:
`drm.events`, `drm.event_speakers`, `drm.event_duties`, `drm.users`,
`drm.meetings`.

---

## Data sources used (real, per report)

- **Daily Target** — `GET /api/reports/day-target`: real attendance/target data,
  role-scoped, validated. (No change this stage.)
- **Diagnosis** — `GET /api/reports/diagnose`: `drm.diagnosis_reports` (title
  "Diagnosis View"). Calls `/api/reports/diagnose`, **not** any `bv` endpoint.
  (No change this stage.)
- **Event** — `GET /api/reports/event`: `drm.events` joined to
  `drm.event_speakers` (speakers + count), `drm.event_duties` (duty count), and
  `drm.users` (creator name). **Not** `drm.meetings`.
- **Reception** — `GET /api/reports/reception`: `drm.meetings` joined to
  `drm.customers` (company) and `drm.users` (receptionist). No synthetic rows.

---

## Formulas / derived values

- Event report totals: `attendance = SUM(events.attendee_count)`,
  `cost = SUM(events.amount)` over the filtered set.
- `speakerCount = COUNT(event_speakers WHERE event_id = e.id)`.
- `dutyCount = COUNT(event_duties WHERE event_id = e.id)`.
- `createdByName = users.name WHERE users.id = events.created_by`.
- Reception `receptionistName = users.name WHERE users.id = meetings.created_by`.
- No averages/derived ratios are fabricated where no source column exists.

---

## Filters & export

- **Event filters**: `eventId`, `dateFrom`/`dateTo` (aliases `startDate`/`endDate`)
  over `event_date`, `type` (`event_type`), `eventName` (ILIKE), `status`
  (whitelisted; unknown → 400, no silent all-rows fallback), `venue` (ILIKE),
  `speaker` (ILIKE via `event_speakers`), `page`, `pageSize`/`limit`.
- **Event export** honors the exact same filters as the list (no pagination, 5000
  cap) and is gated separately by the export permission.
- **Reception** filters unchanged; export now includes the Receptionist column.

---

## Permissions

- Event view: `event_report:view`; Event export: `event_report:export`.
- Reception view/export gates unchanged.
- Export endpoints are gated independently of view, so a viewer who lacks export
  permission is rejected (403) before any data leaves the server — no export
  outside role scope.

---

## Business assumptions / documented deviations (no fabrication)

- **Event**: `drm.events` has no assigned-user / team / branch columns, so the
  spec fields `assignedUserName` and `team` are surfaced as `null` rather than
  fabricated, and there is no assignedUser/team/branch filter.
- **Reception**: `visitorCount`, `paymentAmount`, and `notes` have no source
  column on `drm.meetings`, so they are omitted rather than invented (consistent
  with prior reception decisions). Receptionist is derived from the real
  `created_by` → `users` join.
- **Daily Target**: `missingData[]` is reported at the top level (not per-row);
  `target_system_targets` / `daily_targets` are unused in v1; no branch/team
  filter (no team column). Documented; unchanged.

---

## Tests run

- `npm run check` (tsc): 56 errors total, all pre-existing baseline errors in
  unrelated files; **0 errors in the files changed this stage**.
- `npx vitest run server/stage8-event-reception.test.ts`: **21 passed** — covers
  the auth gate (401), the report-permission gate (403), the events report against
  the real `drm.events` (rows, eventName ILIKE filter, status whitelist 400,
  valid-status filter), reception scope + month/branch/receptionistId filters, and
  the reception CSV export honoring filters + scope.
- Boot smoke (running app, unauthenticated → expect 401):
  - `GET /api/reports/day-target` → 401
  - `GET /api/reports/diagnose` → 401
  - `GET /api/reports/event` → 401
  - `GET /api/reports/reception` → 401
  - `GET /api/reports/event/export` → 401
  - `GET /api/reports/reception/export` → 401
  - `GET /api/events/report` → 401
  - Correct-source: events report reads `drm.events` (vitest "events report (real
    drm.events)" block), **not** `drm.meetings`.
  - Role-gated export: 403 without `*:export` permission (vitest
    "report-permission gate (403)" block).

---

## Unresolved issues

- None functional. The 56 baseline `tsc` errors are pre-existing and unrelated to
  this stage (e.g. `user.name` nullability mismatches in other modules); they are
  out of scope and unchanged.
