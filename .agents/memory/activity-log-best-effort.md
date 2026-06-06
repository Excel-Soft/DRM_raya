---
name: ActivityLogService is best-effort
description: Audit logging never throws, so it can sit on a mutation's critical path safely.
---

`ActivityLogService.log()` (server/services/activity-service.ts) wraps its entire
body — including `insertActivityLogSchema.parse(data)` and the DB insert — in a
`try/catch` that only `console.error`s. It always resolves; it never throws.

**Why:** Audit logging must never block or fail a business mutation. A missing
`userId` or a schema/DB hiccup just skips the audit row.

**How to apply:** Awaiting `ActivityLogService.log(...)` after a create/update/
delete is safe and will not abort the request. A reviewer may flag "audit on the
critical path" as a regression — it isn't, because `log()` cannot throw.
