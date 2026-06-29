# GM Full / Partial / Loan State Machine

**Date:** 2026-06-29 (Patch 7 — Stage 2)

This document describes the GM lifecycle along the **payment-type** dimension
(Full vs Partial-payment vs Loan) and how each type gates **final approval**. The
base approval graph (Sales → HOD → Managers / Super HOD) is documented in
`GM_SALES_STATE_MACHINE.md`; this file focuses on the type-specific gates and the
role guards hardened in Patch 7 Stage 2.

## Source of truth

| Concern | Location |
| --- | --- |
| GM types | `shared/gm-sales-constants.ts` (`GM_TYPES` = FULL / PARTIAL / LOAN) |
| Type flags on the row | `drm.gm_entries.is_loan`, `is_partial_payment` |
| Approval transitions + final-approval gate | `server/gm-pool-routes.ts` |
| Final-approval gate | `enforceLoanPartialFinalApprovalGate` (`server/gm-pool-routes.ts`) |
| Partial receipts (append-only) | `gm_partial_receipts` + the partial-receipts routes |
| Loan terms / loan-admin approval | `gm_loan_terms` + the loan-admin routes |
| Route-level role guards | `requireGmSalesActionPermission` + `server/utils/gm-sales-permissions.ts` |

## GM type derivation

A GM row carries two boolean-ish flags rather than a free-text type:

- **FULL** — `is_loan = 0`, `is_partial_payment = 0`. Paid in full up front.
- **PARTIAL** — `is_partial_payment = 1`. Paid in instalments recorded as receipts.
- **LOAN** — `is_loan = 1`. Goods/services advanced against a loan with terms and a
  return/repayment schedule.

The DB `gm_type` stays `GM` (vs `TempGM` / `RefundGM`); the payment dimension lives
in the two flags. `classifyGmPaymentType` (`shared/gm-sales-constants.ts`) maps a
requested type to `{ isLoan, isPartialPayment }`.

## Base approval chain (all types)

```
created
  └─ approval_status = 'pending_hod'
        │  POST hod-approve   [GM_APPROVE_HOD]
        ▼
     'pending_managers'  (account_manager_status='pending', sales_manager_status='pending')
        │  POST account-manager-approve [GM_APPROVE_ACCOUNTS]   ← FINAL flip, GATED
        │  POST sales-manager-approve   [GM_APPROVE_SALES_MANAGER]
        ▼
     'approved' / final_status='approved'      (high-value GMs route to Super HOD:
        │                                        'pending_super_hod'
        │  POST super-hod-approve [GM_APPROVE_ADMIN]  ← FINAL flip, GATED)
        ▼
     approved
```

Rejections at any stage move to the corresponding `rejected_by_*` /
`final_status='rejected'` terminal state. Each transition keeps its existing SQL
`WHERE` stage guard (e.g. `... AND approval_status = 'pending_hod'`), so an
out-of-order call is a no-op (404 "already processed"). Patch 7 added the **role**
guard at the route layer; it did not change any transition SQL.

## Type-specific FINAL-approval gate

`enforceLoanPartialFinalApprovalGate(gmId)` runs immediately before the **final**
approval flip (account-manager-approve / super-hod-approve). It is a no-op for FULL
GMs and blocks final approval for unfinished PARTIAL / LOAN GMs:

### FULL
- No extra gate. Once HOD + the required manager(s) approve, the GM is approved.

### PARTIAL (`is_partial_payment = 1`)
- Target = `COALESCE(customer_dollar, amount_usd, 0)`.
- Paid = `SUM(gm_partial_receipts.amount_usd)` for the GM.
- **Final approval is blocked while `target - paid > 0`** (HTTP 400 with the
  outstanding balance in `details`). Receipts must be recorded until fully paid.
- **Receipts are append-only** — there is no receipt edit/delete; a correction is a
  new receipt, preserving the audit trail. The running summary (target / received /
  remaining) is returned by `GET .../partial-receipts` (`loadPartialSummary`).

### LOAN (`is_loan = 1`)
- Loan terms (`gm_loan_terms`) must be set and **loan-admin approval** granted
  before final approval; an un-admin-approved loan is blocked by the same gate.
- Loan return / repayment is tracked and reported via the loan-admin queue and the
  loan-return report (no separate `/api/reports/gm-loans` endpoint — that surface is
  already covered).

## Role guards (Patch 7 Stage 2)

Every mutating transition is now role-guarded via `requireGmSalesActionPermission`
(fail-closed, `admin` bypass, denials audited). Authentication alone is no longer
sufficient to drive an approval. See the mapping table in
`PATCH7_STAGE2_INVOICE_GM_SALES_CHANGELOG.md` §2. Raw `approval_status` override
(`fix-status`) is admin-only break-glass and audited (`gm.fix_status`).

## Invariants

- A transition is legal only if **both** the SQL stage guard (correct current
  status) **and** the role guard (correct actor role) pass.
- Final approval cannot be granted to a PARTIAL GM with an outstanding balance, or
  to a LOAN GM without loan-admin approval.
- Partial-receipt history is immutable (append-only).
- No status column is writable from a raw client status except via the dedicated
  transition endpoints (and the admin-only audited break-glass).
