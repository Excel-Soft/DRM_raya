# Validation, Audit & Notification Guide

How to use the Stage 2 foundation services in route handlers. All three reuse
existing infrastructure and are backward-compatible — adopt them incrementally.

## 1. ValidationService

Wraps Zod parsing and turns failures into the standard `ApiError(400,
VALIDATION_ERROR)`, so a handler can simply parse and let the catch block emit the
safe envelope via `sendError`.

```ts
import { ValidationService } from "./services/validation.service";
import { createInvoiceSchema } from "./validators/invoice.validators";
import { sendError, ApiError } from "./utils/api-error";
import { z } from "zod";

app.post("/api/invoices", async (req, res) => {
  try {
    const body = ValidationService.parse(createInvoiceSchema, req.body);
    // ...use body...
  } catch (error) {
    if (error instanceof ApiError || error instanceof z.ZodError) {
      return sendError(res, error);   // -> 400 VALIDATION_ERROR envelope
    }
    console.error(error);
    return sendError(res, error);     // -> 500 INTERNAL_ERROR (generic)
  }
});
```

Helpers:
- `ValidationService.parse(schema, data)` — throws `ApiError` on failure.
- `ValidationService.safeParse(schema, data)` — returns `{ success, data | error }`, never throws.
- `ValidationService.body(schema, req)` / `.query(schema, req)` / `.params(schema, req)`.

> **Important:** when adopting `ValidationService.parse` in an existing handler,
> make sure the surrounding `catch` handles `ApiError` (route it through
> `sendError`). Otherwise validation failures fall through to a generic 500.

Common primitives live in `server/validators/common.validators.ts` (`uuid`, `id`,
`isoDate`, `dateRange`, `pagination`, `moneyAmount`, `currency`, `percentage`,
`email`, `url`, `phone`, `remarks`, `reason`, `rejectionReason`,
`approvalDecision`, `statusEnum(...)`, `fileMetadata`). Domain files compose them.

## 2. Error envelope: sendApiError

The standard error shape is `{ success:false, error:{ code, message, details? },
message }`. Three ways to emit it:
- `sendError(res, err)` — map a thrown `ApiError` / `ZodError` / unknown error.
- `sendApiError(res, { status, code, message, details })` — object form, explicit control.
- `sendSafeError(res, status, code, message)` — positional form.

```ts
import { sendApiError } from "./utils/api-error";
if (!req.user) {
  return sendApiError(res, { status: 401, code: "UNAUTHORIZED", message: "Not authenticated" });
}
```

> **Never** put stack traces, raw SQL, driver internals, or secrets in `details`.
> Only the fields you pass are serialized.

## 3. AuditLogService

Reuses `drm.activity_logs` via `recordAuditLog`. Rich fields are serialized into
the existing `details` JSON column — **no new table**.

```ts
import { AuditLogService } from "./services/audit-log.service";

// Generic event
await AuditLogService.record({
  actorUserId: req.user.userId,
  action: "invoice.update",
  module: "invoices",
  entityType: "invoice",
  entityId: invoice.id,
  before, after,            // do NOT include secrets
  req,                      // captures ip / user-agent
});

// Status transition (approvals, workflow moves)
await AuditLogService.recordTransition({
  actorUserId: req.user.userId,
  action: "leave.approve",
  module: "hr",
  entityType: "leave_request",
  entityId: id,
  previousStatus: "Pending",
  nextStatus: "Approved",
  reason,
  req,
});

// Read history for an entity
const history = await AuditLogService.getHistory("leave_request", id);
```

Audit writes are best-effort and never throw back into the request path.

## 4. NotificationService

Reuses `drm.notifications` — **no new table**. The Stage 2 API never treats a role
string as a user id; roles are explicitly resolved to real user ids first.

```ts
import { NotificationService } from "./services/notification-service";

// One concrete user (UUID required; role strings are rejected)
await NotificationService.createNotification({
  userId, message: "Your leave was approved", type: "SUCCESS", targetUrl: "/leave",
});

// Resolve a role to active user ids, then notify
const managerIds = await NotificationService.resolveUsersByRole("manager");
await NotificationService.createNotificationsForUsers(managerIds, {
  message: "New leave request pending", type: "INFO", targetUrl: "/leave/approvals",
});

// Scope to a department
const deptManagers = await NotificationService.resolveUsersByDepartmentRole("Sales", "manager");

// Workflow transition — recipients by id and/or role in one call
await NotificationService.notifyWorkflowTransition({
  message: "Invoice approved",
  type: "SUCCESS",
  recipientUserIds: [ownerId],
  recipientRoles: ["accountant"],
  department: "Finance",          // optional: scopes the roles
  targetUrl: `/invoices/${id}`,
});
```

Legacy `notify` / `notifyRole` remain available for existing callers but new code
should prefer the explicit functions above.
