# Stage 2 — Foundation Services Changelog

Stage 2 adds three foundational backend service layers to WebExcels DRM —
**validation**, **audit logging**, and **notifications** — without rewriting
existing modules, changing business workflows, or altering the database schema.
Everything is additive and backward-compatible: existing callers keep working
unchanged.

## Guiding constraints (honored)
- No destructive DB operations; **no new tables**; no breaking schema changes.
- No rewrite of all modules/endpoints — only foundational services plus a few
  representative integrations.
- No fake/placeholder data; failures are explicit.
- Stage 1 auth/RBAC left intact.
- Reuses existing infrastructure wherever it already exists.

## Files added
- `server/validators/common.validators.ts` — reusable Zod primitives.
- `server/validators/invoice.validators.ts`
- `server/validators/approval.validators.ts`
- `server/validators/workflow.validators.ts`
- `server/validators/financial.validators.ts`
- `server/validators/service.validators.ts`
- `server/validators/hr.validators.ts`
- `server/services/validation.service.ts` — `ValidationService` (parse/safeParse/body/query/params).
- `server/services/audit-log.service.ts` — `AuditLogService` (record/recordTransition/getHistory).

## Files extended (backward-compatible)
- `server/utils/api-error.ts` — added `sendApiError(res, { status, code, message, details })`,
  an object-form wrapper over the existing `errorEnvelope`. All existing helpers
  (`sendError`, `sendSafeError`, factories) unchanged.
- `server/services/activity-service.ts` — `recordAuditLog` now also accepts
  `previousStatus` / `nextStatus`, serialized into the existing `details` JSON of
  `drm.activity_logs`. No signature break — new fields are optional.
- `server/services/notification-service.ts` — added explicit Stage 2 API:
  `createNotification`, `createNotificationsForUsers`, `resolveUsersByRole`,
  `resolveUsersByDepartmentRole`, `notifyWorkflowTransition`. Legacy `notify` /
  `notifyRole` left intact.

## Representative integrations (no mass rewrite)
- `server/todo-routes.ts` — `POST /api/attendance/todo` now validates via
  `ValidationService.parse`; catch handles `ApiError` → standard envelope.
- `server/leave-routes.ts` (HR approval surface) — `POST /api/leave` now validates
  via `ValidationService.parse` and emits the standard envelope through
  `sendApiError` / `sendError` (replacing ad-hoc `{ error }` shapes).

## Database changes
**None.** Stage 2 deliberately reuses existing tables:
- Audit trail → `drm.activity_logs` (via `recordAuditLog`). Richer fields
  (`module`, `previousStatus`, `nextStatus`, `before`, `after`, `reason`,
  request `ip`/`userAgent`) are stored in the existing `details` JSON column.
- Notifications → `drm.notifications`.

Rationale: both tables already model the required data; adding new tables would be
a breaking schema change with no functional benefit and would duplicate existing
read paths the frontend already consumes.

## Verification
- `npm run check` — TypeScript error count unchanged at the Stage 1 baseline (57).
- Validation smoke test — rejects invalid date range with `ApiError(400,
  VALIDATION_ERROR)`; accepts valid range; `safeParse` returns a discriminated
  result; error envelope and `sendApiError` emit the standard safe shape; Zod
  issue details expose only `path` + `message` (no received values).
- `npm test` — existing suite remains green.

See `VALIDATION_AUDIT_NOTIFICATION_GUIDE.md` for usage.
