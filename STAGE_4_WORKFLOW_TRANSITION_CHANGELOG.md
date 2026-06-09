# Stage 4 — Workflow Transition Service Changelog

Centralizes every workflow phase change behind a single authority,
`server/services/workflow-transition.service.ts`, so legal-state, role/ownership,
rework escalation, structured routing, and error→HTTP mapping are governed in one
place across the Product Posting / D&D and Software modules.

See `WORKFLOW_STATE_MACHINE.md` for the full phase set, transition table, and
guard semantics.

## What changed

### New: `server/services/workflow-transition.service.ts`
- `WORKFLOW_PHASES` + `WorkflowPhase` type and `TERMINAL_PHASES`
  (`VERIFICATION_COMPLETE`).
- `WORKFLOW_TRANSITIONS` — one declarative table that is a faithful **superset**
  of the transitions the routes/services actually perform (verified against the
  existing code). Self-loops are always legal (idempotent re-saves).
- `WorkflowTransitionError { status, code }` — carries the HTTP status (400 for
  illegal/invalid, 403 for role/ownership) so routes map rejections uniformly.
- `validateTransition` / `assertWorkflowTransition` — guards that **never write to
  the DB**, so a rejected transition guarantees no state change. Validation is
  **action-bound**: the rule is resolved by `action` (unknown action ⇒
  `400 WORKFLOW_UNKNOWN_ACTION`), then `from`/`to` are checked against *that
  rule's* registered phases. This prevents a mismatched/unknown action from
  piggy-backing on another action's legal edge and skipping its role/content
  rules. Guard order: legal state → role → ownership → content
  (reason/evidence, gated behind `enforceContent`).
- `isLegalTransition` — retained action-agnostic reachability helper (used for
  diagrams/diagnostics only; the live guard path uses the action-bound check).
- Admin `override` escape hatch to force an otherwise-illegal *state* (requires a
  reason; never bypasses role checks for non-admins).
- `shouldEscalateRework` (pure) + `maybeEscalateRework` — records a
  `WORKFLOW_REWORK_ESCALATED` audit entry once `returnCount` reaches
  `WORKFLOW_REWORK_ESCALATION_COUNT` (env-tunable, default 3). Best-effort; never
  throws on the critical path.
- `resolveWorkflowRouting` — structured department/workflow/dashboard routing,
  preferring explicit fields and flagging text-derived results via
  `derivedFromText`.
- `mapWorkflowError(res, error)` — maps a `WorkflowTransitionError` onto an
  Express response and returns `true` so route catch blocks can early-return
  before the generic 500.

### Integrated executors (state machine delegated, writes kept local)
- `server/services/product-posting-workflow.service.ts`
- `server/services/software-workflow.service.ts`

Both `transitionWorkflowByProject` / `transitionWorkflowByTask`:
- accept and forward `actorRoles`, `ownershipSatisfied`, `evidenceCount`, and
  `enforceContent` so the central guard receives full actor/content context;
- compute `ownershipSatisfied` inline for `EXECUTIVE_SUBMITTED` (the acting user
  must be the assigned executive, or the slot is still unassigned);
- call `assertWorkflowTransition(...)` **before any write** (throws 400/403);
- wrap the workflow update **and** the history append in a single
  `db.transaction(tx)` so the phase change and its history row are atomic;
- `appendWorkflowHistory` accepts an optional transaction executor so it
  enlists in that same transaction;
- call a private `escalateReworkIfNeeded` helper after applying QA/Verification
  returns, which forwards `returnCount` to `maybeEscalateRework`.

### Routes — active enforcement + uniform 400/403 mapping
Every transition-invoking endpoint now threads the actor's full role set
(`actorRoles: [...req.user.roles, req.user.roleId]`) and `enforceContent: true`
into its executor call, plus `evidenceCount` for `EXECUTIVE_SUBMITTED`. This
activates the central role guard and content (reason/evidence) enforcement on the
live paths — they are no longer dormant. Endpoints touched:
- `server/routes/product-posting-workflow-routes.ts`
- `server/routes/software-workflow-routes.ts`
- `server/routes/project-doc-routes.ts`
- `server/routes/task-execution-routes.ts`

Each route's role-level `requireRole` list is a **subset** of the matching rule's
allowed roles, so threading roles cannot produce a 403 that `requireRole` would
not already produce.

Two endpoints write a non-workflow row *before* the transition (doc verify writes
the document status; task complete upserts `taskResults`). To preserve the
"no DB write on rejection" guarantee for content failures, each got a short
content guard (mirroring the central reason/evidence rule) that runs **before**
that pre-write: doc reject without a reason and task complete with zero evidence
links now `400` with no partial write.

`mapWorkflowError(res, error)` early-returns in every catch block, so
illegal-state and role/ownership/content rejections surface as 400/403 with a
stable `code` instead of a generic 500.

## Design decisions
- **Action-bound validation.** The legal-state check is resolved through the rule
  named by `action`, never by a free `from → to` reachability search. An unknown
  action fails closed (`400 WORKFLOW_UNKNOWN_ACTION`) and a known action can only
  use *its own* registered edges, so it can never inherit another action's legal
  edge and skip that action's role/content rules.
- **Role guard is active, with `requireRole` as a safety floor.** The app uses a
  multi-role model (`req.user.roles[]` + active `roleId` + `dnd`↔`dd`
  normalization). Routes thread the full normalized role set; the guard passes
  when **any** held role is permitted — identical semantics to `requireRole`.
  Because each route's `requireRole` list is a subset of the rule's allowed
  roles, activating the central guard cannot introduce a 403 the route would not
  already raise. `admin`/`super_admin` always pass.
- **Content enforcement is active on the live routes.** Routes pass
  `enforceContent: true` (and `evidenceCount` for submissions), so required
  reasons (returns/rejections) and required evidence (executive submissions) are
  enforced centrally. Where a route performs a non-workflow pre-write, a short
  route-level guard mirrors the same rule *before* that write so a content
  rejection never leaves a partial write. The `enforceContent` flag is retained
  (default false) only so a future caller that does its own content validation
  can opt out.
- **Ownership** is enforced for `EXECUTIVE_SUBMITTED` (acting user must own the
  assigned task, or the slot is unassigned); `ownershipSatisfied === false`
  rejects with `403 WORKFLOW_OWNERSHIP_FORBIDDEN` (admins exempt).
- **Backend-only queues / reusable timeline** were already in place from prior
  stages (`client/src/components/workflow-timeline.tsx`; localStorage/mock data
  already removed). No UI/business-logic changes were made, per project
  preferences.

## Follow-ups / backfill
- Records whose department is only derivable from free-text project/invoice
  names (`resolveWorkflowRouting` → `derivedFromText: true`) should be
  back-filled with structured routing columns so routing no longer relies on
  string heuristics.
- All current transition callers already thread `actorRoles` + `enforceContent`;
  any **new** transition caller should do the same to inherit end-to-end central
  governance (and add a pre-write content guard if it writes before transitioning).

## Configuration
- `WORKFLOW_REWORK_ESCALATION_COUNT` (optional env, default `3`) — return count
  at which a rework escalation is recorded. Keep secrets/config in Replit-managed
  env, never hard-coded.

## Review fixes
- **Self-loop guard-order fix (security).** The validator previously early-returned
  on `from === to` *before* the role/ownership/content checks, so a same-phase
  transition (notably `EXECUTIVE_SUBMITTED` on an already-`RUNNING_PROJECT`
  workflow) bypassed ownership entirely — a broken-access-control risk. The global
  self-loop early return was removed: the action is resolved first, then a
  self-loop only skips the *legal-state* check, while role, ownership, and content
  guards still run.
- **Atomic related-record writes.** Both executors now accept an optional
  `applyWithinTx(tx)` callback executed inside the same `db.transaction` as the
  workflow update + history append. The Product Posting, Software (both
  `/tasks/:taskId/submit-to-manager` and the QA/verification routes),
  task-execution (`/complete`, `/timers/start`, `/extensions`), and
  document-verify routes moved their related writes (task status, timer start,
  `taskResults`, `taskTimeExtensions`, document status) into this callback, so a
  rejected/failed transition leaves no partial update. Document-verify also moved
  its activity log to after the successful transition.
- **Extension request validation.** `POST /tasks/:id/extensions` now fails fast
  with **no DB write** on rejection, in order: ownership (non-assignee ⇒
  `403 WORKFLOW_OWNERSHIP_FORBIDDEN`, admins exempt), payload validation via the
  pure `validateExtensionRequestInput` (non-positive/NaN minutes ⇒
  `400 EXTENSION_MINUTES_INVALID`, empty/whitespace reason ⇒
  `400 EXTENSION_REASON_REQUIRED`), and duplicate prevention (a second pending
  request for the same task ⇒ `400 EXTENSION_DUPLICATE_PENDING`). The row insert
  remains inside `applyWithinTx`, so legal-state rejection in the central guard
  also leaves no row. Previously the `EXTENSION_REQUESTED` rule (`roles: null`)
  had no ownership, payload, or duplicate enforcement.
- **Tests.** `server/workflow-transition.service.test.ts` (vitest) pins the
  self-loop guards: wrong-owner `EXECUTIVE_SUBMITTED`/`EXTENSION_REQUESTED` ⇒ 403,
  missing evidence ⇒ 400, wrong-role self-loop ⇒ 403, unknown action ⇒ 400,
  illegal transition ⇒ 400, missing reason ⇒ 400, plus valid/override happy paths,
  and the pure `validateExtensionRequestInput` (minutes/reason cases + ordering).
  `server/task-extension-routes.test.ts` is a DB-backed supertest suite asserting
  the extension endpoint's 403/400 rejection paths each leave **zero** new
  `task_time_extensions` rows (non-owner, bad minutes, empty reason, duplicate
  pending).

## Verification
- `npm run check` — stays at the **57 pre-existing** baseline errors (all in
  unrelated files); **0 new** errors in any touched file.
- `npm test` — full suite green (25 tests: 14 pre-existing + 11 new transition
  guard tests).
- `npm run dev` — app boots cleanly and serves on port 5000.
