# Partial GM Receipt Workflow (P4)

How a **partial-payment GM** is collected over time and only granted final
approval once it is fully paid. This is additive — a FULL GM is completely
unaffected.

## What makes a GM "partial"

A GM row in `drm.gm_entries` has the integer flag `is_partial_payment = 1`.
(All such flags are INTEGER — compare with `= 1`.) The **payment target** is
`COALESCE(customer_dollar, amount_usd, 0)` in USD.

## The receipt ledger

Every collected installment is a row in `drm.gm_partial_receipts`
(`gm_id`, `amount_usd`, optional `amount_pkr` / `dollar_rate` / `method` /
`reference` / `notes`, `receipt_date`, `collected_by`). There is no FK on
`gm_id` (gm ids are varchar); receipts are linked by id.

### Payment summary
For any partial GM the summary is computed live:

```
paid       = SUM(gm_partial_receipts.amount_usd)
remaining  = target - paid
fullyPaid  = remaining <= 0
```

## Step-by-step

1. **Open the GM.** In `account-gm-entries.tsx` a partial GM shows a **Wallet**
   action that opens `PartialReceiptsDialog`.
2. **Record a receipt** — `POST /api/gm-pool/:id/partial-receipts`.
   - Permission: `GM_ADD_PARTIAL_RECEIPT`.
   - The amount cannot exceed the outstanding balance (`RECEIPT_EXCEEDS_BALANCE`,
     409).
   - The GM must actually be partial (`NOT_PARTIAL_GM`, 409).
   - Audit: `gm.partial_receipt_add` (records the receipt id + new summary).
3. **Track progress.** `GET /api/gm-pool/:id/partial-receipts` returns the full
   receipt list and the live `{ target, paid, remaining, fullyPaid }` summary.
4. **Confirm fully paid** — `POST /api/gm-pool/:id/finalize-partial`.
   - Permission: `GM_FINALIZE_PARTIAL`.
   - Requires `remaining <= 0`, else `PARTIAL_PAYMENT_INCOMPLETE` (409).
   - **Does NOT set `final_status`.** It only validates and unlocks the GM so it
     can proceed through the *normal* approval routes. Audit:
     `gm.partial_final_approve`.
5. **Final approval** happens through the existing approval chain, exactly as for
   a FULL GM. The new gate (see below) simply refuses to flip a partial GM to
   final while a balance remains.

## The final-approval gate

`enforceLoanPartialFinalApprovalGate(id)` runs at every final-approval surface,
**after** the existing approval-threshold check:

- For a partial GM with `remaining > 0` it returns **409
  `PARTIAL_PAYMENT_INCOMPLETE`** (with `{ target, paid, remaining }`).
- For a FULL GM it is a no-op.

Surfaces:

| Route | On incomplete balance |
| --- | --- |
| account-manager-approve (`gm-pool`) | 409 |
| super-hod-approve (`gm-pool`) | 409 |
| Accounts approve (`account-routes`) | 409 |
| sales-manager-approve (`gm-pool`) | SM approval **is still recorded**; response is `{ success: true, finalApprovalBlocked: true, code, message }` so the stage is not lost |

The client shows these 409 messages automatically through the shared mutation
error extraction — no special handling per button.

## States summary

| Condition | Final approval |
| --- | --- |
| `is_partial_payment <> 1` (FULL) | unaffected — works as today |
| partial, `remaining > 0` | blocked (`PARTIAL_PAYMENT_INCOMPLETE`) |
| partial, `remaining <= 0` | allowed through the normal routes |

## Permissions & audit actions

| Action | Permission key | Audit action |
| --- | --- | --- |
| Add receipt | `GM_ADD_PARTIAL_RECEIPT` | `gm.partial_receipt_add` |
| Confirm fully paid | `GM_FINALIZE_PARTIAL` | `gm.partial_final_approve` |
