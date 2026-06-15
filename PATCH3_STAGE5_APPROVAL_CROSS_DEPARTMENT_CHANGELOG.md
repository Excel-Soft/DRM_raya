# Patch 3 — Stage 5: Unified Approvals + Cross-Department Status

Adds a **read-only** unified approvals dashboard and a **cross-department status
ledger** that records every inter-department hand-off. Nothing in this stage
mutates business status or duplicates existing workflow logic — every approve /
reject action on the new dashboard calls each module's *own* existing endpoint.

## What was added

### 1. Unified approvals dashboard (read aggregator)
- **`server/services/approval-visibility.service.ts`** — orchestrator + per-module
  role-scoped adapters. Reuses the existing queue/repository queries for each
  module (invoice HOD/Account queues, PMS pending projects, HR leave/overtime,
  loan manager/HOD, product-posting + software QA/verification queues, service
  complaints). Produces a normalized `PendingApprovalItem` whose `actions`
  metadata points back at each module's existing approve/reject endpoint. No
  fake rows — empty sources yield `[]`.
- **`server/routes/approval-routes.ts`** — `GET /api/approvals/pending`,
  `GET /api/approvals/summary`, `GET /api/approvals/:module/:entityId`. There is
  **no** generic write endpoint by design.
- **`client/src/pages/approvals.tsx`** + route `/approvals` in
  `client/src/App.tsx` — summary cards, filterable table, and an approve/reject
  modal (reason required on reject) that calls the module endpoints from each
  item's `actions` metadata. All existing module-specific approval screens are
  left untouched.

### 2. Cross-department status ledger (post-transition hooks)
- **`server/services/cross-department-status.service.ts`** — `ensureSchema()`
  (runtime `CREATE TABLE IF NOT EXISTS` + indexes, because `db:push` is broken
  repo-wide), an idempotent `record()` (deduped by
  `event_key = module:entityId:action:toStatus`), `getHistoryForEntity()`, and
  typed hooks for each hand-off. `record()` resolves recipients to **real user
  UUIDs** before notifying (never role strings), writes the ledger row, and
  best-effort notifies + audits. It **never throws** and **never sets business
  status**.
- **`drm.cross_department_status_history`** table — mirrored in
  `shared/schema.ts` (`crossDepartmentStatusHistory`). Text entity ids (modules
  use mixed uuid/varchar ids), `jsonb` notified-user-ids, nullable audit link,
  `event_key` unique-ish guard for idempotency.

### 3. Hooks wired at existing transition points (no new logic)
| Module | Transition point | Notify? | Reason |
| --- | --- | --- | --- |
| Invoice | submit→HOD, HOD→Account, Account→APPROVED, reject | **false** | invoice service already notifies real users/roles |
| PMS | project created | true | creation did not previously notify the execution dept |
| Product-posting / Software | manager-complete → QA | **false** | module's inline notify already broadcasts to the real qa_manager users (legacy notifier resolves the role string); ledger-only avoids a duplicate |
| Product-posting / Software | QA complete → Verification | **false** | same — module's inline notify already reaches real verification managers; ledger-only |
| Product-posting / Software | verification complete | **false** | module already notifies the real executive + manager |
| Service | complaint raised | true | create handler did not previously notify anyone |

## Files changed
- Added: `server/services/approval-visibility.service.ts`,
  `server/routes/approval-routes.ts`,
  `server/services/cross-department-status.service.ts`,
  `client/src/pages/approvals.tsx`,
  `PATCH3_STAGE5_APPROVAL_CROSS_DEPARTMENT_CHANGELOG.md`, `APPROVAL_MATRIX.md`,
  `CROSS_DEPARTMENT_FLOW.md`.
- Edited: `shared/schema.ts` (new table + types), `server/routes.ts` (mount +
  `ensureSchema`), `server/routes/invoice-routes.ts`, `server/pms-routes.ts`,
  `server/routes/product-posting-workflow-routes.ts`,
  `server/routes/software-workflow-routes.ts`, `server/service-core-routes.ts`
  (hook calls only), `client/src/App.tsx` (route).

## Guarantees
- No business-status mutation in any hook.
- No duplicated workflow logic — dashboard actions delegate to existing endpoints.
- No fake/placeholder records — adapters read live data, empty → `[]`.
- Notification recipients are always resolved to real user UUIDs.
- No destructive DB ops — additive `CREATE TABLE IF NOT EXISTS` only.
- All module-specific approval screens remain in place.
