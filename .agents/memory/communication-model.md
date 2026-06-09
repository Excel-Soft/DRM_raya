---
name: Unified communication / follow-up model (Stage 7)
description: Durable rules for the drm.communication_logs timeline + best-effort wiring + reminder authz.
---

# Unified communication & follow-up model

A single `drm.communication_logs` timeline (generic `entity_type`/`entity_id`)
backs all module follow-ups. Table + enums are created at runtime via
`CommunicationService.ensureSchema()` (db:push is broken), also declared in
`shared/schema.ts` for types.

## Best-effort logging must NEVER break the host endpoint
Existing follow-up endpoints log via `CommunicationService.log()` (fire-and-forget
`void`, internally try/catch, returns null on failure).
**Why:** the host action (creating the followup/complaint/renewal/etc.) must
succeed even if comms logging fails.
**How to apply:** the catch only protects the async body. Any *synchronous*
argument construction before the call (especially `new Date(userInput).toISOString()`,
which throws RangeError on bad input) runs inside the host handler's try and will
turn it into a 500. Always pre-sanitize dates with a safe parser (returns
undefined on invalid) — see `safeIso`/`commSafeIso` helpers — before calling log().

## Reminder/list reads are role-scoped, not per-record ACL'd
`/api/communications/reminders/{due,overdue}` and the list endpoint scope to the
caller's own `user_id` unless `isManagerialRole(activeRoleId||roleId)` is true.
The per-entity `/:entityType/:entityId/timeline` is intentionally NOT scoped — it
shows all touches for that record (consistent with existing lead-history reads any
authed user can see).
**Why:** matches the owner/manager scoping convention used throughout
sales/service routes; avoids leaking every user's pending follow-ups while keeping
the unified timeline useful.
