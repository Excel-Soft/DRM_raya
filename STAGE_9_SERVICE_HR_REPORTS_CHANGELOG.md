# Stage 9 — Service, HR, Reports, Mock-screen Cleanup, Exports

This stage was additive and surgical. Most Stage 9 backend already existed
(complaints, followups, dropouts, renewals, documents, salary runs with
duplicate-period guard + lock, attendance edit-requests, leave/overtime/loan
lifecycles, to-do status/attachments/participants). No engines were rebuilt, no
fake rows were introduced, and no destructive database changes were made.

## A. Service validation gaps (`server/service-core-routes.ts`)
- `POST /api/service/.../followups/:id/complete` now requires `outcome` (400 if missing).
- `POST /api/service/.../dropouts` now requires `reason`.
- Dropout recover now requires `recoveryNote`.
- `POST /api/service/.../renewals` now requires `serviceCustomerId`, a package/service,
  a due date, and `amount > 0`.
- Complaint close now requires an existing-or-provided resolution remark (404 if the
  complaint does not exist).
- `POST /api/service/gm`, `/api/service/vas`, `/api/service/bv` bridges now return
  `501 Not Implemented` instead of a fake success. They previously returned
  `{ success: true }` without creating any record. No frontend code calls them.

Frontend callers for the tightened endpoints (followups/complete, dropouts
create/recover, renewals create) were verified to either already send the now-required
fields or to have no callers; no caller patches were required.

## F. To-do participant removal (`server/todo-routes.ts`)
- Added `PATCH /api/attendance/todo/:id/participants/remove`.
  - Body: `{ userId: string }`.
  - Permission: only the task creator or an admin may remove a participant
    (consistent with the existing status-update permission model).
  - Implemented with `array_remove` on `drm.todo_tasks.participants`.
  - Audited via `ActivityLogService.log` with action `TODO_PARTICIPANT_REMOVED`.

## H. Mock-screen cleanup (routed pages only)
- `client/src/pages/service-pool-dashboard.tsx` (`/service/pool`) — removed the 10-row
  mock array; now reads `GET /api/sales/service-pool/list` with loading, error, and
  empty states. Search and total count are wired to the API.
- `client/src/pages/reports-bv-pending-rc.tsx` (`/reports/bv-pending-rc`) — removed
  the fabricated rows; renders an honest empty state ("not yet connected to a live
  data source"). Filters and the table shell are retained for when a source is added.
- `client/src/pages/drm/pms-setting.tsx` (`/drm/pms-setting`) — removed the fabricated
  activity rows; renders an honest empty state and guards exports to report "no data".
- `client/src/pages/service-private-pool.tsx` — replaced the alert-only Copy/Excel
  stubs in `FollowupListView` with real export handlers using `lib/export-utils.ts`
  (Copy / CSV / PDF). Exports operate on the component's real (currently empty) row
  set; no mock array. Toast feedback replaces `alert()`.
- Documented non-routed scaffolds with a `DEPRECATED / NOT ROUTED` header:
  - `client/src/pages/service-commission-verifications.tsx`
  - `client/src/components/performance-graph.tsx`
  These are intentionally left untouched (not reachable in the app).

## G / I. Documentation
- `REPORT_CATALOG.md` — catalog of service / HR / reports screens with route, module,
  data source, filters, export, roles, and data status (Live / Empty state / Not routed).
- `STAGE_9_SERVICE_HR_REPORTS_CHANGELOG.md` — this file.

## Database changes
- None. No schema migrations, no destructive operations. The participant-removal
  endpoint operates on the existing `drm.todo_tasks` table via runtime SQL.

## Verification
- `npx tsc --noEmit`: 57 errors (matches the pre-existing baseline; no new type
  regressions). The one error in a touched file (`service-private-pool.tsx`
  `setDuplicateModalOpen`) is pre-existing and unrelated to this stage's edits.
- `npm test`: see run output.
- App boots via the `Start application` workflow.
