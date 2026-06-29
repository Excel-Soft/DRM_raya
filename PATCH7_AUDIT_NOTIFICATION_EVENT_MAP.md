# PATCH 7 — Audit & Notification Event Map (AUD-001)

_Last updated: 2026-06-29 (Patch 7 Stage 1)._

This document maps the audit-logging and notification foundation that already
exists in the codebase (built in Patch 6) and confirms it satisfies the Stage-1
AUD-001 requirements. No schema change was required in Stage 1.

## 1. Audit log service

`server/services/audit-log.service.ts` writes to the `activity_logs` table. To
avoid a breaking schema change, the rich audit fields are persisted via a stable
core mapping plus structured `before`/`after` payloads:

```
actorUserId -> user_id
action      -> action
entityType  -> resource_type
entityId    -> resource_id
```

The richer fields — `module`, `previousStatus` / `nextStatus`, `before`, `after`,
`reason`, request `ip` / `userAgent` — are captured in the log entry so the trail
is queryable.

| Required audit field | Provided by |
| --- | --- |
| Actor user ID | `actorUserId` → `user_id` |
| Actor role | captured with the actor context / resolvable from user |
| Module | `module` |
| Entity type | `entityType` → `resource_type` |
| Entity ID | `entityId` → `resource_id` |
| Action | `action` |
| Previous status | `previousStatus` |
| Next status | `nextStatus` |
| Before (jsonb) | `before` |
| After (jsonb) | `after` |
| Reason | `reason` |
| IP / user-agent | `ip` / `userAgent` |
| Timestamp | row insert timestamp |

**Security:** the service contract explicitly forbids passing secrets (password
hashes, tokens) in `before`/`after`. `AuditLogService.getHistory(entityType,
entityId)` reads an entity's trail.

> Note: `ActivityLogService.log()` is best-effort and never throws, so it is safe
> to await on a mutation's critical path without risking the user-facing request.

Related services: `server/services/activity-service.ts`,
`server/services/gm-sales-audit.ts` (GM-specific sales audit).

## 2. Where audit happens

1. **Denied-action audit (RBAC):** `requireActionPermission(actionKey, options)`
   supports `auditDenied` (per-call or via the registry `audit` flag). When set,
   a denied (403) attempt is recorded with the action key, actor, and entity type.
2. **Mutation audit:** status-changing and write handlers record
   `previousStatus`/`nextStatus` + `before`/`after` + `reason` through the audit
   service (e.g. approvals, invoice status, service lifecycle transitions).

## 3. Notification service

`server/services/notification-service.ts`:

- `notify({ userId, message, type, link, targetUrl })` creates a per-user
  notification. Supported `type`: `INFO | WARNING | SUCCESS | ERROR`.
- **Role-vs-user safety (the AUD-001 invariant):** `notify` checks whether
  `userId` is a UUID. If it is **not** a UUID, it is treated as a **role name**
  and routed to `notifyRole(role, ...)`. A role string is therefore **never**
  stored as a `userId`.
- `notifyRole(role, message, type, urls)` resolves the role to **real active
  users** by matching both `users.roleId` (string) **and** `users.roles` (array,
  via `role = ANY(users.roles)`), then sends an individual notification to each
  resolved user.
- `getUserNotifications(userId)` reads a user's notifications.

This satisfies "resolve role recipients to real active users; never use role
string as userId" and supports `link` / `targetUrl` (action URLs) alongside the
message payload.

## 4. Event map (representative)

| Module | Event / action | Audited | Notifies |
| --- | --- | --- | --- |
| Attributes | create / update / delete | Yes (registry `audit`) | — |
| Invoice (account) | update / update_status / delete | Yes (status before/after) | role recipients on status change |
| PMS tasks | create / update / status change | Yes | assignee / owner |
| PMS approvals | approve / reject | Yes (prev/next + reason) | requester / approver chain |
| Service core | complaint/dropout/renewal/followup lifecycle | Yes | assigned user / role |
| Loan / Overtime / Leave | approve / reject | Yes | requester |
| Penalty | create / decide (approve/reject) | Yes | penalized employee / HOD |

## 5. Stage-1 conclusion
The audit and notification foundation is present and meets AUD-001: full audit
field coverage (via the documented mapping), denied-attempt auditing through the
RBAC middleware, and role→active-user notification resolution that never treats a
role as a user ID. No new schema or service was required this stage.
