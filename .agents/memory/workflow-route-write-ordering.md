---
name: Workflow route write ordering
description: Where related-record writes and business validation must sit relative to the central WorkflowTransitionService.
---

# Transition routes: validate before write, write inside the tx

The central `WorkflowTransitionService` (validateTransition / transitionWorkflowByTask)
only governs legal-state, role, ownership, and content/evidence/reason rules. It runs
its checks at the TOP of transitionWorkflowByTask, BEFORE `db.transaction`.

**Rule:** any related-record write a transition route performs (taskResults, task
status flips, timer set, extension insert, doc status) must go INSIDE the executor's
`applyWithinTx(tx)` callback — never with `db.*` before the transition call. Otherwise a
403/403/400 rejection leaves a partial write. Code review blocks repeatedly on this.

**Why:** Stage 4 requires "no DB write on rejection." Because validation precedes the
transaction, putting writes in applyWithinTx makes rejection structurally leave zero rows.

**How to apply:**
- Mirror the `/api/tasks/:id/complete` pattern: `applyWithinTx: async (tx) => { await tx.insert(...); await tx.update(...); }`.
- Business *payload* validation the central guard does NOT cover (positive minutes,
  non-empty reason, duplicate-pending prevention) must be explicit fail-fast route
  checks (return 400/403) BEFORE the transition call. Keep them pure where possible
  (e.g. `validateExtensionRequestInput`) so they're unit-testable without a DB.
- DB-backed route rejection tests: mount the router with an injected `req.user`, hit the
  real dev DB via `pool`, seed minimal rows, assert the rejected path created zero rows.
