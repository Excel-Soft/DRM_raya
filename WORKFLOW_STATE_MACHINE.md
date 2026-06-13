# Workflow State Machine

Canonical reference for the WebExcels DRM phase lifecycle governed by
`server/services/workflow-transition.service.ts`. The Product Posting / D&D and
Software modules share an **identical** phase set and transition table; they
differ only in which Drizzle tables their executors write to.

## Phases

| Phase                   | Meaning                                              |
| ----------------------- | --------------------------------------------------- |
| `PENDING_PROJECT`       | Intake; awaiting documents / data.                  |
| `DATA_VERIFY`           | Documents uploaded, awaiting manager data check.    |
| `PROJECT_OVERVIEW`      | Data verified; ready for task assignment.           |
| `TASK_ASSIGNMENT`       | Assignment in progress.                             |
| `RUNNING_PROJECT`       | Executive actively working (timer / submissions).   |
| `MANAGER_COMPLETE`      | Manager marked the task complete.                   |
| `QA_REVIEW`             | Awaiting / under QA review.                          |
| `QA_COMPLETE`           | QA passed.                                           |
| `VERIFICATION_PENDING`  | Awaiting verification.                              |
| `VERIFICATION_COMPLETE` | **Terminal** — fully verified.                      |
| `RETURNED_FOR_CHANGE`   | Sent back for rework (UI label: "Changing").        |

`VERIFICATION_COMPLETE` is terminal: it has no legal outgoing transition other
than an idempotent self-loop.

## Transition table

Self-loops (`from === to`) are always legal (idempotent re-saves) and are not
enumerated below.

| Action                  | From                                                              | To                          | Roles                                            | Reason | Evidence |
| ----------------------- | ---------------------------------------------------------------- | --------------------------- | ------------------------------------------------ | :----: | :------: |
| `DOCUMENT_UPLOADED`     | PENDING_PROJECT, DATA_VERIFY, PROJECT_OVERVIEW, RETURNED_FOR_CHANGE | PENDING_PROJECT, DATA_VERIFY | (none — ownership + route guard)                |        |          |
| `DOCUMENT_REJECTED`     | PENDING_PROJECT, DATA_VERIFY, PROJECT_OVERVIEW                    | PENDING_PROJECT             | managers + qa_manager                            |   ✔    |          |
| `DATA_VERIFIED`         | PENDING_PROJECT, DATA_VERIFY                                      | PROJECT_OVERVIEW            | managers + qa_manager                            |        |          |
| `TASK_ASSIGNED`         | PROJECT_OVERVIEW, TASK_ASSIGNMENT, RETURNED_FOR_CHANGE, RUNNING_PROJECT | RUNNING_PROJECT       | managers + qa_manager                            |        |          |
| `TIMER_STARTED`         | PROJECT_OVERVIEW, TASK_ASSIGNMENT, RUNNING_PROJECT, RETURNED_FOR_CHANGE | RUNNING_PROJECT       | (none — ownership + route guard)                 |        |          |
| `EXTENSION_REQUESTED`   | RUNNING_PROJECT, RETURNED_FOR_CHANGE                             | RUNNING_PROJECT             | (none — ownership + route guard)                 |        |          |
| `EXECUTIVE_SUBMITTED`   | RUNNING_PROJECT, RETURNED_FOR_CHANGE                             | RUNNING_PROJECT             | (none — ownership + route guard)                 |        |    ✔     |
| `MANAGER_COMPLETE`      | RUNNING_PROJECT, MANAGER_COMPLETE                               | QA_REVIEW                   | managers                                         |        |          |
| `QA_COMPLETE`           | QA_REVIEW, QA_COMPLETE                                          | VERIFICATION_PENDING        | qa_manager, admin                                |        |          |
| `QA_RETURNED`           | QA_REVIEW                                                       | RETURNED_FOR_CHANGE         | qa_manager, admin                                |   ✔    |          |
| `VERIFICATION_COMPLETE` | VERIFICATION_PENDING, QA_COMPLETE                               | VERIFICATION_COMPLETE       | verification_manager, admin                      |        |          |
| `VERIFICATION_RETURNED` | VERIFICATION_PENDING, QA_COMPLETE                               | QA_REVIEW                   | verification_manager, admin                      |   ✔    |          |

"managers" = `product_posting_manager`, `dd_manager`, `software_manager`,
`admin`. `admin` (and `super_admin`) bypass the role list everywhere.

## Diagram

```
PENDING_PROJECT ──DOCUMENT_UPLOADED──▶ DATA_VERIFY ──DATA_VERIFIED──▶ PROJECT_OVERVIEW
       ▲                                                                     │
       └────────────── DOCUMENT_REJECTED ◀──────────────────┐               │ TASK_ASSIGNED
                                                            │               ▼
                                                            │        RUNNING_PROJECT ◀──┐
                                                            │               │           │ TIMER_STARTED
                                                            │   MANAGER_COMPLETE        │ EXTENSION_REQUESTED
                                                            │               ▼           │ EXECUTIVE_SUBMITTED
                                                            │           QA_REVIEW ──────┘
                                            QA_RETURNED ────┤               │ QA_COMPLETE
                                                            │               ▼
                                            RETURNED_FOR_CHANGE      VERIFICATION_PENDING
                                              (re-assign ▲           │            │
                                               via TASK_ASSIGNED)    │ VERIFICATION_RETURNED (→ QA_REVIEW)
                                                                     │ VERIFICATION_COMPLETE
                                                                     ▼
                                                          VERIFICATION_COMPLETE (terminal)
```

## Guard order & guarantees

`validateTransition` is **action-bound**: it first resolves the rule named by
`action` (unknown ⇒ `400 WORKFLOW_UNKNOWN_ACTION`), then checks, in order,
**before any DB write**:

1. **Legal state** — `from`/`to` must both be registered on *that action's* rule
   (or an idempotent self-loop). Illegal ⇒ `400 WORKFLOW_ILLEGAL_TRANSITION`. An
   `admin` may set `override: true` with a `reason` to force an illegal *state*
   (audited by the caller); this never bypasses role checks for non-admins.
   Binding legality to the action stops a mismatched/unknown action from
   borrowing another action's legal edge and skipping its role/content rules.
2. **Role** — when a rule restricts roles and any role context was supplied, the
   guard passes if **any** held role (`actorRole` + `actorRoles[]`, normalized)
   is permitted; otherwise ⇒ `403 WORKFLOW_ROLE_FORBIDDEN`. A `null` role-set
   means no restriction at this layer (executive self-service governed by
   ownership + route `requireRole`). `admin`/`super_admin` always pass.
3. **Ownership/scope** — `ownershipSatisfied === false` ⇒
   `403 WORKFLOW_OWNERSHIP_FORBIDDEN` (admins exempt).
4. **Content** (when `enforceContent: true`) — required reason ⇒
   `400 WORKFLOW_REASON_REQUIRED`; required evidence ⇒
   `400 WORKFLOW_EVIDENCE_REQUIRED`.

Because validation runs before the write and the executors wrap the mutation +
history append in a single `db.transaction`, a **rejected transition leaves no
state change** and an applied transition is atomic with its history row.

**Self-loops are not a bypass.** A same-phase transition (`from === to`, e.g.
`EXECUTIVE_SUBMITTED` while already `RUNNING_PROJECT`) only skips the legal-state
check (it is an idempotent no-op state-wise); the role, ownership, and content
guards still run. The validator resolves the action first, then state, then
role/ownership/content — there is no global self-loop early return.

**Related records are atomic with the transition.** Each executor accepts an
optional `applyWithinTx(tx)` callback and runs it inside the same
`db.transaction` as the workflow update + history append. Routes that previously
flipped a related row (task status, `taskResults`, document status) *before*
calling the transition now pass that write through `applyWithinTx`, so a rejected
or failed transition leaves no partial update on the related record either.

### `enforceContent` note

Content (reason/evidence) enforcement is **active** on every live route: each
transition-invoking endpoint passes `enforceContent: true` (and `evidenceCount`
for `EXECUTIVE_SUBMITTED`), so the central reason/evidence rules above are
enforced centrally. Two endpoints write a non-workflow row before transitioning
(doc verify writes the document status; task complete upserts `taskResults`); they
add a short content guard mirroring the central rule **before** that write, so a
content rejection never leaves a partial write. The `enforceContent` flag remains
(default `false`) only so a future caller that does its own content validation can
opt out.

## Rework escalation

Each QA/Verification return increments the workflow's `returnCount` in the
routes. After applying a return, the executor calls `maybeEscalateRework`; when
`returnCount >= WORKFLOW_REWORK_ESCALATION_COUNT` (env-tunable, default **3**) it
records a `WORKFLOW_REWORK_ESCALATED` audit entry. Audit logging is best-effort
and never throws, so it is safe on the mutation's critical path.

## Structured routing

`resolveWorkflowRouting` returns the `departmentType` (DND / PRODUCT_POSTING /
SOFTWARE), owning `workflowType`, a service label, and manager/executive
dashboard URLs. It prefers explicit structured fields and only falls back to
free-text name matching when those are absent — flagging that with
`derivedFromText: true`.

> **Backfill needed:** records whose department can only be derived from
> free-text project/invoice names (`derivedFromText: true`) should be
> back-filled with structured routing columns so routing no longer depends on
> string heuristics.

## Allowed-actions projection (advisory)

`getAllowedWorkflowActions({ fromPhase, actorRole?, actorRoles? })` is a **pure,
read-only** projection of `WORKFLOW_TRANSITIONS`. Given the current phase and the
actor's role(s) it returns the actions that role could legally *initiate* from
that phase, using the **same** action/legal-state + role semantics as
`validateTransition` (admin always passes; a `null` role-set on a rule means no
restriction at this layer; when no role context is supplied no role-filtering is
applied). It performs **no** DB writes and never throws.

It is **advisory only**. It does not apply ownership or content (reason/evidence)
rules — those still run at write time. The authoritative guard remains
`validateTransition` / `assertWorkflowTransition` on every mutation path; the
projection exists so a future UI can disable obviously-invalid action buttons
without duplicating the table.

> **Deferred (this stage):** wiring this helper to an endpoint and gating the
> workflow UI buttons against it is intentionally **not** done yet — the existing
> dashboards render their action buttons inline across many screens and retrofitting
> server-driven gating is a UI rewrite. The helper ships now so that work can build
> on it without re-deriving the state machine.

## Source-of-truth file paths

| Concern                              | Path                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| State machine + guards + projection  | `server/services/workflow-transition.service.ts`      |
| Workflow notifications               | `server/services/notification-service.ts`             |
| Per-entity workflow timeline (UI)    | `client/src/components/workflow-timeline.tsx`          |
| Software workflow routes             | `server/routes/software-workflow-routes.ts`           |
| Product Posting / D&D workflow routes| `server/routes/product-posting-workflow-routes.ts`    |
| Invoice workflow service             | `server/services/invoice-workflow.service.ts`         |

The `workflow-timeline.tsx` component lives directly under `client/src/components/`
(it is intentionally **not** moved into a `workflow/` subdirectory — doing so would
break its existing imports for no functional gain).
