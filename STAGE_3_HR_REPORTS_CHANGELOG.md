# Stage 3 — HR, Attendance, Salary & Reports (Batch A)

Goal: convert mock/static HR / attendance / salary / report screens into real,
API-backed screens or honest empty states. No UI redesign, no mock fallback in
production, no fabricated rows. Stage 1/2 work left untouched; no tables dropped.

## Files changed

### Backend (added earlier in this stage)
- `shared/schema.ts` — added three tables (`salaryRuns`, `salaryRunItems`,
  `attendanceEditRequests`) with insert/select types. Nothing dropped.
- `server/salary-routes.ts` — salary preview + salary-run persistence endpoints.
- `server/attendance-edit-routes.ts` — attendance edit-request workflow +
  honest-empty raw-attendance endpoint.
- `server/stage3-reports-routes.ts` — daily-added-GM, department, event and
  reception report endpoints. (Event report selects
  `customers.company_name` — corrected from a non-existent `name` column.)
- `server/routes.ts` — registers the three route modules above.

### Shared / robustness (this batch)
- `client/src/lib/queryClient.ts` — added `apiRequestJson()` helper that throws on
  a non-2xx response before parsing JSON. `apiRequest()` intentionally does not
  throw, so query/mutation functions that called `res.json()` directly could mask
  server errors as "no data" empty states and fire false "success" toasts on
  403/409/500. All converted pages now use `apiRequestJson` so React Query's
  `isError` / mutation `onError` fire honestly.

### Frontend (this batch)
- `client/src/pages/daily-added-gm-report.tsx` — wired to `/api/reports/daily-added-gm`.
- `client/src/pages/reports-department.tsx` — wired to `/api/reports/department`;
  the selected Status filter is now passed to the API (previously ignored).
- `client/src/pages/reports-event.tsx` — wired to `/api/reports/event`.
- `client/src/pages/reports-reception.tsx` — wired to `/api/reports/reception`
  (honest empty state — no reception payment source connected).
- `client/src/pages/reports-raw-attendance.tsx` — wired to `/api/attendance/raw`
  (honest empty state — no biometric source connected). Mock records removed.
- `client/src/pages/salary-create.tsx` — real period picker + live
  `/api/salary/preview` table; "Create Salary Run" persists via
  `POST /api/salary/runs`. Mock data and the fake "saved successfully" edit
  dialog removed; replaced with a read-only computed-line detail dialog.
- `client/src/pages/salary-report.tsx` — lists saved runs via
  `/api/salary/runs` and shows a selected run's real line items via
  `/api/salary/runs/:id`. Mock rows and fabricated bonus values removed; Print
  Slip disabled until a run with items is selected.
- `client/src/pages/reports-edit-att.tsx` — converted to the attendance
  edit-request workflow: lists `/api/attendance/edits`, with managerial
  approve / reject (`PATCH .../approve`, `.../reject`). Mock salary rows and the
  fake "saved successfully" dialog removed.
- `client/src/pages/attendance-todo.tsx` — Task H polish: status action buttons
  (Mark Received / Mark Done via `PATCH /api/attendance/todo/:id/status`),
  remove-participant chips, inline submit validation (task + date), and removal
  of raw error leakage (generic user-facing messages).

## APIs added (consumed this batch)
- `GET /api/salary/preview?month&year[&branch&department&userId]`
- `POST /api/salary/runs`
- `GET /api/salary/runs`
- `GET /api/salary/runs/:id`
- `PATCH /api/salary/runs/:id/status`
- `GET /api/attendance/edits`
- `POST /api/attendance/edits`
- `PATCH /api/attendance/edits/:id/approve`
- `PATCH /api/attendance/edits/:id/reject`
- `GET /api/attendance/raw` (honest empty)
- `GET /api/reports/daily-added-gm`
- `GET /api/reports/department`
- `GET /api/reports/event`
- `GET /api/reports/reception` (honest empty)

## DB changes
- Added tables (no drops, no business-structure changes):
  - `drm.salary_runs`
  - `drm.salary_run_items`
  - `drm.attendance_edit_requests`
- No changes to existing columns; `users.basic_salary` (existing) is read for
  salary computation.

## Mock screens converted
1. `daily-added-gm-report.tsx` → real API
2. `reports-department.tsx` → real API
3. `reports-event.tsx` → real API
4. `reports-reception.tsx` → honest empty state
5. `reports-raw-attendance.tsx` → honest empty state
6. `salary-create.tsx` → real API (preview + run creation)
7. `salary-report.tsx` → real API (saved runs + items)
8. `reports-edit-att.tsx` → real API (attendance edit-request workflow)
Plus `attendance-todo.tsx` polish (Task H).

## Remaining mock screens
- None in this batch's scope. Salary line bonus components (VAS / 5% / Alibaba /
  project / PPP bonuses, loans, penalties) are not computed by the system, so
  they are intentionally omitted rather than fabricated. If those become real
  data sources later, the salary preview/run columns can be extended.

## Tests run
- `npm run check` — 64 type errors total, identical to the pre-stage baseline
  (all in pre-existing files unrelated to this batch; no new errors introduced
  by the converted pages or new routes).
- `npm run build` — succeeds (~29s; client + server bundles emitted).
- Dev smoke: all new/affected endpoints return `401` when unauthenticated
  (auth + routing confirmed); route modules confirmed registered in
  `server/routes.ts`; the three new tables and `users.basic_salary` confirmed
  present in the `drm` schema.

## Unresolved / notes
- The pre-existing `attendance-todo.tsx` ErrorBoundary `FallbackComponent`
  typing warning is part of the 64-error baseline and was left as-is (out of
  scope; not introduced here).
- Authenticated end-to-end clicks were not exercised because the dev admin
  password is not stored in the environment; verification was done via
  unauthenticated route checks, SQL schema checks, type-check and build.
