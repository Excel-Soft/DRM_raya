# Loan GM Workflow (P5)

How a **loan GM** records its loan terms, obtains **Admin (Super HOD) approval**
before final approval, and is tracked through return / overdue. Additive — a FULL
GM is completely unaffected.

## What makes a GM a "loan"

A GM row in `drm.gm_entries` has the integer flag `is_loan = 1`. (All such flags
are INTEGER — compare with `= 1`.) Its loan terms live in **one** row of
`drm.gm_loan_terms` (`gm_id` is `UNIQUE`).

## Loan terms

`drm.gm_loan_terms` holds: `loan_amount_usd`, `company_copay_usd`,
`agreed_return_date`, the admin-approval fields (`admin_approval_status`,
`admin_approved_by`, `admin_approved_at`, `admin_comment`), and the return-tracking
fields (`return_status`, `returned_at`). `admin_approval_status` and
`return_status` both default to `PENDING`.

## Step-by-step

1. **Open the GM.** In `account-gm-entries.tsx` a loan GM shows a **Landmark**
   action that opens `LoanTermsDialog`.
2. **Record / edit loan terms** — `POST` or `PATCH /api/gm-pool/:id/loan-terms`.
   - Permission: `GM_UPDATE_LOAN_RETURN`. Must be a loan GM (`NOT_LOAN_GM`, 409).
   - Audit: `gm.loan_terms_add`.
   - **Re-arming rule:** changing a *financial* term (`loan_amount_usd` or
     `company_copay_usd`) resets `admin_approval_status` back to `PENDING` and
     clears the prior approver. Editing **only** the `agreed_return_date` keeps an
     existing approval intact.
3. **Admin review.** Loan GMs awaiting sign-off appear in
   `GET /api/gm-pool/loan-admin-queue` (loan GMs with
   `admin_approval_status = 'PENDING'`), surfaced on the **Super HOD dashboard**
   via `LoanAdminQueuePanel`.
   - **Approve** — `POST /api/gm-pool/:id/loan-admin-approve`
     (permission `GM_APPROVE_ADMIN`, audit `gm.loan_admin_approve`). Sets status
     `APPROVED`, stamps approver/time, notifies the salesperson. Loan terms must
     exist first (`LOAN_TERMS_MISSING`, 409).
   - **Reject** — `POST /api/gm-pool/:id/loan-admin-reject` (a reason is
     **required**). Sets status `REJECTED`.
4. **Final approval** then proceeds through the existing approval chain. The gate
   refuses to flip a loan GM to final unless its terms are `APPROVED`.
5. **Return tracking** — `PATCH /api/gm-pool/:id/loan-return`
   (permission `GM_UPDATE_LOAN_RETURN`, audit `gm.loan_return_update`). Sets
   `return_status` to `PENDING` / `RETURNED` / `OVERDUE`; `RETURNED` stamps
   `returned_at`. Can also adjust `agreed_return_date`.
6. **Oversight report** — `GET /api/gm-pool/loan-return-report` lists every loan
   GM with a **derived status** and `daysOverdue`:
   - `RETURNED` when `return_status = 'RETURNED'`;
   - `OVERDUE` when not returned and `agreed_return_date < CURRENT_DATE`;
   - else `PENDING`.
   It also returns a `{ total, returned, overdue, pending }` summary (shown in the
   dashboard panel).

## The final-approval gate

`enforceLoanPartialFinalApprovalGate(id)` runs at every final-approval surface,
**after** the existing approval-threshold check:

- For a loan GM whose `admin_approval_status <> 'APPROVED'` it returns **409
  `LOAN_ADMIN_APPROVAL_REQUIRED`** (with `{ adminApprovalStatus }`). A missing
  loan-terms row counts as not-approved (`NONE`).
- For a FULL GM it is a no-op.

Surfaces:

| Route | When terms not admin-approved |
| --- | --- |
| account-manager-approve (`gm-pool`) | 409 |
| super-hod-approve (`gm-pool`) | 409 |
| Accounts approve (`account-routes`) | 409 |
| sales-manager-approve (`gm-pool`) | SM approval **is still recorded**; response is `{ success: true, finalApprovalBlocked: true, code, message }` |

The client surfaces these 409 messages automatically via the shared mutation
error extraction.

## States summary

| Condition | Final approval |
| --- | --- |
| `is_loan <> 1` (FULL) | unaffected — works as today |
| loan, terms `PENDING` / `REJECTED` / missing | blocked (`LOAN_ADMIN_APPROVAL_REQUIRED`) |
| loan, terms `APPROVED` | allowed through the normal routes |

## Permissions & audit actions

| Action | Permission key | Audit action |
| --- | --- | --- |
| Record / edit loan terms | `GM_UPDATE_LOAN_RETURN` | `gm.loan_terms_add` |
| Admin approve / reject | `GM_APPROVE_ADMIN` | `gm.loan_admin_approve` |
| Update return status | `GM_UPDATE_LOAN_RETURN` | `gm.loan_return_update` |
