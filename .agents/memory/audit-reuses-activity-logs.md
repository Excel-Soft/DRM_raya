---
name: Audit log reuses activity_logs (no separate audit_logs table)
description: Why the audit trail lives in drm.activity_logs and must not be split into a parallel audit_logs table.
---

The audit service records to the existing `drm.activity_logs` table; rich audit
fields (module, previousStatus, nextStatus, before, after, reason, ip, userAgent)
are serialized into the `details` JSON column, NOT first-class indexed columns.
The read side (the audit-log read routes and the service's getHistory) is wired to
`activity_logs`.

**Why:** Adding a separate `drm.audit_logs` table fragments the trail — existing
callers keep writing to `activity_logs` while new writes go elsewhere — or forces
re-wiring every reader, which violates "foundations only / no module rewrites."

**How to apply:** Do NOT "helpfully" introduce a dedicated `audit_logs` table.
Add audit fields by extending the JSON `details`, or only migrate to a dedicated
table if you ALSO unify all readers and backfill in the same change. When
documenting audit, state honestly that the rich fields live in JSON details and
are not indexed columns.
