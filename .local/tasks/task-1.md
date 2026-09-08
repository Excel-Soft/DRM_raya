---
title: Real Performance System
---
# Real Performance System

## What & Why
The DRM "Performance" screen (`/drm/performance`) is currently static mock data.
Replace it with a real, read-only Performance System: a manager picks an employee
and date range, and the app pulls that person's real activity from existing
modules, calculates a performance score with the required weighted formula, and
shows records, a trend, a rating, and management suggestions. This is purely
additive reporting — it reads existing data and changes no business workflow.

The weighted formula (exact):
Final Score = 40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness,
with honest handling of missing data (normalized score over only the available
components, plus a `missingMetrics` list and `formulaCompletenessPercent`).

## Done looks like
- `/drm/performance` is no longer mock; a manager selects department/employee +
  start/end date, clicks View, and sees real data.
- Score summary cards: Final Score, Rating, the four components, Formula
  Completeness, Data Quality.
- A visible formula breakdown and a component table (Component, Weight, Score,
  Weighted Score, Source Data, Status).
- A performance records table (date, source module, activity, client, value,
  status, on-time, quality, revisions, remarks).
- A simple productivity trend and a management-suggestions section.
- A separate attendance/overtime context section that does NOT affect the score.
- Honest empty/missing states ("No performance records found…"), never fake
  numbers.
- Backend access control: executives see only themselves; managers/HODs see their
  team/department; admin/super_admin/super_hod see everyone; unauthorized cross-
  user access returns 403.
- `PERFORMANCE_SYSTEM_CHANGELOG.md` documents files, APIs, formula, connected
  modules, and missing-data limitations.

## Out of scope
- No changes to product-posting/software workflow logic, GM/BV approval, invoice
  approval, roles/permissions structure, or unrelated dashboards.
- Attendance/overtime stays a context panel only — never folded into the score.
- No heavy new chart dependency; reuse the chart library already installed.
- Snapshot persistence (`POST /snapshot` + table) is OPTIONAL and only added if it
  needs no risky schema change; otherwise deferred and noted in the changelog.

## Steps
1. **Backend module + secure mount** — Add `server/performance-routes.ts` and
   `server/services/performance.service.ts`, mounted under `/api/drm/performance`
   after the existing global `/api` auth middleware, reusing existing role/team
   helpers for access control.
2. **Source adapters (schema-grounded, read-only)** — Per-module adapters that
   each take (userId, startDate, endDate), query only tables that actually exist,
   never throw on empty data, and return normalized records + aggregate counts:
   sales (gm_entries, activities, follow_ups, call_sessions, appointments),
   PMS (tasks via task_status_history for completion/timeliness, task_time_logs),
   product-posting & software workflows (return_count, rework_history for
   revisions, QA/verification timestamps for quality+timeliness), service
   (service_activities, service_complaints, service_renewals, service_dropouts),
   support (support_tickets), targets (target_system_user_targets + approved
   gm_entries / snapshots), and attendance/overtime as separate context.
3. **Score engine** — Pure helpers for work completion, quality, target
   achievement, timeliness, final/normalized score, rating thresholds, and
   management suggestions, with the missing-data rules (N/A components, normalized
   weight, `formulaCompletenessPercent`, `dataQuality`).
4. **Endpoints** — Implement `GET /users`, `GET /summary`, `GET /records`,
   `GET /trends` with the documented query params, response shapes, and
   validation (startDate ≤ endDate, user exists, authorized → 400/403/404).
5. **Frontend rebuild** — Replace the mock in the performance page (keep the
   `/drm/performance` route) with filter section, score cards, formula + component
   table, records table, trend, suggestions, attendance context, and proper
   loading/empty/error states, using the app's existing TanStack Query +
   `apiRequest` patterns.
6. **Verify + document** — Run `npm run check` and a manual smoke test (admin
   login, pick employee + range, confirm real request, records vs empty state,
   403 for cross-user as executive), fixing only type errors introduced by this
   feature, then write `PERFORMANCE_SYSTEM_CHANGELOG.md`.

Architectural constraints: additive and read-only; reuse `apiRequest`/auth-token
handling and the existing `getDepartmentFilterUserIds` / `isManagerialRole` /
`requireRole` helpers; build adapters against the Drizzle schema in
`shared/schema.ts` (it matches the live DB) rather than raw guessed column names,
because this app already has route-vs-DB column drift.

## Relevant files
- `client/src/pages/drm/performance.tsx`
- `client/src/App.tsx`
- `client/src/components/app-sidebar.tsx`
- `client/src/lib/queryClient.ts`
- `client/src/pages/attendance-report.tsx`
- `server/routes.ts`
- `server/dashboard-routes.ts`
- `server/drm-routes.ts`
- `server/sales-routes.ts`
- `server/utils/role-utils.ts`
- `shared/schema.ts`