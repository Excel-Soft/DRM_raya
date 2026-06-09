# Stage 7 — Unified Follow-Up Communication Model

Adds a single, unified communication / follow-up timeline across sales, CRM and
service modules, plus a query-based reminder (due / overdue) queue. Reuses the
Stage 2 audit and notification services. No destructive DB changes — the table is
created at runtime (repo-wide `db:push` is broken on a pre-existing FK mismatch).

## What was added

### Database (`shared/schema.ts` + runtime ensure-schema)
- `drm.communication_channel` enum: `CALL, WHATSAPP, EMAIL, MEETING, VISIT, SMS, NOTE, OTHER`.
- `drm.communication_outcome` enum: `INTERESTED, NOT_INTERESTED, CALLBACK,
  NO_RESPONSE, CONVERTED, COMPLAINT, RENEWAL, RESOLVED, DROPOUT_RISK, OTHER`.
- `drm.communication_logs` table:
  - `entity_type` (text), `entity_id` (text) — generic owner pointer.
  - `customer_id`, `lead_id`, `user_id` (uuid, nullable).
  - `channel` (enum, not null), `outcome` (enum, nullable).
  - `notes`, `next_action` (text).
  - `next_followup_at` (timestamptz) — drives the reminder queue.
  - `status` (text, default `COMPLETED`; `PENDING` for scheduled follow-ups).
  - `related_followup_id`, `related_appointment_id`, `message_template`,
    `external_reference` (text).
  - `created_at` / `updated_at` (timestamptz).
  - Indexes on `(entity_type, entity_id)`, `customer_id`, `user_id`,
    `(next_followup_at, status)`.
- The enums + table are declared in `shared/schema.ts` for Drizzle types and
  created idempotently at boot by `CommunicationService.ensureSchema()`
  (`CREATE TYPE … EXCEPTION WHEN duplicate_object`, `CREATE TABLE/INDEX IF NOT EXISTS`).

### Service — `server/services/communication.service.ts`
- `ensureSchema()` — idempotent runtime DDL.
- `create()` — validated insert; verifies the referenced customer exists; emits a
  reminder notification when a future `next_followup_at` is set; records an audit
  entry via `AuditLogService`.
- `log()` — **best-effort, never throws** convenience used by existing follow-up
  endpoints (Task F). A logging failure can never break the host action.
- `list()` — filterable list (entity, customer, channel, outcome, user, status,
  date range, paging).
- `timeline()` — full chronological feed for one entity.
- `patch()` — update notes / outcome / reschedule / status (audited).
- `completeNextAction()` — close a `PENDING` follow-up with an outcome and
  optionally chain a new scheduled follow-up.
- `remindersDue()` / `remindersOverdue()` — query-based reminder queues
  (`PENDING` with `next_followup_at` in the future / past), optionally per-user.

### Validators — `server/validators/communication.validators.ts`
- `createCommunicationSchema`, `patchCommunicationSchema`,
  `completeNextActionSchema`, `listCommunicationsSchema`.
- Data-quality rules (no silent fallback — invalid input is rejected):
  - `outcome` required when `status = COMPLETED`.
  - `next_followup_at` required for `CALLBACK`, `NO_RESPONSE`, or `PENDING`.
  - `notes` required for `COMPLAINT`, `DROPOUT_RISK`, `NOT_INTERESTED`.
  - sub-service requires its parent service.

### Routes — `server/routes/communication-routes.ts` (mounted `/api/communications`)
All behind the global auth middleware (`req.user` always present):
- `GET  /api/communications` — list with filters.
- `GET  /api/communications/:entityType/:entityId/timeline` — entity timeline.
- `POST /api/communications` — create a log.
- `PATCH /api/communications/:id` — update / reschedule.
- `POST /api/communications/:id/complete-next-action` — complete + chain.
- `GET  /api/communications/reminders/due` — upcoming follow-ups (`?mine=true`).
- `GET  /api/communications/reminders/overdue` — past-due follow-ups.

### Best-effort wiring into existing follow-up actions (Task F)
All calls use `CommunicationService.log()` (non-throwing) and **do not alter any
existing response**. User-supplied dates are parsed defensively so a bad value can
never turn the host handler into a 500.
- `server/service-core-routes.ts`: service follow-up create + complete,
  complaint create + resolve, dropout create, renewal create.
- `server/sales-routes.ts`: lead actions (`whatsapp` / `call` / `email`),
  lead follow-up action, lead whatsapp action.

### Frontend — `client/src/components/communication/communication-timeline.tsx`
- Reusable `<CommunicationTimeline entityType entityId />` component, mirroring
  `workflow-timeline.tsx`. Renders the entity timeline with per-channel icons,
  outcome / status badges, next-action and follow-up-due markers.
- Client-side filters: channel, outcome, user, and date range.
- Integrated into the customer follow-up dialog in
  `client/src/pages/customer-management.tsx` (entity type `customer`).

## Verification
- `npm run check` — TypeScript baseline unchanged at **57 pre-existing errors**;
  **zero** new errors from Stage 7 files.
- App boots cleanly (`Start application` workflow); `/api/communications/*` is
  protected (401 without a token).
- Service-layer smoke tests (all pass): ensure-schema, create, timeline,
  reminders due, reminders overdue, complete-next-action (+chain), validator
  rejects `COMPLETED` without outcome, validator rejects `CALLBACK` without a
  follow-up date.

## Scope notes / deviations
- The reusable timeline is integrated into the customer follow-up dialog. The
  service list pages (dropout / complaints / B-customer, etc.) are read-only
  tables whose row ids do not map cleanly to the `service_customer` id used as the
  communication `entity_id`; embedding the timeline there would render misleading
  empty feeds, so it was deliberately left out. The component is ready to drop
  into any future service **detail** view keyed by `service_customer` id.
- The pre-existing `POST /api/sales/followups` handler contains a legacy silent
  fallback to the first available service. Per the project constraint of "no
  changes to existing business workflows", that handler was **not** refactored;
  the no-silent-fallback rule is enforced in the new communication validators
  instead.
