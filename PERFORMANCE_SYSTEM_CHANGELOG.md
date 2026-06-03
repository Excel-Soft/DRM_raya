# Performance System — Changelog

A real, read-only **Performance System** was added to WebExcels DRM, replacing the
static mock previously rendered at `/drm/performance`. It computes employee
performance from **existing** DRM data across multiple modules. No business
workflows, approval logic, roles, permissions, or DB business structures were
changed — this is purely additive and read-only.

## Scoring formula

```
Final Score = 40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness
```

### Honest missing-data handling
Real systems have gaps, so the score never fabricates data:
- Each component returns a **null score** (status `N/A`) when it has no usable data.
- `finalScore` is only produced when **all four** components are available.
- `normalizedFinalScore` re-weights the score over the **available** component
  weights, so a partially-covered employee still gets a fair, transparent number.
- `formulaCompletenessPercent` reports how much of the 100-point formula was
  actually computable.
- `missingMetrics` lists which components were excluded.
- `dataQuality` is `complete` | `partial` | `none`.

All source adapters are defensive: a missing/empty table contributes nothing
instead of throwing. With the database currently empty, the system honestly
returns `N/A` everywhere and a `No Data` rating rather than fake numbers.

## Components & data sources

| Component | Weight | Source signals |
|---|---|---|
| Work Completion | 40% | Assignable items completed / assigned: PMS tasks, product-posting & software workflows, service complaints, support tickets, sales follow-ups |
| Quality | 30% | Approval rate minus penalties for revisions, returns, rejections, and unresolved complaints (GM approvals, workflow QA/verification & returns, support resolved/failed) |
| Target Achievement | 20% | Approved GM amount (and service achieved value) vs. assigned target from the target system / service activity targets |
| Timeliness | 10% | Completed-on-time ratio for items that have a deadline (tasks, workflows, follow-ups) |

**Context-only records** (shown in records/trends for full visibility but
deliberately NOT counted toward the score, to avoid distortion/double-counting):
sales activities, call sessions, appointments, task time logs, service renewals,
and product-posting/software rework history. Workflow rework is already captured
by each workflow's return count in the Quality penalty, so rework-history rows
are informational only.

**Attendance context** (present/absent/late/half-day/leave + approved overtime)
is shown as **supporting information only** and is **not** part of the score.

Status values are grounded in the actual DB enums, e.g. `task_status.Completed`,
`gm_entry_status.Approved/Completed`, `support_ticket_status.Resolved/Failed`,
`service_complaint_status.resolved/closed`, `attendance_status.*`,
`overtime_status.Approved`, `followup_status.Open/Completed`.

## Backend

### New files
- `server/services/performance.service.ts` — source adapters, normalized record
  model, calculation helpers (`calculateWorkCompletion`, `calculateQuality`,
  `calculateTargetAchievement`, `calculateTimeliness`, `calculateFinalScore`,
  `getPerformanceRating`, `getManagementSuggestions`), and the
  summary/records/trends builders. Uses raw `pool.query` with `::text` casts for
  cross-type id matching; never throws on empty tables.
- `server/performance-routes.ts` — route handlers + backend access control.

### Mount point
`registerPerformanceRoutes(app)` is called in `server/routes.ts` **after**
`app.use("/api", authMiddleware)`, so every endpoint requires authentication.

### Endpoints (all read-only, under `/api/drm/performance`)
- `GET /users` — selectable employees, already scoped to the caller's access.
  Query: `department`, `role`, `search`, `activeOnly`.
- `GET /summary` — full performance summary. Query: `userId` (defaults to self),
  `startDate`, `endDate` (required, `YYYY-MM-DD`), `includeRecords`.
- `GET /records` — paginated normalized records. Query: `userId`, `startDate`,
  `endDate`, `sourceModule`, `status`, `page`, `limit`.
- `GET /trends` — productivity trend buckets. Query: `userId`, `startDate`,
  `endDate`, `interval` (`daily` | `weekly` | `monthly`).

### Access control (enforced server-side, never trusted from the client)
- `admin` / `super_admin` / `super_hod` → all users
- `hod` and manager roles → their own **department** (plus self)
- executive / other roles → self only
- Cross-user access the caller isn't entitled to → **403**.

There is no team-hierarchy column on `drm.users`, and role normalization is
lossy (e.g. `service_assistant_manager` normalizes to a sales role), so HOD and
manager scoping both use the reliable `department` column. This guarantees no
cross-department exposure (a manager's real team is, at worst, a subset of their
department) rather than risking a global role-family match leaking users.

Validation: missing/invalid dates → **400**; unknown user → **404**;
unauthenticated → **401**.

## Frontend

### Rebuilt
- `client/src/pages/drm/performance.tsx` — removed the static `PERFORMANCE_MOCK`
  and rebuilt the page against the live API using `apiRequest` + TanStack Query
  (queries are gated until the user clicks **View**). The `/drm/performance`
  route is unchanged.

### UI sections
- Filter bar (department, employee, start/end date) with **View** / **Reset**.
- Score summary cards (final/normalized score, rating, four components,
  formula completeness & data quality).
- Formula display with a callout listing any missing components.
- Component breakdown table (weight, score, weighted, source data, availability).
- Productivity trend chart (recharts).
- Performance records table.
- Management suggestions.
- Attendance context (clearly labelled as supporting-only).
- Explicit loading, error, empty, and "select an employee" states.

## Verification
- `npm run check`: no new type errors introduced by these files (pre-existing
  unrelated errors in other modules were left untouched).
- Smoke tests (DB currently empty):
  - Unauthenticated `/summary` → `401`.
  - `/summary` without dates → `400`.
  - Authenticated `/users`, `/summary`, `/trends` → `200` with honest `N/A`
    components, `formulaCompletenessPercent: 0`, rating `No Data`.

## Notes
- Strictly additive and read-only; no schema, workflow, or permission changes.
- Pre-existing unrelated issues (e.g. `/api/tasks`, `drm.menu_permissions`) were
  intentionally not modified.
