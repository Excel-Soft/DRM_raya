# Patch 3 — Stage 2: Validation / Audit / Notification / Report-Safety Foundations

Stage 2 establishes the shared foundations Patch 3 needs **before** the per-module
invoice / workflow / reports / salary / penalty / BV fixes in later stages. It is
deliberately a *foundations* patch: it does **not** rewrite modules, does **not**
re-wire every endpoint, adds **no** fake data, and runs **no** destructive DB
commands. Stage 1 (auth/RBAC) is complete and merged.

Most of these foundations were already delivered by earlier patches; this stage
**verified** them and **filled the genuine gaps**. The new code in this stage is
small and surgical (see "Files changed").

---

## Files changed in this stage

| File | Change |
| --- | --- |
| `server/validators/report.validators.ts` | **New.** Report query/filter/export Zod validators composing `common.validators` (date range, pagination, required filters, export format). Mirrors the frontend `reportApi.ts` rules so both sides reject the same bad input. |
| `shared/schema.ts` | Added 4 additive columns to the `notifications` table: `module`, `entity_type`, `entity_id`, `priority` (default `normal`). |
| `server/db/ensure.ts` | Added `ensureNotificationsSchema(client)` (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) and call it inside `ensureDbOnce()` so the columns exist before routes serve. |
| `server/services/notification-service.ts` | `createNotification` now **persists** `module`/`entity_type`/`entity_id`/`priority` (previously accepted but silently dropped on insert). |
| `server/middleware/report-permission.ts` | Added the two missing report keys `project_report` and `link_report` to `ReportKey` and the permission matrix (conservative managerial+HOD roles, mirroring the routes' existing inline gating). |
| `PATCH3_STAGE2_FOUNDATION_CHANGELOG.md`, `VALIDATION_AUDIT_NOTIFICATION_REPORT_GUIDE.md` | **New** documentation (task F). |

No destructive DB commands. No secrets added/moved/exposed. No UI redesign.

---

## A. ValidationService & validators
- **Already present, verified:** `server/services/validation.service.ts` and the
  domain validators (`common`, `invoice`, `workflow`, `approval`, `financial`,
  `hr`, `service`, `communication`) — all Zod-based.
- `common.validators.ts` covers the required primitives: uuid/id, date, date
  range, pagination, money amount, currency, percentage, URL, phone/email,
  approval decision, rejection reason, status enum, file metadata, remarks/reason.
- **New this stage:** `report.validators.ts` (the one missing file) — report key /
  action enums, generic `reportFilters` (range + branch/department/user/status +
  pagination), `reportExportRequest` (export uses the active filters), and
  `reportDecisionRequest` (mutating actions require a `reason`).

## B. Standard API error envelope
- **Already present, verified — no code change.** `server/utils/api-error.ts`
  exports `sendApiError(res, { status, code, message, details? })` returning
  exactly `{ success: false, error: { code, message, details } }`, plus
  `badRequest` / `unauthorized` / `forbidden` / `notFound` / `conflict` /
  `internal`, `errorEnvelope`, `zodIssues`, `sendError`, `sendSafeError`.
- It is designed not to leak stack traces, SQL, or secrets (unknown server errors
  collapse to a generic `INTERNAL_ERROR` message). Already used in the auth, todo,
  reports, and HR approval (leave) routes.

## C. AuditLogService
- **Already present, verified — intentional design retained.**
  `server/services/audit-log.service.ts` exposes `recordAuditLog({ actorUserId,
  action, module, entityType, entityId, previousStatus, nextStatus, before,
  after, reason, req })` and an `AuditLogService` class (`record`,
  `recordTransition`, `getHistory`).
- **Decision (deliberate, not a gap):** it **reuses the existing
  `drm.activity_logs` table** rather than adding a separate `drm.audit_logs`
  table. The spec allows reuse ("if an audit table exists, reuse it"), and the
  read side (`server/audit-log-routes.ts`) and `getHistory` are already wired to
  `activity_logs`. Adding a parallel table now would **fragment** the audit trail
  (existing writers → `activity_logs`, new → `audit_logs`) or force re-wiring all
  readers — both violate the "foundations only / no module rewrites" constraint.
  - **Field mapping:** `actorUserId → user_id`, `action → action`,
    `entityType → resource_type`, `entityId → resource_id`. The richer fields
    (`module`, `previousStatus`, `nextStatus`, `before`, `after`, `reason`, plus
    request `ip`/`userAgent`) are **serialized into the `details` JSON column** —
    they are captured and queryable via JSON, but are **not** first-class indexed
    columns. A dedicated `audit_logs` table remains a possible later migration
    *only if* paired with read unification + backfill.
- **Priority audit actions already wired** via `recordAuditLog` callers: user
  CRUD/status, salary, penalty (create/void), attendance edits, lead-bulk and
  CRM-duplicate operations, and workflow transitions. Remaining priority actions
  (login/logout, password reset, role switch, invoice, GM/BV, PMS, report export)
  are wired incrementally as their modules are touched in later stages.
- **Security:** never pass secrets (password hashes, tokens) in `before`/`after`;
  the service does not introspect or redact payloads.

## D. NotificationService
- **Already present, improved this stage.**
  `server/services/notification-service.ts` exports `createNotification`,
  `createNotificationsForUsers`, `resolveUsersByRole`,
  `resolveUsersByDepartmentRole`, and `notifyWorkflowTransition`.
- **Role-as-user-id bug class is guarded:** the Stage-2 methods validate every id
  against a UUID regex and **reject** non-UUID values instead of broadcasting —
  a role string can never be persisted as a `user_id`. Roles are resolved to
  **active** user ids via `resolveUsersByRole` / `resolveUsersByDepartmentRole`
  before any notification row is created.
- **Gap fixed:** `createNotification` accepted `module` / `entityType` /
  `entityId` / `priority` but the SQL insert dropped them. Added the 4 columns
  (additive, idempotent runtime migration) and the insert now persists them, so
  `actionUrl` (`target_url`), `module`, `entityType`, `entityId`, and `priority`
  are all stored. No email/SMS/WhatsApp provider was added (none configured).

## E. Report safety
- **Frontend (already present, reused):** `client/src/components/report/` contains
  `ReportLoadingState`, `ReportEmptyState`, `ReportErrorState`, `ReportToolbar`,
  and `client/src/lib/reportApi.ts` (build query params, date-range validation,
  required-filter validation, safe filename, `downloadReportExport`). The export
  path **throws on failure** — no mock fallback, no fake rows, no fake success
  toast. (Spec said "create or reuse"; the existing components are reused.)
- **Backend (improved this stage):** `requireReportPermission(reportKey, action)`
  in `server/middleware/report-permission.ts` is a thin, fail-closed composition
  over `requireActionPermission` (shared normalization + sanitized envelope).
  Added the 2 missing report keys so the matrix now covers all 12 spec keys:
  `raw_attendance`, `salary_create`, `salary_report`, `event_report`,
  `reception_report`, `edit_attendance`, `day_target`, `diagnosis_report`,
  `bv_report`, `penalty_report`, **`project_report`**, **`link_report`**; actions:
  `view`, `create`, `edit`, `export`, `approve`, `finalize`, `delete`.

## F. Documentation
- This changelog + `VALIDATION_AUDIT_NOTIFICATION_REPORT_GUIDE.md` (developer
  usage guide for the foundations).

---

## DB changes
- **Additive, non-destructive, idempotent only.** `drm.notifications` gains
  `module text`, `entity_type text`, `entity_id text`, `priority text NOT NULL
  DEFAULT 'normal'` via `ensureNotificationsSchema` in `server/db/ensure.ts`
  (runs in `ensureDbOnce()` at boot; `db:push` is broken repo-wide so runtime
  `ALTER ... IF NOT EXISTS` is the established pattern). No table drops, no column
  drops, no data deletion. No new `audit_logs` table (see C).

## Tests run
- `npm run check` (tsc) — pre-existing baseline errors only; **zero in files
  changed this stage**.
- `npm test` (vitest) — full suite passing (includes `report-permission.test.ts`,
  which exercises the matrix/normalization and now the 2 new keys compile in).
- `npm run dev` — boots cleanly; `ensureNotificationsSchema` applies the columns
  on startup.

## Smoke tests
1. Date-range validator rejects `from > to` (and accepts valid ranges).
2. API error envelope returns `{ success:false, error:{ code,message } }` with no
   stack/SQL.
3. Audit service writes an entry (to `activity_logs`) without throwing.
4. Notification service resolves a role to actual active user ids (never a role
   string) and persists `module`/`entity`/`priority`.
5. Report UI surfaces loading/empty/error states; export throws on API failure
   (no mock fallback).

## Unresolved / pending (later stages)
- Dedicated `drm.audit_logs` table (only if a read-unification + backfill is done).
- Per-module integration of validators / audit / notifications / report guards
  into invoice, workflow, salary, penalty, BV, and report endpoints (Stage 3+).
- `report_validators` and `requireReportPermission` are not yet wired into every
  report route (foundation only; integration is later-stage work).
- Pre-existing legacy `notify()`/`notifyRole()` writes a local
  `notification_debug_log.txt` — untouched (out of scope; consider removing in a
  cleanup pass).
