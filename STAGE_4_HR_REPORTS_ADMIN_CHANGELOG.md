# Stage 4 — HR, Attendance, Salary, Reports, Admin Allowed IP

This stage connected the remaining HR / attendance / salary / report / admin
screens to real backends and removed the last mock/static engine. Most of the
Stage 4 backend and DB layer already existed from prior stages; this changelog
records both the **new work** and the **verified-existing** surfaces.

## Summary of genuine changes

### G — Admin "DRM Allowed IPs" page (was a pure mock engine)
- **Before:** `client/src/pages/allowed-ip-list.tsx` rendered a hardcoded
  `initialData` array and mutated local React state only (`setData`). It never
  called the backend, and showed fabricated columns (`browser`, `location`,
  `ipUser`, `createdBy`) that have **no** backing in the `allowed_ips` table.
- **After:** the page is fully wired to the existing real API
  `/api/settings/allowed-ips` (list / create / edit / delete / active toggle)
  via TanStack Query + `apiRequest`, with cache invalidation. Columns now map to
  the real schema only: `ip_cidr`, `description`, `is_active`, `createdAt`.
  Backend errors (validation / duplicate) are surfaced to the user via toasts.
- **Backend hardening** (`server/settings-routes.ts`):
  - IP/CIDR format validation (IPv4, IPv4 CIDR, basic IPv6) → `400` on invalid.
  - Duplicate prevention on create and on edit (excluding self) → `409`.
  - Audit logging via `ActivityLogService` on create / update / delete
    (`resourceType: "allowed_ip"`).
  - `updatedAt` is refreshed on update.

### A — Attendance "To Do List"
- **Backend** (`server/todo-routes.ts`):
  - Added `REOPENED` to the allowed status set; it maps to the `pending` summary
    bucket.
  - `GET /api/attendance/todo` now supports server-side filters
    (`status`, `participant`, `category`, `priority`, `from`, `to`) and
    pagination (`limit` ≤ 200 default 100, `offset`). Non-admins remain scoped to
    tasks they created or participate in. DB errors stay sanitized via
    `errorEnvelope` (no raw PG message/detail/code leaked).
- **Frontend** (`client/src/pages/attendance-todo.tsx`):
  - Status actions expanded to the full state machine: **Mark Received**,
    **Mark Pending**, **Mark Done**, and **Reopen** (shown when finished).
  - Added a filter bar (status / category / priority / participant / date range)
    that drives the backend list query.
  - Kept duplicate-participant prevention (Set-based) and removable participant
    badges. Fixed a pre-existing `ErrorFallback` type error in this file.

## Verified existing (no faked data; left intact, documented only)

- **C — Edit attendance workflow:** `attendance_edit_requests` table +
  `GET/POST /api/attendance/edits` + `PATCH .../:id/approve|reject` (managerial
  only, status-guarded, reviewer + timestamp recorded). No silent edits — every
  change is a reviewed, audited request. Frontend `reports-edit-att.tsx` uses the
  real API.
- **B — Raw (biometric) attendance:** `GET /api/attendance/raw` honestly returns
  `{ records: [], available: false, message }` because no biometric device or
  import is integrated. `reports-raw-attendance.tsx` renders that honest empty
  state rather than fabricated logs. (Filters beyond branch are deferred until a
  real data source exists — adding filters over an always-empty source would be
  misleading.)
- **D — Salary:** `salary_runs` + `salary_run_items` tables, `salary-routes.ts`
  (preview / runs / status). No payroll formula was invented; the existing
  preview/run logic is reused. `salary-create` and `salary-report` pages are
  wired to the real endpoints.
- **E — Reports (department / event / reception):** `stage3-reports-routes.ts`
  serves real aggregates; the report pages consume them.
- **F — Daily Added GM report:** `/api/reports/daily-added-gm` returns real rows;
  no mock or impossible-date data.

## Known limitations
- To-Do attachments capture the filename client-side only; there is no file
  storage backend, so attachments are not persisted (metadata-only, documented).
- Raw biometric attendance has no connected source; the screen shows an honest
  empty state until a device/import integration is added.

## Files changed
- `server/settings-routes.ts` — allowed-IP validation, duplicate prevention,
  audit logging, IP/CIDR validator helper.
- `server/todo-routes.ts` — `REOPENED` status, list filters + pagination.
- `client/src/pages/allowed-ip-list.tsx` — rewritten from mock to real API.
- `client/src/pages/attendance-todo.tsx` — status actions, filter bar, type fix.

## APIs added / modified
- `POST /api/settings/allowed-ips` — now validates IP/CIDR, rejects duplicates
  (409), writes an audit log.
- `PATCH /api/settings/allowed-ips/:id` — same validation/dedup; audit log;
  refreshes `updatedAt`.
- `DELETE /api/settings/allowed-ips/:id` — audit log.
- `GET /api/attendance/todo` — new query params: `status`, `participant`,
  `category`, `priority`, `from`, `to`, `limit`, `offset`.
- `PATCH /api/attendance/todo/:id/status` — now accepts `REOPENED`.

## DB changes
- None. All required tables (`allowed_ips`, `todo_tasks`,
  `attendance_edit_requests`, `salary_runs`, `salary_run_items`, `activity_logs`)
  already existed in `shared/schema.ts`.

## Pages converted to real data
- `client/src/pages/allowed-ip-list.tsx` (mock → real CRUD).
- `client/src/pages/attendance-todo.tsx` (added real server-side filtering +
  full status state machine).

## Tests run
- `npm test` (vitest): 2 files, 14 tests passing.
- `npx tsc --noEmit`: 0 errors in changed files; total project errors 57
  (down from 58 baseline — one pre-existing error fixed). Remaining errors are
  all in pre-existing unrelated files (`reports-routes.ts`, `repositories/*`).
- Boot smoke: app serves on port 5000; `/api/settings/allowed-ips` correctly
  returns 401 without a token (auth enforced).

## Unresolved / deferred
- No runtime authenticated CRUD test was executed: the dev admin password is not
  stored in the repo and `MOCK_AUTH` was intentionally not enabled. Logic was
  verified by static review + type check + boot smoke.
- To-Do attachment persistence and raw biometric ingestion remain out of scope
  until storage / a device integration is provided.
