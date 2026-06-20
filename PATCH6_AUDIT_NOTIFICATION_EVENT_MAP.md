# Patch 6 Stage 2 — Audit & Notification Event Map

Reference for which events emit audit records and notifications, and through which
service. This stage **reuses the existing infrastructure**; it does not add new
tables or new notification channels.

## Audit log — single source of truth

- Audit records are written to **`drm.activity_logs`** via `AuditLogService`.
  **No `drm.audit_logs` table is created.**
- `AuditLogService.record(input)` is **best-effort**: it never throws, so it is
  safe to call (via `void`) on a mutation's critical path. It delegates to
  `activity-service.ts` `recordAuditLog`.
- `recordAuditLog` accepts an `actorRole` alias that maps to the underlying
  `activeRole` field, so callers can pass either name.

### `AuditLogInput` fields

| Field | Meaning |
| --- | --- |
| `actorUserId` | acting user id (`req.user.userId`) |
| `actorRole` | acting role (alias → `activeRole`) |
| `action` | e.g. `create`, `update` |
| `module` | logical module (e.g. `service`, `notice`) |
| `entityType` | entity kind (e.g. `service_followup`, `notice`) |
| `entityId` | affected row id |
| `after` | post-state snapshot (the created/updated row) |
| `req` | request (for ip / context capture) |

## Notifications

- `NotificationService` already resolves **role → active user UUIDs** internally,
  so handoffs target current role-holders without callers enumerating users.
- Cross-department handoffs continue to flow through
  `CrossDepartmentStatusService` (e.g. complaint creation). This stage does not
  change that routing — it only ensures the audit record is written alongside.

## Event map (events touched in this stage)

| Event | Route | Audit (`AuditLogService.record`) | Notification / handoff |
| --- | --- | --- | --- |
| Service follow-up created | `POST` service-core (followup) | `create` / `service` / `service_followup` | `CommunicationService.log` (existing) |
| Service complaint created | `POST` service-core (complaint) | `create` / `service` / `service_complaint` | `CrossDepartmentStatusService` handoff (existing) + `CommunicationService.log` |
| Service dropout created | `POST` service-core (dropout) | `create` / `service` / `service_dropout` | `CommunicationService.log` (existing) |
| Service renewal created | `POST` service-core (renewal) | `create` / `service` / `service_renewal` | `CommunicationService.log` (existing) |
| Notice updated | `PATCH` notice-routes | `update` / `notice` / `notice` | existing `ActivityLogService.log` retained (no double audit) |

### Notes

- For the **notice update**, the pre-existing `ActivityLogService.log` call is
  intentionally **kept as the audit record** to avoid writing two rows for the
  same event; `AuditLogService.record` was not additionally wired there.
- All audit calls are fire-and-forget (`void`) and never alter the HTTP outcome
  of the mutation.
