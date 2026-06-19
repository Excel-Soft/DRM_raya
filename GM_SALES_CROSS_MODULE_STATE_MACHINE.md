# GM Sales — Cross-Module State Machine (Patch 5 Stage 6 / P14)

The legal-transition maps the central `WorkflowStatusService` validates against.
All maps live in `shared/gm-sales-constants.ts` and are consumed via
`isLegalTransition(map, from, to)` and `nextLegalStatuses(map, status)`.

Validation runs **before** any write: an unknown `fromStatus`, or an edge not
present in the map, throws `ApiError(400)` and no row is touched. Entity types
without a canonical map are recorded but not edge-validated unless an explicit
`transitionMap` is supplied.

## Entity types (`WORKFLOW_ENTITY_TYPES`)
| Value | Canonical map | Notes |
|---|---|---|
| `GM` | `GM_LEGAL_TRANSITIONS` | GM workflow stage graph |
| `INVOICE` | `INVOICE_LEGAL_TRANSITIONS` | Invoice approval graph |
| `PROJECT` | — | Recorded; e.g. OnHold → initial on dependency release |
| `PRODUCT_POSTING_WORKFLOW` | — | Phase milestones mirrored from PP engine |
| `SOFTWARE_WORKFLOW` | — | Reserved |
| `QA_REVIEW` / `VERIFICATION_REVIEW` | — | Reserved |

---

## GM workflow stages — `GM_LEGAL_TRANSITIONS`
| From | Allowed → |
|---|---|
| `DRAFT` | `SUBMITTED`, `CANCELLED` |
| `SUBMITTED` | `PENDING_HOD`, `CANCELLED` |
| `PENDING_HOD` | `PENDING_ACCOUNTS`, `REJECTED`, `CANCELLED` |
| `PENDING_ACCOUNTS` | `PENDING_ADMIN`, `PARTIAL_PAYMENT_PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `PENDING_ADMIN` | `APPROVED`, `LOAN_RETURN_PENDING`, `REJECTED`, `CANCELLED` |
| `PARTIAL_PAYMENT_PENDING` | `PARTIAL_FULLY_PAID`, `CANCELLED` |
| `PARTIAL_FULLY_PAID` | (re-enters final approval) |
| `APPROVED` / `REJECTED` / `CANCELLED` / `LOAN_RETURN_PENDING` | terminal / handled elsewhere |

**Partial-payment milestone.** `finalize-partial` records
`PARTIAL_PAYMENT_PENDING → PARTIAL_FULLY_PAID`. It is a milestone only — it does
**not** mutate `gm_entries` (finalize-partial has never set a final status), so
its executor performs no DB write and the history row is the record. The GM then
proceeds through the normal final-approval routes.

---

## Loan-admin gate — `GM_LOAN_ADMIN_GATE_TRANSITIONS`
Modeled **separately** from the GM stage because the loan-terms admin decision
flips `drm.gm_loan_terms.admin_approval_status`, not the GM's own stage. (Note:
`deriveOfficialGmStatus` still derives `LOAN_RETURN_PENDING` for a rejected loan,
which is exactly why the gate is its own sub-state machine.)

States (`GM_LOAN_ADMIN_GATE_STATES`): `PENDING`, `APPROVED`, `REJECTED`.

| From | Allowed → |
|---|---|
| `PENDING` | `APPROVED`, `REJECTED`, `PENDING` |
| `APPROVED` | `APPROVED`, `REJECTED`, `PENDING` |
| `REJECTED` | `REJECTED`, `APPROVED`, `PENDING` |

The map is intentionally **permissive / self-looping** to preserve the existing
ability to re-record an admin decision without breaking the route. The
loan-admin executor performs the `gm_loan_terms` UPDATE on the tx client, so the
gate flip and its history row are atomic. The executor also reads + locks the
gate row (`SELECT … FOR UPDATE`) inside the transaction and derives the recorded
`previousStatus` from the locked row, so history stays accurate even under
concurrent admin decisions (the outer pre-read only feeds the permissive
validation). Loan-admin **reject** requires a reason (`requireReason`).

---

## Invoice workflow — `INVOICE_LEGAL_TRANSITIONS`
| From | Allowed → |
|---|---|
| `DRAFT` | `PENDING_HOD`, `CANCELLED` |
| `PENDING_HOD` | `PENDING_ACCOUNT`, `REJECTED`, `CANCELLED` |
| `PENDING_ACCOUNT` | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | (terminal — project generation is post-commit best-effort) |
| `REJECTED` / `CANCELLED` | terminal |

- **HOD approve**: `PENDING_HOD → PENDING_ACCOUNT`. **HOD reject**:
  `PENDING_HOD → REJECTED` (reason).
- **Account approve**: `PENDING_ACCOUNT → APPROVED`; project generation runs
  **after** commit, best-effort, so an approval never fails on a generation
  hiccup (Stage 4/5 contract). **Account reject**: `PENDING_ACCOUNT → REJECTED`
  (reason).
- The legacy `PUT /:id/approve` resolves the stage and routes through the same
  central service.

---

## Product-Posting milestones (no canonical map — recorded only)
- **LP-QA dependency release**: when a Listing-Page project's QA completes,
  held Product-Posting root projects flip `OnHold → <configured initial status>`
  (action `PP_DEPENDENCY_RELEASED`). The flip is a **conditional** `UPDATE …
  WHERE status='OnHold' … RETURNING` run **inside** the central transaction: if it
  changes 0 rows (the project was already released — i.e. this caller lost the
  race, or was never held) the executor throws a sentinel that rolls the
  would-be-spurious history row back and the iteration is treated as a no-op. So
  the flip + history row are atomic, race-safe, and a history row is written
  **iff** a real release happened — no false or duplicate ledger entries. No-op
  when the `requireProductPostingWaitForListingQa` config is off (no dependency
  rows exist).
- **Verification complete**: `VERIFICATION_PENDING → VERIFICATION_COMPLETE`
  recorded as a post-commit milestone; the PP workflow engine
  (`transitionWorkflowByTask`) still owns its own transaction and
  `task_status_history`.
