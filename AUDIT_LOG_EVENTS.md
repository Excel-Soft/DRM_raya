# Audit Log Events

This document describes how audit/activity logging works in the active backend
and which sensitive actions are recorded.

## Store

All audit + activity events are persisted to a single table, **`drm.activity_logs`**
(`shared/schema.ts`). Per Stage 9 task A ("reuse an existing audit table"), no
separate `drm.audit_logs` table was created.

Columns:

| Column | Meaning |
|---|---|
| `id` | uuid PK |
| `user_id` | actor (FK → `drm.users`, nullable for system jobs) |
| `action` | event action string |
| `resource_type` | entity type the action applied to |
| `resource_id` | entity id |
| `details` | text; for `recordAuditLog` events this is a JSON string |
| `created_at` / `updated_at` | timestamps |

## Writers

There are two ways to write an event; both target `drm.activity_logs`.

### 1. `ActivityLogService.log({ userId, action, resourceType, resourceId, details })`
The original logger, used across 16 route/job files. Lightweight; `details` is a
free-form string. Failures are caught and logged, never thrown.

### 2. `recordAuditLog({ actorUserId, action, module, entityType, entityId, before, after, reason, req })`  *(Stage 9)*
The standard helper for sensitive admin/financial/HR actions. It reuses the same
table and serializes the richer context into `details` as JSON:

```json
{
  "module": "admin/users",
  "before": { "...safe fields only..." },
  "after":  { "...safe fields only..." },
  "reason": "optional reason string",
  "ip": "<from x-forwarded-for / req.ip>",
  "userAgent": "<from request headers>"
}
```

Field mapping: `actorUserId→user_id`, `action→action`, `entityType→resource_type`,
`entityId→resource_id`.

**Security rules for callers**
- Never put passwords, password hashes, tokens, or secrets in `before`/`after`.
  (The user routes strip `password` via `safeUserAudit()` before auditing.)
- Pass `req` so IP and user-agent are captured for forensic context.

## Events currently recorded

### Recorded via `recordAuditLog` (Stage 9, namespaced)
| Action | Module | Entity | Where |
|---|---|---|---|
| `user.create` | admin/users | user | `server/users-routes.ts` |
| `user.update` | admin/users | user | `server/users-routes.ts` |
| `user.status_change` | admin/users | user | `server/users-routes.ts` |
| `user.delete` (soft) | admin/users | user | `server/users-routes.ts` |

### Recorded via `ActivityLogService.log` (pre-existing)
| Action(s) | Where | Notes |
|---|---|---|
| `allowed_ip.create` / `allowed_ip.update` / `allowed_ip.delete` | `server/settings-routes.ts` | Allowed-IP changes |
| `lead_import.commit` | `server/leads-import-routes.ts` | CRM lead import |
| `create` / `update` / `delete` / `approve` / `export` / `assign` / `followup` / `team` / `whatsapp` / `read` / `write` / `manage` / `edit` | account, events, leave, loan, overtime, notice, policy, invoice, product-posting-workflow, project-doc, software-workflow, task-execution routes; overdue-checker job | Generic actions; `resource_type` carries context (leave/loan/overtime approvals, GM/BV & workflow transitions, etc.) |

Impersonation start/stop is additionally tracked in the dedicated
`drm.impersonation_audit_logs` table (`server/services/impersonation.service.ts`).

## Reading events
`ActivityLogService.getLogsForResource(resourceType, resourceId)` returns all
events for one entity (used by per-record activity views).

## Conventions for new code
- Prefer `recordAuditLog` for any sensitive admin/financial/HR mutation.
- Use a namespaced `action` of the form `entity.verb` (e.g. `salary.lock`,
  `gmbv.approve`) and set `module` to the owning area.
- Always pass `req`. Always pass safe `before`/`after`; never secrets.
