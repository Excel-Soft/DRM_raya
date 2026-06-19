# GM Sales — Status History Model (Patch 5 Stage 6 / P14)

The append-only ledger `drm.workflow_status_history` is the single source of
truth for cross-module workflow transitions written through the central
`WorkflowStatusService`. It is defined in `shared/schema.ts`
(`workflowStatusHistory`) and created at boot by `ensureWorkflowStatusHistorySchema`
in `server/db/ensure.ts`.

Because `npm run db:push` is broken repo-wide on a pre-existing FK type mismatch,
the table is created via **idempotent runtime DDL** (`CREATE TABLE / INDEX IF NOT
EXISTS`), wired into `ensureDbOnce`. The Drizzle definition mirrors that DDL.

## Table: `drm.workflow_status_history`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `entity_type` | `text` NOT NULL | `WORKFLOW_ENTITY_TYPES` value (GM, INVOICE, PROJECT, …) |
| `entity_id` | `text` NOT NULL | **TEXT** because GM ids are varchar while invoice/project ids are uuid |
| `action` | `text` NOT NULL | e.g. `GM_LOAN_ADMIN_APPROVE`, `PP_DEPENDENCY_RELEASED` |
| `previous_status` | `text` | status moved FROM (read inside the tx) |
| `next_status` | `text` NOT NULL | status moved TO |
| `actor_user_id` | `uuid` | **no FK** — keeps history immutable and dodges the broken push FK |
| `actor_role` | `text` | normalized active/primary role of the actor |
| `reason` | `text` | required for reject-style actions |
| `evidence` | `jsonb` NOT NULL `'[]'` | optional supporting evidence |
| `related_entity_type` | `text` | e.g. a generated project linked to an invoice |
| `related_entity_id` | `text` | |
| `metadata` | `jsonb` NOT NULL `'{}'` | free-form per-action context |
| `audit_log_id` | `uuid` | optional link to the `activity_logs` row |
| `created_at` | `timestamptz` NOT NULL `now()` | |

### Indexes
- `idx_workflow_status_hist_entity (entity_type, entity_id, created_at DESC)` —
  per-entity history timeline.
- `idx_workflow_status_hist_actor (actor_user_id, created_at DESC)` — "what did
  this user do".
- `idx_workflow_status_hist_action (action, created_at DESC)` — per-action audit.

## Design notes / why
- **`entity_id` is TEXT** — the system mixes varchar GM ids and uuid
  invoice/project ids; a single TEXT column lets one ledger span every module.
- **`actor_user_id` has no foreign key** — history must survive even if a user
  row is later changed, and a hard FK would re-trigger the pre-existing push
  failure. Non-uuid actor ids (e.g. role placeholders) are stored as `NULL`.
- **Append-only** — rows are inserted inside the entity-write transaction and
  never updated/deleted in normal operation, so the ledger is a faithful audit
  trail even if the downstream best-effort audit/notify steps fail.
- **Atomicity** — the history INSERT shares the transaction with the delegated
  `execute(client)` entity write. Either both commit or both roll back (proven by
  `server/workflow-status.service.test.ts`).

## Relationship to existing audit
This ledger is **additive**. The existing `activity_logs` audit
(`AuditLogService`, `recordGmSalesAudit`, `PROJECT_DEPENDENCY_SATISFIED`, …) is
untouched; the central service writes a best-effort `recordTransition` audit row
in addition to the durable in-transaction history row. Audit/notify never block
the transition result.

Migrated **invoice** transitions pass `auditEntityType: "Invoice"` so their
central audit row keeps landing under the legacy entity type the invoice history
view reads by — preserving that view unchanged (one audit row per transition, no
duplicate). The ledger row itself is always written under the canonical
`entityType` (`INVOICE`).
