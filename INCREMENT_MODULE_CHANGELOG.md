# Increment Management Module — Changelog

A real, database-backed **Increment Management** module replacing the previous
static mock at `/drm/increment`. The work is **additive only** — no existing
business workflows, roles, permissions, APIs, or DB business structures were
changed.

## Summary

The module evaluates each employee's increment eligibility over a chosen date
range using attendance/work-minutes, leave, task completion, notices, salary, and
prior increment history. Managers can record a decision (Approve / Hold / Reject)
with a proposed increment. Where source columns or records do not yet exist in the
live database, the module reports **honest "Missing"/"N/A"** rather than fabricating
numbers.

## Files added

- `migrations/20260603_increment_management.sql`
  Creates `drm.increment_evaluations` (`CREATE TABLE IF NOT EXISTS`) plus four
  indexes. Executed directly against the live DB (the project does **not** run
  `db:push` because `shared/schema.ts` is intentionally out of sync with the live
  schema).
- `server/services/increment.service.ts`
  All business logic: runtime user-column detection (via `information_schema`,
  cached), and adapters for salary, leave deduction, attendance/work-minutes, task
  stats, notices, and increment history. Builds report rows, report summary,
  per-employee detail, recommendation, and `missingData` flags. Never throws on an
  empty database.
- `server/increment-routes.ts`
  REST endpoints (see below), mounted **after** the auth + URL-permission
  middleware so the API is never public. Access control mirrors
  `server/performance-routes.ts`.

## Files modified

- `shared/schema.ts` — added the `incrementEvaluations` Drizzle table definition
  and exported `IncrementEvaluation` / `InsertIncrementEvaluation` types
  (appended at end; nothing existing changed).
- `server/routes.ts` — imported and called `registerIncrementRoutes(app)`
  immediately after `registerPerformanceRoutes(app)`.
- `client/src/pages/drm/increment.tsx` — fully rebuilt as a real,
  API-driven page (mock data removed).
- `client/src/components/app-sidebar.tsx` — added an **Increment** menu entry
  (`/drm/increment`, `permKey: "Increment"`) and its role mapping in
  `DEPT_NAME_TO_ROLES` (managerial roles only; executives excluded).

## Database — `drm.increment_evaluations`

Stores saved evaluation snapshots and managerial decisions. Key columns:
`employee_id`, `calculated_by`, `review_start_date`, `review_end_date`,
computed metrics snapshot, `eligibility_status`, `recommended_status`,
`proposed_increment_type` / `proposed_increment_value`, `status`
(`PENDING` / `APPROVED` / `HOLD` / `REJECTED`), `reviewed_by`, `effective_date`,
`remarks`, and timestamps. Indexed on `employee_id`, `status`, the review-date
range, and `created_at`.

## API endpoints (all under `/api/drm/increment`, authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users` | Visible users grouped by role (for the dropdown) |
| GET | `/report` | Evaluation report for one user or all visible users |
| GET | `/report/:employeeId/detail` | Full per-employee breakdown |
| POST | `/evaluations` | Save a calculated evaluation snapshot (managerial) |
| PATCH | `/evaluations/:id/decision` | Approve / Hold / Reject (managerial) |
| GET | `/evaluations/history/:employeeId` | Prior saved evaluations/decisions |

### Access control (enforced server-side)

- `admin` / `super_admin` / `super_hod` → all users
- `hod` / manager roles → their department (plus self)
- `executive` / other roles → self only (view only, cannot decide)
- Cross-user access → `403`; decisions require a managerial role.
- Standard `400` (bad/missing dates), `401` (unauthenticated), `404` (unknown
  user/evaluation). Non-admin date ranges are capped at 24 months.

## Configuration (env, with defaults)

| Variable | Default | Meaning |
| --- | --- | --- |
| `INCREMENT_ALLOWED_LEAVES_PER_MONTH` | `2` | Allowed leaves per month |
| `INCREMENT_MIN_COMPLETION_RATE` | `0.75` | Minimum task completion for eligibility |
| `INCREMENT_MAX_NOTICE_COUNT` | `0` | Max notices before penalty |
| `INCREMENT_SALARY_DAYS_PER_MONTH` | `30` | Days/month for per-day salary |

## Honest missing-data behaviour

The live `drm.users` table currently has **no** `basic_salary`, `join_date`,
`relaxation_minutes`, `increment`, or `attendance_id` columns, and all business
tables except `users` are empty. The service detects the available columns at
runtime and returns `missingData` flags + "Missing"/"N/A" markers in both the
report and the detail view; eligibility is reported as **"Missing Data"** and
decisions are blocked when salary data is absent. No values are fabricated.

## Verification performed

- `npx tsc --noEmit`: no new type errors introduced by this module (the 64
  remaining errors are **pre-existing** and unrelated to the increment feature).
- Workflow restarted via HMR; smoke-tested against the live dev server:
  - `401` when unauthenticated; `400` on missing dates; `404` on unknown user.
  - `/users`, `/report`, `/report/:id/detail`, `/evaluations/history/:id` return
    correct honest-empty payloads.
  - `POST /evaluations` → `PATCH /evaluations/:id/decision` (HOLD) round-trip
    succeeded; the test row was removed afterward (table back to 0 rows).
