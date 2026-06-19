---
name: Central workflow audit entityType preservation
description: When routing a module's status transition through the central workflow-status service, keep the module's legacy audit entityType or its history view goes blank.
---

# Preserve a module's audit entityType when centralizing transitions

The central workflow-status orchestrator writes its best-effort `activity_logs`
audit under the **canonical** `entityType` (e.g. `INVOICE`, `GM`, `PROJECT`).
But a module's own history view reads audit by that module's **own** legacy
entity-type string.

**Rule:** before migrating a module's transition to the central service, find how
that module's history/detail view queries `activity_logs` (e.g. invoice does
`AuditLogService.getHistory("Invoice", id)`), and pass
`auditEntityType: "<that exact string>"` so the central audit row lands where the
view looks. The history **ledger** (`workflow_status_history`) is separate and
always uses the canonical `entityType`.

**Why:** invoice's view queries `"Invoice"`; the central service defaulted to
`"INVOICE"`, so migrated HOD/Account/reject transitions silently disappeared from
the invoice history view (no error, no test failure — vitest strips types and the
audit is best-effort). Only a manual trace of the read path caught it.

**How to apply:** the central service exposes an optional `auditEntityType`
override (audit row only; ledger unaffected). Modules whose legacy audit was
preserved *separately* (GM keeps `recordGmSalesAudit` with `"gm_entry"`, PP keeps
`PROJECT_DEPENDENCY_SATISFIED`) don't need it — the central audit is purely
additive for them. Only modules that **moved** their transition audit into the
central call (invoice) need the override.

## Related: conditional flips need executor-thrown rollback, not a pre-read
The central service **always** inserts a history row. For an only-if-still-X flip
(e.g. release a project only while `OnHold`), do the conditional
`UPDATE … WHERE status='OnHold' … RETURNING` **inside** the executor and `throw`
a sentinel when 0 rows change — that rolls the would-be-spurious history row back
(caught locally as a no-op). A pre-read-outside-the-tx then unconditional update
is a TOCTOU race that writes false/duplicate ledger rows under concurrency.
