# Unified Communication & Follow-Up Model

A single source of truth for every customer/lead/service touch-point (calls,
WhatsApp, email, meetings, visits, notes) and the follow-ups they schedule, across
the sales, CRM and service modules.

## Why one model
Before Stage 7 each module logged follow-ups in its own shape (lead activities,
service follow-ups, complaints, renewals, dropouts). There was no unified timeline
and no shared reminder queue. `drm.communication_logs` consolidates all of these
into one append-only timeline addressed by a generic `(entity_type, entity_id)`
pointer, while the original module tables continue to work untouched.

## The table — `drm.communication_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `entity_type` | text | `customer`, `lead`, `service_customer`, `opportunity`, `appointment`, `complaint`, `renewal`, `other` |
| `entity_id` | text | id of the owning record (text so it can hold any id) |
| `customer_id` | uuid | optional, validated to exist |
| `lead_id` | uuid | optional |
| `user_id` | uuid | actor; reminders notify this user |
| `channel` | enum | `CALL, WHATSAPP, EMAIL, MEETING, VISIT, SMS, NOTE, OTHER` |
| `outcome` | enum | `INTERESTED, NOT_INTERESTED, CALLBACK, NO_RESPONSE, CONVERTED, COMPLAINT, RENEWAL, RESOLVED, DROPOUT_RISK, OTHER` |
| `notes` | text | free text |
| `next_action` | text | what to do next |
| `next_followup_at` | timestamptz | drives the reminder queue |
| `status` | text | `COMPLETED` (default) or `PENDING` (scheduled follow-up) |
| `related_followup_id` | text | link back to a module follow-up record |
| `related_appointment_id` | text | link back to an appointment |
| `message_template` | text | optional template id/name |
| `external_reference` | text | optional provider/message reference |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `(entity_type, entity_id)`, `customer_id`, `user_id`,
`(next_followup_at, status)`.

> The table and its enums are created at runtime by
> `CommunicationService.ensureSchema()` because repo-wide `db:push` is broken on a
> pre-existing FK mismatch. They are also declared in `shared/schema.ts` for types.

## Lifecycle

```
                 create() / log()
record a touch ─────────────────────▶  status = COMPLETED   (outcome required)
                                          │
schedule a follow-up ─────────────────▶  status = PENDING    (next_followup_at set)
                                          │
                                          ├─ remindersDue()      next_followup_at >= now
                                          ├─ remindersOverdue()  next_followup_at <  now
                                          │
completeNextAction() ─────────────────▶  status = COMPLETED   (+ optional chained PENDING)
```

- A scheduled (`PENDING`) follow-up with a future date emits a reminder
  notification to its `user_id` via the Stage 2 `NotificationService`.
- Every write is audited via the Stage 2 `AuditLogService`.

## Data-quality rules (validators)
Enforced in `server/validators/communication.validators.ts`; invalid input is
rejected (no silent fallback):
- `outcome` is required when `status = COMPLETED`.
- `next_followup_at` is required for `CALLBACK`, `NO_RESPONSE`, and any `PENDING`.
- `notes` is required for `COMPLAINT`, `DROPOUT_RISK`, `NOT_INTERESTED`.
- A sub-service may only be supplied together with its parent service.

## API surface (`/api/communications`, auth-protected)
| Method & path | Purpose |
| --- | --- |
| `GET /` | list with filters (entity, customer, channel, outcome, user, status, date range, paging) |
| `GET /:entityType/:entityId/timeline` | full chronological timeline for one entity |
| `POST /` | create a communication log |
| `PATCH /:id` | update notes / outcome / reschedule / status |
| `POST /:id/complete-next-action` | complete a pending follow-up and optionally chain a new one |
| `GET /reminders/due` | upcoming follow-ups (`?mine=true` for the caller) |
| `GET /reminders/overdue` | past-due follow-ups |

## Best-effort logging from existing flows
Existing follow-up endpoints call `CommunicationService.log()`, which **never
throws** and **never changes their response**. A communication row appears
alongside the original record; if logging fails, the host action still succeeds.

Currently wired:
- Sales: lead actions (`whatsapp`/`call`/`email`), lead follow-up action, lead
  whatsapp action.
- Service: service follow-up create + complete, complaint create + resolve,
  dropout create, renewal create.

## Frontend
`<CommunicationTimeline entityType entityId />`
(`client/src/components/communication/communication-timeline.tsx`) renders the
entity timeline with channel icons, outcome/status badges and follow-up-due
markers, plus channel / outcome / user / date filters. It is embedded in the
customer follow-up dialog and is reusable for any future detail view.
