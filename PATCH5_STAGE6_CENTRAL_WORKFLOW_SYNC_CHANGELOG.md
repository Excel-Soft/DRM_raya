# Patch 5 Stage 6 (P14) — Centralized Cross-Module Workflow & Status Synchronization

## Goal
Introduce **one** central orchestrator that every cross-module workflow
transition (GM, invoice, project, QA, verification) flows through, so that
validation, the transaction boundary, the append-only status-history ledger,
audit and notification are owned in a single place — **without rewriting the
existing modules, workflows, APIs, UI or DB business structure.**

This stage is **thin, additive and phased**. The orchestrator does **not**
re-implement entity logic; it *delegates* the entity-specific write back to each
module via a caller-supplied `execute(client)` executor and owns only the
cross-cutting concerns around it. Only the smoke-test-proving route set was
migrated; everything else continues to work exactly as before and is listed
under **Deferred** below.

`npm run db:push` is broken repo-wide on a pre-existing FK type mismatch, so the
new table is created at boot via idempotent runtime DDL (`CREATE TABLE / INDEX IF
NOT EXISTS`), never via push.

---

## Files changed

### Added
- `server/services/workflow-status.service.ts` — the central orchestrator
  (`WorkflowStatusService.transition`, exported as `transitionWorkflowStatus` /
  `transitionGmSalesWorkflow`).
- `server/workflow-status.service.test.ts` — vitest unit + DB-backed tests.
- `PATCH5_STAGE6_CENTRAL_WORKFLOW_SYNC_CHANGELOG.md` (this file).
- `GM_SALES_CROSS_MODULE_STATE_MACHINE.md` — the transition maps / legal edges.
- `GM_SALES_STATUS_HISTORY_MODEL.md` — the `workflow_status_history` ledger model.

### Modified
- `shared/gm-sales-constants.ts` — added `WORKFLOW_ENTITY_TYPES`,
  `GM_LEGAL_TRANSITIONS`, `INVOICE_LEGAL_TRANSITIONS`, `isLegalTransition`,
  `nextLegalStatuses`, and the `GM_LOAN_ADMIN_GATE_STATES` /
  `GM_LOAN_ADMIN_GATE_TRANSITIONS` sub-state map for the loan-admin gate.
- `shared/schema.ts` — added the `workflowStatusHistory` (`drm.workflow_status_history`)
  table definition + insert schema/types.
- `server/db/ensure.ts` — `ensureWorkflowStatusHistorySchema`, wired into
  `ensureDbOnce` (idempotent runtime DDL + indexes).
- `server/services/official-status.service.ts` — canonical-status helpers
  (`getOfficialGmStatus` / `Invoice` / `Project` / `Workflow`,
  `deriveOfficialGmStatus`).
- `server/routes/invoice-routes.ts` — invoice HOD/Account approve+reject and the
  legacy `PUT /:id/approve` routed through the central service.
- `server/gm-pool-routes.ts` — GM `finalize-partial` and loan-admin
  approve/reject routed through the central service.
- `server/routes/product-posting-workflow-routes.ts` — verification-review
  *complete* records a final-status milestone row via the central service.
- `server/services/invoice-to-project.service.ts` — the Listing-Page-QA
  dependency unlock (held-project release) routed through the central service.

---

## Services added
- **`WorkflowStatusService.transition(input)`** (`transitionWorkflowStatus`).
  Pipeline, in order:
  1. **Permission** — if `requiredRoles` supplied and the actor holds none → `403`.
  2. **Reason / evidence policy** — `requireReason` / `requireEvidence` → `400`.
  3. **Legal-transition validation** — against the entity's map (or a supplied
     `transitionMap`); unknown `fromStatus` or illegal edge → `400`. Runs
     **before** any transaction opens, so a rejected transition never writes.
  4. **Transaction** (`withPgTransaction`, single raw-pg client): runs the
     delegated `execute(client)` **and** inserts the `workflow_status_history`
     row — they commit or roll back together.
  5. **Best-effort audit** (`AuditLogService.recordTransition`) after commit.
  6. **Best-effort notification** — opt-in only (`notify`), off by default so
     modules that already notify do not double-send.

  Returns `{ ok, entityType, entityId, previousStatus, nextStatus,
  updatedEntity, historyId, auditRecorded, notifiedCount, nextAllowedActions }`.
  Throws `ApiError(400|403)` on policy failures; re-throws executor errors after
  rollback.

  An optional **`auditEntityType`** overrides the entityType used for the
  best-effort audit row only (the history ledger always uses `entityType`). This
  lets a migrated module keep writing its audit under its legacy entity type so
  existing audit/history views keep finding it (used by the invoice routes — see
  "Audit / status-history behavior").

---

## Routes migrated
| Module | Route | Action(s) recorded |
|---|---|---|
| Invoice | `POST /api/invoices/:id/hod-approve` | invoice PENDING_HOD → PENDING_ACCOUNT |
| Invoice | `POST /api/invoices/:id/hod-reject` | invoice PENDING_HOD → REJECTED (reason) |
| Invoice | `POST /api/invoices/:id/account-approve` | invoice PENDING_ACCOUNT → APPROVED |
| Invoice | `POST /api/invoices/:id/account-reject` | invoice PENDING_ACCOUNT → REJECTED (reason) |
| Invoice | `PUT /api/invoices/:id/approve` (legacy) | stage-aware approve via central service |
| GM | `POST /gm-pool/:id/finalize-partial` | milestone PARTIAL_PAYMENT_PENDING → PARTIAL_FULLY_PAID |
| GM | `POST /gm-pool/:id/loan-admin-approve` | loan-admin gate → APPROVED |
| GM | `POST /gm-pool/:id/loan-admin-reject` | loan-admin gate → REJECTED (reason) |
| Product Posting | LP-QA dependency unlock (`satisfyListingQaDependencies`, called from `qa-review` complete) | project OnHold → initial (`PP_DEPENDENCY_RELEASED`) |
| Product Posting | `POST /tasks/:taskId/verification-review` (complete) | milestone VERIFICATION_PENDING → VERIFICATION_COMPLETE |

All existing request validation, role/permission middleware, audit calls
(`recordGmSalesAudit` / `AuditLogService`), notifications and **response shapes**
were preserved unchanged. The central call adds the history ledger row (and, for
invoice/GM gate writes, makes the entity write + history atomic).

---

## DB changes
- New table **`drm.workflow_status_history`** (append-only ledger) + three
  indexes — see `GM_SALES_STATUS_HISTORY_MODEL.md`. Created at boot via runtime
  DDL in `ensureWorkflowStatusHistorySchema` (idempotent). No existing table,
  column, constraint or data was altered or dropped.

---

## Transition maps
- **`GM_LEGAL_TRANSITIONS`** — the GM workflow stage graph (DRAFT → … → APPROVED /
  REJECTED / CANCELLED, plus PARTIAL and LOAN sub-paths).
- **`INVOICE_LEGAL_TRANSITIONS`** — DRAFT → PENDING_HOD → PENDING_ACCOUNT →
  APPROVED / REJECTED / CANCELLED.
- **`GM_LOAN_ADMIN_GATE_TRANSITIONS`** — the loan-terms admin-approval *gate*
  sub-state machine (PENDING ↔ APPROVED / REJECTED), modeled separately from the
  GM stage because the loan-admin decision flips a `gm_loan_terms` field, not the
  GM's own stage. Permissive/self-looping to preserve existing re-decision
  behavior.
- Entity types **without** a canonical map (PROJECT, PRODUCT_POSTING_WORKFLOW,
  QA/VERIFICATION) skip legal-edge validation and are simply recorded; pass an
  explicit `transitionMap` to opt into strict validation.

Full edge tables: `GM_SALES_CROSS_MODULE_STATE_MACHINE.md`.

---

## Audit / status-history behavior
- **History** (`workflow_status_history`): written inside the same transaction as
  the entity write — the single source of truth for "who moved what, from→to,
  when, why". Append-only; never updated or deleted in normal operation.
- **Audit** (`activity_logs` via `AuditLogService`): unchanged. Existing
  module-level audit rows (`recordGmSalesAudit`, `PROJECT_DEPENDENCY_SATISFIED`,
  etc.) are **preserved**; the central service additionally records a best-effort
  `recordTransition` audit row. Audit is best-effort and never blocks the result.
- **Invoice audit compatibility**: invoice transitions pass
  `auditEntityType: "Invoice"` so the central audit row lands under the **same**
  entity type the invoice history view (`GET /api/invoices/:id/history`) reads by
  (`getHistory("Invoice", …)`). Without this the migrated HOD/Account/reject
  transitions would have silently dropped out of the invoice history view (they
  would have been recorded under `"INVOICE"`). One audit row per transition — no
  duplicate.
- **Notifications**: existing module notifications preserved; the central service
  only notifies when explicitly opted-in (`notify`), to avoid duplicates.

---

## Tests run
- `server/workflow-status.service.test.ts` — **6 tests, all passing**:
  - validation gate (no DB write): illegal GM edge → 400; unknown from-status →
    400; missing required reason → 400; wrong role → 403; executor never invoked
    on any rejection.
  - transactional atomicity (DB-backed): legal transition commits executor write
    **and** history row together; a throwing executor rolls back **both** (no
    scratch row, no history row).
- Full suite: `npm test` → **11 files / 160 tests passing**.
- `npx tsc --noEmit` → **0 errors**.

---

## Deferred (still using direct status updates — intentionally not migrated)
These continue to work as before and are recorded here for the next phase:
- GM creation/submit, HOD decision and Account decision *stage* updates in
  `gm-pool-routes.ts` (the older `hodDecision` / `accountDecision` helpers remain
  intact); GM cancel.
- Invoice generation / project-generation status writes (Stage 4/5 contract:
  project generation stays post-commit best-effort so an approval never fails on
  a generation hiccup).
- Product-Posting / Software workflow *phase* transitions owned by
  `transitionWorkflowByTask` / `transitionWorkflowByProject` (their own
  transaction + `task_status_history`); only the LP-QA dependency release and the
  verification-complete milestone are mirrored into the central ledger.
- Office-accounts, HR/attendance and other module status fields outside the
  GM → invoice → project → PP approval spine.

## Unresolved issues
- `npm run db:push` remains broken repo-wide on a pre-existing FK type mismatch
  (unrelated to this stage); schema is applied via runtime DDL. No regression
  introduced.
