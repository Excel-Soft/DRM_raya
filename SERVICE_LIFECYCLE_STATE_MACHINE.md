# Service Lifecycle State Machine (Patch 6 — Stage 5)

The central authority for changing a service customer's lifecycle status:
`server/services/service-lifecycle.service.ts`. Modelled on
`pms-transition.service.ts` (an error type carrying `{status, code}`, a response
mapper, legal-transition maps, and a single orchestrator that owns the write +
audit + notify).

## Design stance: permissive by default, strict is opt-in
With the **default config the machine never rejects** a status change:
- a non-canonical transition only produces a **warning** (no throw);
- every **content rule** (reason on closure / dropout / recovery / escalation) is
  **OFF**.

Stricter behaviour is enabled per-flag with safe `false` defaults, so turning any
of them on is an explicit, reversible config change. This preserves the imported
app's existing behaviour exactly.

| Env flag | Effect when `true` | Default |
| --- | --- | --- |
| `SERVICE_LIFECYCLE_STRICT` | Enforce the canonical transition map **and** add a manager/admin guard **and** require reasons for closure/dropout/recovery/escalation | `false` |
| `SERVICE_REQUIRE_CLOSURE_REASON` | Require a reason to move to `closed` | `false` |
| `SERVICE_REQUIRE_DROPOUT_REASON` | Require a reason to move to `dropout` | `false` |
| `SERVICE_REQUIRE_RECOVERY_REASON` | Require a reason for `dropout → active` | `false` |
| `SERVICE_REQUIRE_ESCALATION_REASON` | Require a reason for the logical `ESCALATED` action | `false` |

## Stored status enum (unchanged)
The machine writes the **existing** `drm.service_customer_status` enum — **no
schema change**:

```
active · expiring · expired · renewed · upgraded · dropout · closed
```

## Logical states → stored status
The 12 logical lifecycle states from the spec map onto the stored enum. Several
collapse onto one stored value; the richer operational state is recoverable from
the follow-up / complaint / dropout sub-records + the audit trail.

| Logical state | Stored status |
| --- | --- |
| `ASSIGNED` | `active` |
| `CONTACTED` | `active` |
| `FOLLOW_UP_DUE` | `active` |
| `COMPLAINT_RAISED` | `active` |
| `ESCALATED` | `active` |
| `RESOLVED` | `active` |
| `RENEWAL_DUE` | `expiring` |
| `RENEWED` | `renewed` |
| `DROPOUT_RISK` | `expiring` |
| `DROPOUT_CONFIRMED` | `dropout` |
| `RECOVERED` | `active` |
| `CLOSED` | `closed` |

## Canonical transition map (ENFORCED only in strict mode)
```
active    → expiring, expired, renewed, upgraded, dropout, closed
expiring  → active, expired, renewed, upgraded, dropout, closed
expired   → active, renewed, upgraded, dropout, closed
renewed   → active, expiring, expired, upgraded, dropout, closed
upgraded  → active, expiring, expired, renewed, dropout, closed
dropout   → active (recovery), closed
closed    → active (reopen)
```
`from === to` is always allowed (idempotent self-set). In **permissive** mode an
out-of-map move is allowed but recorded as a `warnings[]` entry.

## API surface
- `validateServiceTransition({from, to, strict?, action?, reason?})`
  → `{ warnings }`, or throws `ServiceLifecycleError`. Error codes:
  - `SERVICE_INVALID_STATUS` (400) — `to` is not a known status.
  - `SERVICE_ILLEGAL_TRANSITION` (400) — strict only; out-of-map move.
  - `SERVICE_REASON_REQUIRED` (400) — required reason missing
    (closure/dropout/recovery/escalation), gated by the matching flag or strict.
- `isLegalServiceTransition(from, to)` — pure boolean against the map.
- `changeServiceCustomerStatus({serviceCustomerId, toStatus, actorUserId,
  actorRole?, action?, reason?, req?})` — validate → raw-SQL `UPDATE` (sets
  `status`, `status_changed_at`, `updated_by/at`) → best-effort audit
  (`SERVICE_CUSTOMER_STATUS_CHANGED`) → best-effort assignee notification.
  Returns a structured result `{success, status?, error?, code?, serviceCustomer?,
  fromStatus?, warnings?}`. In strict mode it also enforces a manager/admin actor
  (`SERVICE_ROLE_FORBIDDEN`, 403).
- `mapServiceLifecycleError(res, error)` — maps a `ServiceLifecycleError` to its
  HTTP envelope; returns `true` if handled.

## Wiring status — IMPORTANT (explicit drift)
**No existing HTTP endpoint mutates `service_customers.status`.** In the imported
app the status is set at **import/creation** only; the follow-up / complaint /
renewal / dropout endpoints operate on their **own sub-records**, not on the
service customer's lifecycle status column.

Consequently this module is **built as the central, reusable authority but is not
wired to any route** — there was no status-changing endpoint to route through it.
Wiring it to a non-existent endpoint, or inventing a new status endpoint, was out
of scope ("do not add behaviour / do not rewrite working services"). Because
nothing calls it on the request path today, **all current HTTP outcomes are
unchanged**. When a status-change endpoint is introduced, it should call
`changeServiceCustomerStatus` so validation + audit + notification happen in one
place. (`changeServiceCustomerStatus` performs the DB write itself via raw SQL,
since `db:push` is broken.)

## Audit & notification
Every status change records `SERVICE_CUSTOMER_STATUS_CHANGED` via
`AuditLogService` (with previous/next status, reason, any warnings, and the
logical action) and notifies the assignee via `NotificationService`. Both are
best-effort and never throw.

## Patch 7 Stage 4 verification
Re-verified unchanged: the machine remains the central, reusable authority and is
still **not wired to any HTTP route** (the imported app has no status-changing
endpoint to route through it), so all current HTTP outcomes are unchanged. No
code change in Stage 4 — this module was confirmed complete, not rebuilt. When a
status-change endpoint is introduced it should call
`changeServiceCustomerStatus`.
