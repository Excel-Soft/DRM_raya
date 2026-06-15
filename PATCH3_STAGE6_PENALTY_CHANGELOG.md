# Patch 3 — Stage 6: Penalty / Plenty Engine

## Summary
"Plenty" is treated as "Penalty" (no separate module exists, per Patch 3).

A **real, database-backed Penalty Management engine already existed** in this
codebase (originally delivered as *Patch 2 Stage 2 — Penalty*: the `drm.penalties`
table, `server/services/penalty.service.ts`, `server/penalty-routes.ts` mounted
behind auth + URL-permission, and both front-end screens wired to the live API
with **no mock data**). Per the Stage 6 rule "do NOT create two separate penalty
engines", Stage 6 **reconciled and extended that single engine** rather than
rebuilding it. No `MOCK_PENALTIES`, fake submit, or UI-only success paths were
found or introduced; success is shown only after the API confirms a DB write.

## Files changed
- `server/services/penalty.service.ts` — `ListFilters` + `listPenalties()` gained
  `penaltyHead`, `branch` (resolved via the employee's `users.branch`), and
  lifecycle `status` (ACTIVE/VOIDED) filters.
- `server/penalty-routes.ts` — `GET /api/penalties` now parses the full spec query
  set: `penaltyHead`, `branch`, direct `createdBy`, canonical `approvalStatus`,
  and lifecycle `status` (with backward-compatible handling of the legacy
  `?status=<approval value>`).
- `client/src/pages/drm/add-penalty.tsx` — approval filter now sent as the
  canonical `approvalStatus` param (was `status`).
- `PATCH3_STAGE6_PENALTY_CHANGELOG.md` — this document.

## Files verified already-complete (no change needed)
- `shared/schema.ts` — `drm.penalties` table with all required columns
  (employee_id, department, penalty_head, reason, amount, penalty_date,
  created_by, approval_status, status, attachment_url/name, manager/hod_remarks,
  approved/rejected/voided_by/at, void_reason, timestamps, deleted_at) + indexes.
- `client/src/pages/drm/add-penalty.tsx` — full CRUD UI (add/edit modal, employee
  selector, department auto-fill, head/amount/date/reason/remarks, attachment
  URL/name, search, page-size, pagination, view/edit/void/delete/approve actions,
  validation, loading states, query invalidation), all on the live API.
- `client/src/pages/service-add-penalty.tsx` — Add-Penalty form + table on the
  same `/api/penalties` API (no mock data); Service Manager records come from the
  backend's department scoping.
- `client/src/pages/service-manager-dashboard.tsx` — renders `ServiceAddPenalty`
  under the "Add Penalty" view.
- `client/src/components/app-sidebar.tsx`, `client/src/routes/route-registry.ts`,
  `client/src/App.tsx` — `/drm/add-penalty` route + sidebar entry + role gating.

## APIs (base `/api/penalties`, mounted AFTER auth + URL-permission middleware)
- `GET    /api/penalties` — paginated, scoped list + summary. Query params:
  `page, limit, search, employeeId, penaltyHead, branch, department, createdBy,
  approvalStatus, status, startDate, endDate, mine`.
- `GET    /api/penalties/users` — active employees grouped by role (scoped).
- `GET    /api/penalties/meta` — penalty heads, status vocab, caller capabilities.
- `GET    /api/penalties/reports/monthly` — monthly report (full-access/HOD/HR).
- `GET    /api/penalties/:id` — single penalty (scoped).
- `POST   /api/penalties` — create.
- `PATCH  /api/penalties/:id` — edit.
- `PATCH  /api/penalties/:id/approval` — approve / reject (HOD + full-access).
- `PATCH  /api/penalties/:id/void` — audited void (reason required).
- `PATCH  /api/penalties/:id/acknowledge` — employee acknowledges own penalty.
- `DELETE /api/penalties/:id` — soft delete (creator-PENDING or full-access).

## DB changes
- No schema change in Stage 6. `drm.penalties` (table + indexes) already exists
  and matches the spec. (`db:push` is broken repo-wide on an unrelated pre-existing
  FK mismatch; the table was created by its migration, not push.)
- Statuses — lifecycle: `ACTIVE`, `VOIDED` (`DELETED` = soft-deleted via
  `deleted_at`); approval: `PENDING`, `APPROVED`, `REJECTED` (plus legacy
  `CANCELLED` in the vocab).

## Permissions implemented (enforced server-side, never trusted from client)
- `admin / super_admin / super_hod` — view/create/edit/approve/reject/void/delete all; reports.
- `hod` — department-scoped view/approve/reject/void/create; reports.
- `service_manager / dd_manager / dnd_manager / product_posting_manager / software_manager`
  (managerial roles) — create for their department scope; view their scope;
  edit/soft-delete their **own PENDING** penalties.
- `hr / hr_manager` — view all + reports; no create/approve/delete.
- `employee / executive` — view only their own; acknowledge own; no create/approve/delete.
- Cross-scope access returns 403; all endpoints return 401 unauthenticated.

## UI changes
- Approval filter on `/drm/add-penalty` now uses the canonical `approvalStatus`
  query param. No other visible UI change (engine already complete).

## Audit behavior
- Recorded to `drm.activity_logs` (module `penalty`) via `recordAuditLog`:
  `penalty.create`, `penalty.update`, `penalty.approve`, `penalty.reject`,
  `penalty.void`, `penalty.delete`.

## Tests run
- `npm run check` (tsc --noEmit) — see "Known limitations" re: pre-existing baseline.
- `npm test` — penalty route-wiring + constants tests pass (and full suite).
- `npm run dev` — app boots; penalty endpoints return 401 unauthenticated.

## Known limitations
- `penalty.export` audit action and a dedicated export endpoint are **not**
  implemented in this stage (no export endpoint is in the required endpoint list
  and no export UI exists); report data is available via
  `GET /api/penalties/reports/monthly`.
- Lifecycle `status` filtering supports `ACTIVE`/`VOIDED`; `DELETED` rows are
  soft-deleted (`deleted_at`) and are intentionally excluded from all listings.
- The repo carries a stable set of pre-existing `tsc` errors in unrelated files
  (baseline); none are in the files touched by this stage.
