# Patch 2 — Stage 3: Attendance Reports (Raw Attendance + Edit Attendance)

Scope: gap-fill the already-DB-backed attendance feature to the Stage 3 spec
without rebuilding it. No mocks, no fake-success, no destructive SQL. The
existing `/api/attendance/edits` contract is preserved (the frontend depends on
it); spec-parity `/api/attendance/edit-requests` aliases were added alongside it.

## Files changed

- `shared/schema.ts` — added `salary_locked` and `override_reason` columns to the
  `attendanceEditRequests` table definition (mirrors the DB).
- `server/db/ensure.ts` — new idempotent `ensureAttendanceEditSchema()`
  (`ADD COLUMN IF NOT EXISTS salary_locked boolean default false`,
  `override_reason text`), wired into the boot-time `ensureDbOnce` path
  (`db:push` is broken repo-wide, so schema is applied via idempotent ALTER).
- `server/repositories/attendance.repository.ts` — added a public
  `recomputeLateFlags(checkIn, checkOut)` wrapper so the approve/correction flow
  recomputes `is_late` / `late_checkin` / `late_checkout` using the **same**
  timezone + cutoff policy as live check-in/out.
- `server/attendance-edit-routes.ts` — rewritten engine: approve now actually
  applies the change to `drm.attendance` inside a transaction, audits it, and
  enforces the salary lock; reject/create are audited; added the
  `/edit-requests` aliases and an admin-only direct-correction route.
- `server/stage3-reports-routes.ts` — added the real, attendance-sourced
  raw-attendance report (paginated list + CSV export) and shared filter/mapper
  helpers.
- `client/src/pages/reports-raw-attendance.tsx` — replaced the placeholder
  ZKT-biometric tab view with a real filterable, server-paginated report bound to
  the new endpoint, with loading / empty / error+retry states and CSV export.
- `client/src/pages/reports-edit-att.tsx` — title now "Edit Attendance"; added a
  "New Request" correction modal (reason required, before/after, field-aware
  input) and salary-lock (423) handling with an admin override prompt on approve.

## APIs added / changed

Added:
- `GET  /api/reports/raw-attendance` — permission `raw_attendance/view`.
  Required `startDate`, `endDate` (`start <= end`, else 400). Optional filters:
  `branch`, `department`, `userId`, `attendanceStatus`. Paging: `page >= 1`,
  `limit ∈ {10,25,50,100}` (default 25). Returns
  `{ rows, total, page, limit, source: "attendance" }`.
- `GET  /api/reports/raw-attendance/export` — permission `raw_attendance/export`.
  Same filters; streams a CSV (cap 5000 rows) honoring the active filters.
- `PATCH /api/attendance/:id/correction` — admin-only direct correction of an
  attendance row (no separate approval step). Body: `field`, `value`, `reason`,
  optional `overrideReason`. Records a self-approved audit request row, applies
  the change, respects the salary lock.
- Aliases (identical behavior to the `/edits` routes):
  `GET/POST /api/attendance/edit-requests`,
  `PATCH /api/attendance/edit-requests/:id/approve`,
  `PATCH /api/attendance/edit-requests/:id/reject`.

Changed:
- `PATCH /api/attendance/edits/:id/approve` now: validates the `status` enum
  app-side before writing; locates the attendance row (by linked `attendance_id`,
  else by `user_id` + `date::date`, 409 if zero or ambiguous); applies the field
  with coercion; recomputes late flags on check-in/out edits; sets the request
  `Approved`; **never creates** an attendance row; audits after commit. If the
  employee's month is salary-locked it returns **423** unless an admin supplies
  `overrideReason`.
- Approve/Reject authorization moved to report-permission
  `edit_attendance/approve` (was managerial-role check). **Behavior change:** see
  "Unresolved / notes" below.
- `GET /api/attendance/raw` (legacy biometric route) now returns an explicit
  `{ records: [], available: false, message }` instead of any fabricated data —
  no biometric source is connected. The real report lives at
  `/api/reports/raw-attendance`.

## DB changes

- `drm.attendance_edit_requests.salary_locked boolean DEFAULT false`
- `drm.attendance_edit_requests.override_reason text`

Applied idempotently at boot via `ensureAttendanceEditSchema()` (ALTER ... ADD
COLUMN IF NOT EXISTS). Verified present on the live DB. No data migration, no
drops, no destructive statements.

## Key correctness fix found during verification

`drm.attendance.user_id` is `varchar` while `drm.users.id` is `uuid`. The
raw-attendance report joins them, so the join is cast `u.id::text = a.user_id`
(uuid→text, the safe direction) — without the cast the query 500s with
`operator does not exist: uuid = character varying`. The edit-routes joins use
`uuid = uuid` and need no cast. The `attendanceStatus` filter compares
`a.status::text = $n` so an unknown status value yields an empty result instead
of a raw `22P02` enum error.

## How to test

1. Start the app (`npm run dev`, port 5000) and log in.
2. Raw report: open `/reports/raw-attendance`. Pick a start/end date and click
   **View**. Confirm: rows load (or an honest "no records" message),
   `total`/pagination work, `limit` switch (10/25/50/100) repaginates, branch /
   department / employee / status filters narrow results, and **Export CSV**
   downloads a file matching the current filters. Missing/invalid date range →
   400 (toast).
3. Edit attendance: open `/reports/edit-att`. Click **New Request**, pick an
   employee + date + field + new value, type a reason, submit. Refresh — the
   request persists with status Pending.
4. As a permitted approver, **Approve** a pending request whose target
   attendance row exists → the underlying `drm.attendance` row is updated, late
   flags recomputed on time edits, and the request flips to Approved. Approving
   when no matching attendance row exists → 409 (toast), no row is fabricated.
5. Salary lock: approve a request for a month that is on a FINALIZED/APPROVED/
   LOCKED salary run → 423 with a lock warning; as an admin you are prompted for
   an override reason, after which the change applies and the override is recorded.

## Unresolved / notes (intentional, to avoid scope creep)

- **Approve/Reject permission tightening:** moving to
  `edit_attendance/approve` changes who can approve relative to the previous
  managerial-role check (e.g. roles with the managerial flag but **without** the
  `edit_attendance` approve permission lose approve access, and vice-versa).
  This aligns the action with the report-permission system per spec; adjust the
  permission matrix if a specific role needs to regain access.
- **No HOD department-scoping** was added to approvals (out of scope for this
  stage).
- **`working_hours` is not recomputed on check-in/out edits.** Approving a
  `check_in`/`check_out` edit recomputes the late flags but leaves
  `working_hours` untouched, so a previously stored `working_hours` can disagree
  with the new timestamps. The raw report prefers `working_hours` over the
  check-in/out delta, so it will reflect the stale value until `working_hours`
  is itself edited. Left as-is to avoid silently changing payroll-relevant hours.
- **Report metrics without a source column** — `lateMinutes`,
  `earlyOutMinutes`, `overtimeMinutes`, `leaveType`, `penaltyAmount` — are
  returned as `null` rather than fabricated. `workingMinutes` is derived from
  `working_hours` (or the check-in/out delta when hours are absent).
- **No biometric/raw device integration** exists, so `GET /api/attendance/raw`
  is intentionally empty-but-honest; the attendance-sourced report is the real
  one.
- `db:push` remains broken repo-wide (pre-existing FK type mismatch); schema is
  maintained via the idempotent ensure path.
- `tsc --noEmit` stays at the pre-existing baseline of 57 errors (no new
  errors); `npm test` is green (60/60).
