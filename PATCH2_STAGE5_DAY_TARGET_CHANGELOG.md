# Patch 2 — Stage 5: Daily Target Report

Replaces the `GET /api/reports/day-target` 501 stub with a real, honest
implementation, adds a gated `/export` endpoint, and rebuilds the
`reports-day-target.tsx` page to full spec. No mock data, no fabricated metrics.

## Summary

| Area | Before | After |
| --- | --- | --- |
| `GET /api/reports/day-target` | 501 "Not implemented" stub | Real per-employee report with row-scope + date validation |
| `GET /api/reports/day-target/export` | did not exist | CSV/JSON export, gated by `day_target` `export` permission, audited |
| `client/src/pages/reports-day-target.tsx` | placeholder | Full table, summary cards, missing-data note, validation, pagination, export |

## Files changed

- **`server/services/performance.service.ts`** — exported the existing
  `gmApprovedClause()` so the report reuses the one canonical "approved GM"
  predicate instead of inventing its own.
- **`server/services/day-target.service.ts`** (new) — `getDayTargetReport()`,
  `buildDayTargetCsv()`, and the `DayTargetReport` / `DayTargetQuery` types.
- **`server/reports-routes.ts`** — replaced the stub with the real `view` route,
  added the `/export` route, and added `parseDayTargetParams()` +
  `resolveDayTargetScope()`. Both routes are registered before the
  `/reports/:type` catch-alls so they always win routing.
- **`client/src/pages/reports-day-target.tsx`** — rebuilt against the real API.

## Metric definitions (canonical, no fabrication)

- **Assigned target** = `Σ coalesce(nullif(total,0), nullif(price,0), 0)` over the
  employee's `target_system_user_targets` rows whose `[start_date, end_date]`
  **overlap** the requested window. This is identical to
  `performance.service.getTargetAchievementData`, so the two never disagree. An
  employee with no target in range gets `assignedTarget = null` (not `0`) and is
  named in `missingData`.
- **Achieved / GM amount** = approved GM `amount_usd` from `drm.gm_entries` via the
  canonical `gmApprovedClause()`, attributed to the employee when they are the
  `sales_person_id` **or** the `created_by`. One definition is used for both the
  per-row values and the summary totals.
- **Pending** = `max(0, assigned - achieved)`; `null` when there is no assigned
  target.
- **Achievement %** = `assigned > 0 ? achieved / assigned * 100 : null`.
- **Activities / Calls / Follow-ups / Meetings** = real counts from
  `drm.activities`, `drm.call_sessions`, and `drm.follow_ups` over the window
  (meetings = activities whose `type ilike '%meet%'`).

## Design decisions

- **Rows are per employee, not per target.** Achieved GM is a per-user quantity;
  splitting it across an employee's multiple targets would fabricate per-target
  achievement. Multiple targets are aggregated into the `targetName` / `targetType`
  label columns instead.
- **Summary and `missingData` are computed over the full in-scope set**, not just
  the current page, so totals and the "no assigned target" count stay stable across
  pagination and never understate when results span multiple pages.
- **Export ignores pagination** (fetches the full filtered, scoped result set) so a
  CSV reflects every in-scope row, while honoring the same scope and filters.

## Scope & permissions

- `view` and `export` are independently gated by `requireReportPermission("day_target", …)`.
- Row-scope (`resolveDayTargetScope`) mirrors the other report scopes with two
  fixes the architect flagged:
  1. `account_manager` has `allowedIds === null` (global) in
     `getDepartmentFilterUserIds`, so a `userId` filter returns `[userId]` rather
     than the empty sentinel.
  2. `hr` / `hr_manager` are granted `view` in the matrix but are not managerial,
     so they get all-users here, making the grant meaningful.
- `ourTeam` only ever narrows (it is always bounded by `allowed`), never widens.
- Executives are scoped to themselves; an out-of-scope `userId` resolves to a
  sentinel id that yields an empty result rather than leaking data.

## Validation

- `startDate`/`endDate` (aliases `from`/`to`) are **required**; missing, unparseable,
  or `start > end` returns `400 VALIDATION_ERROR` with a human message. The
  frontend reuses the `reportApi` validation helpers for inline errors before
  calling the API.

## Known limitations (documented, not silently guessed)

- `target_system_user_targets.user_id` is matched **uuid-only**. The assign-by-role
  path can store a name there; such rows are not counted. This is consistent with
  the rest of the app's performance queries.
- `target_system_daily_targets` (role/method daily quotas) is **not** used in v1.
- `service_activities` is **not** used as an achievement source, to keep a single
  achievement definition across rows and summary.

## Verification

- `npm run check`: 56 total tsc errors, all pre-existing baseline; **0 new errors**
  in any changed file.
- 9 smoke tests (against the running app, real minted JWTs per role), all passing:
  1. Missing dates → `400`.
  2. `start > end` → `400`.
  3. Valid range (admin) → `200` with the full `{filters, rows, summary, pagination, missingData}` shape.
  4. Honest empty metrics on empty target tables: `totalAssigned/Achieved = 0`,
     `averageAchievementPercent = null`, `assignedTarget = null`, every employee in
     `missingData`.
  5. View permission gate: `sales_executive` → `403`.
  6. Export (admin) → `200 text/csv` with the expected header.
  7. Export gate: `sales_manager` has `view` (`200`) but not `export` (`403`).
  8. `userId` filter narrows to exactly one employee.
  9. Pagination (`limit=2`) returns the correct page sizes, `total`, and `totalPages`.

The database currently has 4 users and 3 customers with all target/activity tables
empty, so the live report correctly returns honest empty/`missingData` results; the
SQL is written to produce real values once data exists.
