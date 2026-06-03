# Penalty Management Module — Changelog

D&D Manager Penalty Management, real and database-backed. Replaces the static
mock (`MOCK_PENALTIES`) on `/drm/add-penalty`. Additive only — no existing DRM
workflow, role, permission, API, or business table was modified.

## Files changed
**Database / schema**
- `migrations/20260603_add_penalties_table.sql` — new (CREATE TABLE + 6 indexes, idempotent).
- `shared/schema.ts` — added `penalties` Drizzle table definition + `Penalty` / `InsertPenalty` types (typing only; applied to the live DB via the migration, not `db:push`).

**Backend**
- `server/services/penalty.service.ts` — new. All DB access + integration helpers.
- `server/penalty-routes.ts` — new. REST endpoints + backend-enforced access control.
- `server/routes.ts` — mounts `registerPenaltyRoutes(app)` AFTER auth + `checkAllowedIp` + `checkUrlPermission`.

**Frontend**
- `client/src/pages/drm/add-penalty.tsx` — rebuilt against the real API; `MOCK_PENALTIES` removed.
- `client/src/components/app-sidebar.tsx` — added "Add Penalty" menu item (permKey "Add Penalty") + role allow-list.

**Docs**
- `PENALTY_MODULE_CHANGELOG.md` — this file.

## Database changes
New table `drm.penalties`:
- `id` (uuid PK), `employee_id` (uuid → drm.users), `department` (text),
  `penalty_head` (text), `reason` (text), `amount` (numeric 12,2),
  `penalty_date` (date), `created_by` (uuid → drm.users),
  `approval_status` (text, default PENDING), `attachment_url`, `attachment_name`,
  `manager_remarks`, `hod_remarks`, `approved_by`/`approved_at`,
  `rejected_by`/`rejected_at`, `employee_acknowledged_at`,
  `created_at`, `updated_at`, `deleted_at` (soft delete).
- Indexes: employee, created_by, penalty_date, approval_status, department, deleted_at.

## APIs added (all under `/api/penalties`, auth required)
- `GET  /api/penalties` — paginated/filtered list (search, status, employeeId, department, date range, `mine`), scoped to caller; returns data + pagination + summary.
- `GET  /api/penalties/:id` — single penalty (scoped).
- `GET  /api/penalties/users` — active employees grouped by role (for the dropdown).
- `GET  /api/penalties/meta` — penalty heads, statuses, and caller capabilities.
- `POST /api/penalties` — create.
- `PATCH /api/penalties/:id` — edit.
- `PATCH /api/penalties/:id/approval` — approve / reject (HOD/admin only).
- `PATCH /api/penalties/:id/acknowledge` — employee acknowledges own penalty.
- `DELETE /api/penalties/:id` — soft delete.
- `GET  /api/penalties/reports/monthly` — monthly report (totals, by department / employee / penalty head, records).

## Role permissions implemented (backend-enforced, never trusted from client)
- **admin / super_admin / super_hod** — view all; create; edit; soft-delete; approve/reject; reports.
- **hod** — view own department (+ self); create; approve/reject; reports (scoped to department).
- **dd_manager / managerial roles** — create; view department; edit & soft-delete their OWN pending penalties only.
- **hr / hr_manager** — view records + reports; no create/approve/delete.
- **employee / executive / other** — view ONLY their own penalties; acknowledge own; no create/edit/delete/approve.
- Cross-scope access returns 403. Approved penalties cannot be edited/deleted except by full-access roles.

## Workflow implemented
Create (PENDING by default) → optional employee acknowledgement → HOD/admin
approve or reject (with HOD remarks) → reporting. Approve/reject is only allowed
from the PENDING state (re-deciding an already-decided penalty returns 409).
Acknowledgement is strictly the penalized employee's own action — no one
(including admins) may acknowledge on their behalf. Soft delete keeps history and
hides records from all listings/reports.

## Validation rules
Backend: employeeId required + must exist; penaltyHead required (non-empty on
create AND edit); reason required (non-empty on create AND edit); amount required
and >= 0; penaltyDate required + valid; approvalStatus ∈ {PENDING, APPROVED,
REJECTED, CANCELLED}; non-deciders cannot set non-PENDING on create; deleted
records excluded from default lists; permission enforced per action. Report
scoping: full-access and HR see all; HOD is strictly limited to their own
department, and if they have no department they only see their own records (a
caller-supplied `department` can never widen a HOD's view).
Frontend: required-field toasts; submit disabled while saving; invalid amount/date
blocked; success/error toasts; no mock records.

## Notification status
**Connected (lightweight).** Uses the existing `NotificationService` + `drm.notifications`:
- Employee notified when a penalty is created for them.
- Creator notified when HOD/admin approves or rejects.
No email notifications (out of scope). Failures are non-fatal (won't block the action).

## Increment / Performance integration status
**Ready for future integration.** Reusable service functions exported from
`server/services/penalty.service.ts`:
- `getPenaltySummaryForEmployee(employeeId, startDate?, endDate?)` → approved penalty count + total amount.
- `getPenaltyRecordsForEmployee(employeeId, startDate?, endDate?)` → penalty records.
These are not yet wired into the Increment or Performance UIs; they are clean
adapters ready to be consumed when those modules add a discipline/accountability section.

## Test commands run
- `npm run check` (tsc) — 64 pre-existing/unrelated errors remain (baseline unchanged); **zero** errors from this feature.
- `npm run dev` — app runs on port 5000.
- API smoke test (as admin): meta, list, users, create, edit (pending), acknowledge,
  approve, get-by-id, monthly report, negative-amount validation (400), soft delete — all pass.

## Known limitations
- Attachments are URL/name text fields only — no file-upload infrastructure exists in the project, per spec.
- Notifications are in-app only (no email).
- Increment/Performance integration is via ready service functions, not yet surfaced in those UIs.
- The optional `/dd-manager/penalties` route alias was not added; the existing `/drm/add-penalty` route is preserved as required.

## Unresolved errors
None introduced by this feature. (The 64 baseline `tsc` errors are pre-existing and unrelated.)
