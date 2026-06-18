# Patch 5 Stage 3 — Partial GM Receipts (P4) + Loan GM Admin Approval & Return Tracking (P5)

A **thin, additive layer** over the existing GM (Gross Margin) workflow. It adds
first-class partial-payment receipt tracking and loan-GM admin approval / return
tracking **without** changing any existing business logic.

## Guarantees / Non-goals

- **FULL GMs behave exactly as today.** Every new gate is a no-op for any GM that
  is neither partial nor loan (`is_partial_payment <> 1 AND is_loan <> 1`).
- **No invoice or project changes.** Nothing in the invoice/project pipeline was
  touched.
- **No bypass of the existing HOD / Accounts approval routes.** The normal
  approval chain (account-manager → sales-manager → super-hod, and the Accounts
  approve route) is untouched. We only *block the final flip* for incomplete
  partial / un-admin-approved loan GMs; all earlier stages are recorded as before.
- **No final approval of a partial GM until it is fully paid.**
- **No final approval of a loan GM without Admin (Super HOD) approval of its
  loan terms.**
- `db:push` is broken repo-wide (pre-existing FK mismatch), so schema is applied
  at runtime via idempotent DDL in `server/db/ensure.ts`, **not** Drizzle push.

## Schema (T001)

Two new tables in schema `drm`, created idempotently by
`ensureGmStage3Schema()` (called from `ensureDbOnce()` in `server/db/ensure.ts`).
Type-only Drizzle defs were added to `shared/schema.ts`.

### `drm.gm_partial_receipts` (P4)
One row per recorded partial payment against a partial-payment GM.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `varchar` PK | `gen_random_uuid()` |
| `gm_id` | `varchar` NOT NULL | references the GM by id; **no FK** (gm ids are varchar) |
| `amount_usd` | `numeric(12,2)` NOT NULL | receipt amount in USD |
| `amount_pkr` | `numeric(15,2)` | optional |
| `dollar_rate` | `numeric(12,4)` | optional |
| `receipt_date` | `timestamp` NOT NULL | defaults to `now()` |
| `method`, `reference`, `notes` | `text` | optional |
| `collected_by` | `uuid` FK → `drm.users(id)` | actor |
| `created_at` | `timestamp` NOT NULL | |

Indexes: `gm_id`, `receipt_date`, `collected_by`.

### `drm.gm_loan_terms` (P5)
Exactly one row per loan GM (`gm_id` is `UNIQUE`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `varchar` PK | `gen_random_uuid()` |
| `gm_id` | `varchar` NOT NULL UNIQUE | the loan GM; **no FK** |
| `loan_amount_usd` | `numeric(12,2)` NOT NULL | default 0 |
| `company_copay_usd` | `numeric(12,2)` NOT NULL | default 0 |
| `agreed_return_date` | `date` | optional |
| `admin_approval_status` | `text` NOT NULL | `PENDING` \| `APPROVED` \| `REJECTED` (default `PENDING`) |
| `admin_approved_by` | `uuid` FK → `drm.users(id)` | |
| `admin_approved_at` | `timestamp` | |
| `admin_comment` | `text` | |
| `return_status` | `text` NOT NULL | `PENDING` \| `RETURNED` \| `OVERDUE` (default `PENDING`) |
| `returned_at` | `timestamp` | |
| `created_by` | `uuid` FK → `drm.users(id)` | |
| `created_at`, `updated_at` | `timestamp` NOT NULL | |

Indexes: `admin_approval_status`, `return_status`, `agreed_return_date`.

> `is_partial_payment` and `is_loan` on `drm.gm_entries` are stored as **INTEGER**
> flags — always compare with `= 1`.

## Final-approval gate (T002)

`enforceLoanPartialFinalApprovalGate(id)` is defined in **both**
`server/gm-pool-routes.ts` and `server/account-routes.ts` (returning the legacy
`{ error, code, details }` shape so the existing client error extraction surfaces
it). It:

1. Loads the GM; if missing → `{ ok: true }` (route's own 404 handles it).
2. FULL GM (neither partial nor loan) → `{ ok: true }` (no-op).
3. PARTIAL GM with `remaining > 0` → `409 PARTIAL_PAYMENT_INCOMPLETE`.
4. LOAN GM whose `gm_loan_terms.admin_approval_status <> 'APPROVED'` →
   `409 LOAN_ADMIN_APPROVAL_REQUIRED`.

Wired at the four final-approval surfaces, **after** `enforceApprovalThreshold`:

| Surface | Behaviour when gated |
| --- | --- |
| `gm-pool` account-manager-approve | returns the 409 |
| `gm-pool` super-hod-approve | returns the 409 |
| `account-routes` approve | returns the 409 |
| `gm-pool` sales-manager-approve | **non-erroring hold** — SM status is still recorded, response is `{ success: true, finalApprovalBlocked: true, code, message }` so the SM stage is not lost |

## Endpoints (T003 / T004)

All new endpoints use the standard `sendSuccess` / `sendError` envelope, zod
validation, the `requireGmSalesActionPermission` guard, and write a
`recordGmSalesAudit` entry.

### Partial receipts (P4)
- `GET  /api/gm-pool/:id/partial-receipts` — receipts + summary
  (`{ target, paid, remaining, fullyPaid }`).
- `POST /api/gm-pool/:id/partial-receipts` — guard `GM_ADD_PARTIAL_RECEIPT`;
  audit `gm.partial_receipt_add`. Rejects overpayment (`RECEIPT_EXCEEDS_BALANCE`).
- `POST /api/gm-pool/:id/finalize-partial` — guard `GM_FINALIZE_PARTIAL`;
  audit `gm.partial_final_approve`. Requires `remaining <= 0`; validates/unlocks
  only — **does not set `final_status`**.

### Loan terms / admin approval / return (P5)
- `GET   /api/gm-pool/:id/loan-terms`
- `POST` / `PATCH /api/gm-pool/:id/loan-terms` — guard `GM_UPDATE_LOAN_RETURN`;
  audit `gm.loan_terms_add`. Changing a **financial** term re-arms the gate
  (status back to `PENDING`); editing only the return date keeps the approval.
- `GET   /api/gm-pool/loan-admin-queue` — loan GMs still pending admin approval.
- `POST  /api/gm-pool/:id/loan-admin-approve` — guard `GM_APPROVE_ADMIN`;
  audit `gm.loan_admin_approve`; notifies the salesperson.
- `POST  /api/gm-pool/:id/loan-admin-reject` — guard `GM_APPROVE_ADMIN`; reason
  required; audit `gm.loan_admin_approve`.
- `PATCH /api/gm-pool/:id/loan-return` — guard `GM_UPDATE_LOAN_RETURN`;
  audit `gm.loan_return_update`.
- `GET   /api/gm-pool/loan-return-report` — return / overdue tracking with a
  derived status and `daysOverdue`.

## Frontend (T005)

- `client/src/components/gm/PartialReceiptsDialog.tsx` — list, add receipt,
  finalize; shows target / paid / remaining.
- `client/src/components/gm/LoanTermsDialog.tsx` — view/edit loan terms, admin
  approve/reject, update return status.
- `client/src/components/gm/LoanAdminQueuePanel.tsx` — Super-HOD dashboard panel:
  pending admin-approval queue + return/overdue summary; opens `LoanTermsDialog`.
- `client/src/pages/account-gm-entries.tsx` — per-row action buttons
  (Wallet → partial receipts when `isPartialPayment`, Landmark → loan terms when
  `isLoan`) plus dialog wiring. Existing approve buttons already surface the
  backend 409 messages via the shared mutation error extraction.
- `client/src/pages/super-hod-dashboard.tsx` — mounts `LoanAdminQueuePanel`.

## Files touched

- `shared/schema.ts` — type-only table defs.
- `server/db/ensure.ts` — `ensureGmStage3Schema()` DDL.
- `server/gm-pool-routes.ts` — gate helper, 3 wired gates, all new endpoints.
- `server/account-routes.ts` — gate helper + approve gate.
- `server/services/gm-sales-audit.ts` — new audit action constants.
- `client/src/pages/account-gm-entries.tsx`, `super-hod-dashboard.tsx`.
- `client/src/components/gm/PartialReceiptsDialog.tsx`,
  `LoanTermsDialog.tsx`, `LoanAdminQueuePanel.tsx`.
- Docs: this file, `PARTIAL_GM_RECEIPT_WORKFLOW.md`, `LOAN_GM_WORKFLOW.md`.
