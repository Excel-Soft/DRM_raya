# GM Default Invoice Generation Rules (Patch 5 — Stage 4, P6)

Rules for **when** and **how** the 3 default invoices for a GM are generated, and
how generation stays **idempotent**. Implemented in
`server/services/gm-invoice-generation.service.ts` over the canonical table
`drm.product_posting_invoices`.

---

## 1. What gets generated

For each eligible GM, **3 canonical default invoices** are created — one per
invoice type:

- `LISTING_PAGE`
- `MINIWEBSITE`
- `PRODUCT_POSTING`

Auto-generated rows are created with `amount = 0` and `status = PENDING_HOD`, and
are stamped with:

- `auto_generated = true`
- `generated_by` (actor user id, when available)
- `generated_at`
- `generation_event` (the event that produced them)

A best-effort audit entry is written per created invoice for a queryable trail.

## 2. When it fires — timing config

Generation timing is controlled by a single config key,
`gmInvoiceGenerationTiming` (from `shared/gm-sales-constants.ts`):

| Value                     | Meaning                                              |
| ------------------------- | --------------------------------------------------- |
| `ON_GM_CREATION` (default) | Generate the 3 invoices when the GM is created.     |
| `AFTER_FINAL_GM_APPROVAL` | Generate them only after final GM approval instead. |

- `generateDefaultInvoicesForGm({ gmId, event, actorUserId, req })` generates
  **only** when the passed `event` matches the configured timing; otherwise it
  no-ops (a timing mismatch is a successful no-op, not an error).
- The default is `ON_GM_CREATION`, so **current behavior is preserved** with no
  config change.
- `generateInvoicesAfterFinalGmApproval(...)` is the thin wrapper for the
  `AFTER_FINAL_GM_APPROVAL` event. It is **dormant by default** and wired at the
  final GM approval surfaces, so switching the config takes effect without code
  changes.

## 3. Idempotency — no duplicate invoices

- A **partial unique index** on `(gm_id, invoice_type)` where
  `auto_generated AND gm_id IS NOT NULL` guarantees at most one auto-generated
  invoice per (GM, type).
- Re-running generation for the same GM creates **0** duplicates.
- **Caveat:** idempotency holds only when `gm_id` is set. Two of the wired call
  sites cannot supply a GM id (the account-wallet path and the BV-pool
  repository path) and pass `gmId = null`; for those, the unique index does not
  apply. This matches the pre-existing call-site constraints and is intentional
  for this thin stage.

## 4. Best-effort wiring (never breaks GM creation)

Generation is delegated from the existing default-invoice creation call sites as
a **best-effort** step: if generation throws, the error is swallowed (logged)
and GM creation proceeds. This keeps the critical GM-creation path unaffected by
invoice-generation issues.

## 5. Scope boundaries

- **No** invoice → project generation — that is Stage 5.
- The workflow state machine and transition map are unchanged.
- Schema additions are applied via idempotent runtime DDL at boot
  (`ensureInvoiceStage4Schema()`), because `npm run db:push` is broken repo-wide
  on a pre-existing FK type mismatch.
