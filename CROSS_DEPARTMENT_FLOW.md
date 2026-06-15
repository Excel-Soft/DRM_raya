# Cross-Department Flow

How work moves between departments and where the **cross-department status
ledger** records each hand-off. The ledger (`drm.cross_department_status_history`)
is an append-only audit of inter-department transitions. It is written by
post-transition hooks in `CrossDepartmentStatusService` and **never** changes
business status.

## End-to-end flow

```
SALES ──submit──▶ HOD ──approve──▶ ACCOUNTS ──approve──▶ PMS (project)
                                                            │
                                                  routed to execution dept
                                                            ▼
                          PRODUCT POSTING / SOFTWARE ──manager-complete──▶ QA
                                                            │
                                              QA complete ──▶ VERIFICATION
                                                            │
                                       verification complete ──▶ DONE

SERVICE: complaint raised ──▶ assignee / service managers
```

## Hooks and what each records

| Hook | Fires at | Source → Target dept | Notify | Recipients (resolved to UUIDs) |
| --- | --- | --- | --- | --- |
| `onInvoiceSubmittedToHod` | invoice submit-hod | SALES → HOD | no | hod, super_hod |
| `onInvoiceHodApproved` | invoice hod-approve | HOD → ACCOUNTS | no | account_manager |
| `onInvoiceAccountApproved` | invoice account-approve | ACCOUNTS → PMS | no | pms / posting / dd / software managers |
| `onInvoiceRejected` | invoice hod/account reject | (stage) → SALES | no | sales exec |
| `onProjectCreated` | PMS project create | PMS → execution dept | yes | the dept's manager role |
| `onWorkflowManagerCompleted` | manager-complete | POSTING/SOFTWARE → QA | no | qa_manager (module already notifies) |
| `onWorkflowQaCompleted` | qa-review complete | QA → VERIFICATION | no | verification_manager (module already notifies) |
| `onWorkflowVerificationCompleted` | verification complete | VERIFICATION → POSTING/SOFTWARE | no | owning manager (module already notified) |
| `onServiceComplaintRaised` | complaint create | SERVICE → SERVICE | yes | assignee, else service_manager |

`notify: false` is used wherever the originating module already delivers the
notification to **real users**. That includes the invoice chain, the verification
close-out (which notifies the executive + manager), AND the manager-complete /
qa-complete hand-offs: their inline `NotificationService.notify({ userId:
"qa_manager" })` is **not** a no-op — the legacy notifier treats a non-UUID
`userId` as a role and broadcasts to the resolved real users, so a `notify: true`
here would double-notify. `notify: true` is therefore only used where the module
did not previously notify anyone (project creation, service complaint). In every
case the ledger row is still written.

## The ledger row

`drm.cross_department_status_history` (created at boot via
`CREATE TABLE IF NOT EXISTS`):

- `id` — uuid pk
- `source_module`, `source_department`, `target_module`, `target_department`
- `entity_type`, `entity_id` (text — modules mix uuid/varchar ids),
  `related_entity_type`, `related_entity_id`
- `action`, `from_status`, `to_status`
- `actor_user_id` — uuid
- `target_user_ids` — jsonb array of the real user UUIDs targeted
- `notified` (boolean) + `notified_count` (integer) — whether/how many were notified
- `audit_log_id` — nullable uuid link to the audit entry
- `event_key` — `module:entityId:action:toStatus`, used for idempotency
- `metadata` — jsonb, `created_at` (timestamptz)

## Idempotency & safety
- `record()` is idempotent: a repeated event (same `event_key`) is a no-op, so
  re-fired transitions (e.g. the legacy invoice approve alias) do not duplicate
  rows.
- `record()` never throws — a ledger/notification failure can never break the
  underlying business transition.
- Hooks are invoked **after** the module commits its transition, and never write
  any business status themselves.

## Reading history
`GET /api/approvals/:module/:entityId` returns the module's own audit trail plus
the cross-department ledger entries for that entity, via
`CrossDepartmentStatusService.getHistoryForEntity()`.
