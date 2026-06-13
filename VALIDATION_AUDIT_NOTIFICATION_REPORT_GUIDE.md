# Validation / Audit / Notification / Report-Safety — Developer Guide

How to use the Patch 3 Stage 2 shared foundations. These are building blocks for
later stages — prefer them over ad-hoc validation, error shapes, audit writes,
notifications, and report fallbacks.

---

## 1. Validation (Zod)

Primitives live in `server/validators/common.validators.ts`; domain schemas
compose them (`invoice`, `workflow`, `approval`, `financial`, `hr`, `service`,
`report`). The `ValidationService` (`server/services/validation.service.ts`)
wraps parse + safe error mapping.

```ts
import { dateRange, pagination, moneyAmount } from "./validators/common.validators";
import { reportExportRequest } from "./validators/report.validators";

// In a handler — parse and let the shared error path format failures:
const parsed = reportExportRequest.safeParse(req.body);
if (!parsed.success) return sendApiError(res, {
  status: 400, code: "VALIDATION_ERROR",
  message: "Invalid export request", details: zodIssues(parsed.error),
});
```

Available common validators: `uuid`, `id`, `isoDate`, `dateLike`, `dateRange`,
`pagination`, `moneyAmount`, `signedMoneyAmount`, `currency`, `percentage`,
`email`, `url`, `phone`, `remarks`, `reason`, `rejectionReason`,
`approvalDecision`, `statusEnum(...)`, `fileMetadata`.

Report validators (`server/validators/report.validators.ts`): `reportKey`,
`reportAction`, `reportFormat`, `reportFilters`, `reportExportRequest`,
`reportDecisionRequest`. The `reportKey`/`reportAction` enums mirror the
permission matrix — keep them in sync if you add a report.

## 2. API error envelope

`server/utils/api-error.ts`. Always return errors through these helpers so the
shape is consistent and nothing leaks.

```ts
import { sendApiError, sendError, badRequest, forbidden } from "./utils/api-error";

sendApiError(res, { status: 403, code: "FORBIDDEN", message: "Not allowed" });
// => { success:false, error:{ code:"FORBIDDEN", message:"Not allowed" } }

// For thrown ApiError or unknown errors (collapses unknown -> generic 500):
try { /* ... */ } catch (e) { return sendError(res, e); }
```

Rules: never put stack traces, SQL, tokens, or secrets in `message`/`details`.
Unknown errors become a generic `INTERNAL_ERROR` (500).

## 3. Audit logging

`server/services/audit-log.service.ts`. Audit entries are stored in the existing
`drm.activity_logs` table (rich fields serialized into `details`; see the Stage 2
changelog for the field mapping and the rationale for not adding a separate
table).

```ts
import { recordAuditLog } from "./services/audit-log.service";

await recordAuditLog({
  actorUserId: req.user?.id,
  action: "invoice.approve",
  module: "accounts",
  entityType: "invoice",
  entityId: invoice.id,
  previousStatus: "Pending",
  nextStatus: "Approved",
  before, after,            // NEVER include password hashes / tokens
  reason: req.body.reason,
  req,                      // captures ip + user-agent
});
```

`recordAuditLog` is best-effort and never throws to the caller — safe on a
mutation's critical path. Read history with
`AuditLogService.getHistory(entityType, entityId)`.

Priority actions to audit: login/logout/failure, password reset, role switch,
user CRUD/status, permission changes, leave/overtime/loan approvals, invoice
approve/reject/edit/paid/cancel, GM/BV approve/reject/refund/delete/create,
PMS/project/task transitions, QA/verification, salary generation/finalization,
penalty create/approve/reject/void, report export.

## 4. Notifications

`server/services/notification-service.ts`. **Never pass a role string where a
user id is expected** — the Stage-2 methods reject non-UUID ids.

```ts
import { NotificationService } from "./services/notification-service";

// One concrete user (UUID required):
await NotificationService.createNotification({
  userId, message: "Your leave was approved",
  type: "SUCCESS", module: "hr", entityType: "leave", entityId: leaveId,
  targetUrl: "/leave", priority: "normal",
});

// Resolve a role to ACTIVE user ids, then notify:
const ids = await NotificationService.resolveUsersByRole("hr_manager");
await NotificationService.createNotificationsForUsers(ids, { message, module: "hr" });

// Workflow transition (roles resolved to real users; optional department scope):
await NotificationService.notifyWorkflowTransition({
  message, recipientRoles: ["hod"], department: "Sales",
  module: "pms", entityType: "task", entityId, targetUrl: "/pms",
});
```

Persisted fields: `message`, `type`, `read_status`, `link`/`target_url`,
`module`, `entity_type`, `entity_id`, `priority`. No email/SMS/WhatsApp provider
is wired (none configured) — do not add one unless configured.

## 5. Report safety

**Backend guard** — `server/middleware/report-permission.ts`:

```ts
import { requireReportPermission } from "./middleware/report-permission";
router.get("/bv-reports", requireReportPermission("bv_report", "view"), handler);
router.post("/bv-reports/export", requireReportPermission("bv_report", "export"), handler);
```

Fail-closed (401 unauthenticated, 403 unauthorized) with the sanitized envelope.
Report keys: `raw_attendance`, `salary_create`, `salary_report`, `event_report`,
`reception_report`, `edit_attendance`, `day_target`, `diagnosis_report`,
`bv_report`, `penalty_report`, `project_report`, `link_report`. Actions: `view`,
`create`, `edit`, `export`, `approve`, `finalize`, `delete`. Row-level "own data
only" scoping stays in the handlers — the guard only gates the action by role.

**Frontend** — `client/src/components/report/` + `client/src/lib/reportApi.ts`:

- Render `ReportLoadingState` / `ReportEmptyState` / `ReportErrorState` (with
  retry) — never render fake rows or a success toast after an API failure.
- Validate the date range before fetching/exporting (`validateDateRange`).
- Export must use the active filters (`buildReportQueryParams` +
  `downloadReportExport`, which throws on error — no silent fallback).

## 6. Modules integrated so far / pending

- **Integrated:** error envelope (auth/todo/reports/leave), report permission
  guard (BV + report routes already wired), audit on user/salary/penalty/
  attendance/workflow, notification UUID-safe resolution.
- **Pending (later stages):** wiring validators + audit + notifications + report
  guards across invoice, workflow, salary, penalty, BV, and the remaining report
  endpoints; optional dedicated `audit_logs` table (with read unification).
