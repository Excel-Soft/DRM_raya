# GM / BV Workflow — Current Implementation

This document describes the **GM (Gold Member)** and **BV (Business Verification)**
workflow exactly as it exists in the codebase today — including the parts that are
broken or stubbed out. Every claim below is backed by a specific file and line
number so it can be re-verified directly against the source.

> **Scope note:** This describes the *as-built* system, not the originally
> intended design. Several pieces (marked ⚠️ below) are present in the schema
> or route surface but do not actually work in this checkout.

---

## 1. Glossary

| Term | Meaning in this codebase |
|---|---|
| **GM** | "Gold Member" — a sale recorded in `drm.gm_entries`. Comment: *"GM Entries (GM, Temp GM, Refund GM)"* (`schema.ts:1204`). |
| **BV** | "Business Verification" — a separate report entity in `drm.bv_reports` (`schema.ts:2539`), tracking fields like `valueSold`, `successRate`, `followUpsDone`, `missedLeads`. |
| **GM type (`gm_type`)** | DB enum: `GM`, `TempGM`, `RefundGM` — distinguishes which *table family* a record belongs to (`schema.ts:1193`). |
| **Canonical GM type** | A separate classification: `FULL`, `PARTIAL`, `LOAN` (`gm-sales-constants.ts:21-27`). Stored via two integer flags (`is_loan`, `is_partial_payment`), **not** via `gm_entry_type`. |
| **GM Doc / GM BV** | Two one-time submission timestamps living directly on a `gm_entries` row (`gm_doc_submitted_at`, `gm_bv_submitted_at`) — a two-step checklist, not the `bv_reports` table. |

**GM vs. BV relationship:** they are **sibling entities merged for display**, not a
two-step pipeline. The "GM/BV Pool" screen runs two independent queries — one
against `bv_reports`, one against `gm_entries` — and unions them with `bv_`/`gm_`
id prefixes (`gm-bv-pool.repository.ts:159-245`). The only genuine two-step
relationship is the `gm_doc_submitted_at` → `gm_bv_submitted_at` pair *within* a
single GM row (`sales-routes.ts:4200-4247`); the BV doc step is blocked until the
GM doc step is done.

---

## 2. Data model

### `drm.gm_entries` (declared columns — `schema.ts:1205-1268`)

Core fields: `id`, `gmType`, `drmId`, `memberId`, `orderId`, `companyName`,
`salesPersonId/Name`, `packageType`, `entryType`, `packagePriceUsd`,
`customerDollar`, `dollarRate`, `amountPkr`, `alibabaDiscountUsd`,
`finalOrderUsd`, `extraDiscountUsd/Pkr/Hod`, `installments` (jsonb),
`paymentStatus`, **`status`** (enum `Pending | Approved | Rejected | Completed`,
default `Pending`), `isLoan`, `isPartialPayment`, `createdBy/Role`, timestamps.

**Important:** the real multi-stage approval state is *not* in this declared
schema — it's bolted on at runtime via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
in `ensureGmEntriesColumns()` (`gm-pool-routes.ts:236-300`):

`approval_status`, `final_status`, `account_manager_status`, `hod_status` (+
`approved_at/by`, `comment`), `sales_manager_status` (+ `approved_at/by`,
`comment`), `super_hod_status` (+ `actioned_at/by`), `withdrawal_status/reason` (+
`requested_at/by`, `actioned_at/by`), `update_request_status`,
`payment_proof_url`, `alibaba_status`, `dropout`, `extension`.

These free-text columns — not Postgres enums — are the real state machine.

### Related tables

- `drm.gm_partial_receipts` — partial-payment receipts against a GM (`schema.ts:1276-1292`).
- `drm.gm_loan_terms` — one row per Loan GM; `admin_approval_status` default `PENDING`, `return_status` default `PENDING` (`schema.ts:1299-1318`).
- `drm.bv_reports` — the sibling BV report entity (`schema.ts:2539`).

---

## 3. The entry lifecycle

### Creation

| Entry point | File:Line | Who can create | Notes |
|---|---|---|---|
| `POST /api/gm` | `gm-pool-routes.ts:800` | `sales_executive` (per-GM-type role list), `admin`/`super_hod` override | Dedupes on company + member ID + order ID. Starts at `status='Pending'`, `approval_status='pending_hod'`. **No invoices generated at this step.** |
| `POST /api/account/gm-entries` | `account-routes.ts:1484` | `account_manager`, `hod`, `super_hod`, `sales_manager` | Parallel creation path for the Accounts module. Does **not** set `approval_status` on insert — HOD's queue treats `NULL` the same as `pending_hod` (`hod-routes.ts:440`). |

### Approval chain

```
pending_hod ──(HOD approve)──► pending_managers ──(Account Mgr approve)──► approved ──► PROJECT CREATED
     │                                │
     ├─(HOD reject)──► rejected_by_hod            ├─(Account Mgr reject)──► rejected_by_account_manager
     │                                │
     └───(resubmit)◄──────────────────┘           ├─(Sales Mgr approve, parallel)──► sales_manager_status=approved
                                                   └─(Sales Mgr reject)──► rejected_by_sales_manager

pending_super_hod ──(Super HOD approve)──► approved     (reached only via the Accounts-module path)
                  └─(Super HOD reject)──► rejected_by_super_hod
```

1. **HOD stage** — `POST /gm-pool/:id/hod-approve` / `hod-reject` (`gm-pool-routes.ts:1459,1547`, role `hod`/`super_hod`).
   Approval requires all core fields filled and `extraDiscountHod` to *exactly*
   match the sales-requested discount (±0.01). On approval: flips to
   `pending_managers`, sets `account_manager_status`/`sales_manager_status` to
   `pending`, and **unconditionally generates the 3 default invoices** (see §4).
   Rejection requires a reason; a rejected entry can be edited and resubmitted
   by the creator (`PATCH /gm-pool/:id`, `gm-pool-routes.ts:1237`), which resets
   it back to `pending_hod`.

2. **Account Manager stage** — `POST /gm-pool/:id/account-manager-approve` /
   `-reject` (`gm-pool-routes.ts:1598,1671`, role `account_manager`). This is a
   **final/terminal approval** — it alone can fully approve the GM
   (`status='Approved'`, `final_status='approved'`); it doesn't wait on the
   Sales Manager.

3. **Sales Manager stage (parallel)** — `POST /gm-pool/:id/sales-manager-approve`
   / `-reject` (`gm-pool-routes.ts:1694,1779`, role `sales_manager`). Records its
   own sign-off; if Account Manager has *already* approved, this call completes
   the final flip too. ⚠️ `sales_manager_status` is never initialized to
   `pending` anywhere in the creation path — per an in-code comment, this route
   is "only ever consumed in view-only mode" in practice.

4. **Super HOD stage** — `POST /gm-pool/:id/super-hod-approve` / `-reject`
   (`gm-pool-routes.ts:1889,1931`, role `super_hod`). Only reached via the
   Accounts-module entry point.

### Withdraw & update-request sub-flows

- **Withdraw**: creator requests (`POST /gm-pool/:id/request-withdraw`, reason
  required) → HOD approves or rejects (`/withdraw-approve`, `/withdraw-reject`,
  `gm-pool-routes.ts:2155,2208`). Approval is treated the same as a HOD
  rejection (`status='Withdrawn'`) **and hard-deletes any already-generated
  invoices** for that GM in the same transaction.
- **Update request**: creator requests a field-change approval while already
  `approved` (`POST /gm-pool/:id/request-update`). ⚠️ The intended Super-HOD
  approve/reject endpoints for this (`gm-pool-routes.ts:2047,2073`) are
  **shadowed/dead code** — an earlier route registered at the same method+path
  (the final-approval handler) always wins. The live path for this actually
  runs under `/api/hod/`.

### Delete

`DELETE /gm-pool/:id` (`gm-pool-routes.ts:2324`) — blocked once HOD-approved
("HOD approved GM entries cannot be deleted"). Soft-deletes the GM and
hard-deletes any linked invoices in the same transaction.

### Partial GM

Receipts recorded via `GET/POST /gm-pool/:id/partial-receipts` and
`installments`. `POST /gm-pool/:id/finalize-partial` confirms the GM is fully
paid (role `account_manager`/`hod`/`super_hod`). ⚠️ The receipt-sum enforcement
that's supposed to block final approval until fully paid is **explicitly
disabled** in code — see §5.

### Loan GM

Loan terms via `GET/POST/PATCH /gm-pool/:id/loan-terms`. The admin
approval gate (`POST /loan-admin-approve` / `loan-admin-reject`,
`gm-pool-routes.ts:2906,2996`, role `super_hod`) is **broken** — see §5.

---

## 4. Invoice generation

`generateDefaultInvoicesForGm()` (`gm-invoice-generation.service.ts:3-59`)
inserts **exactly 3** rows into `drm.product_posting_invoices` for every GM:

| Invoice type | Product name |
|---|---|
| `PRODUCT_POSTING` | Alibaba Product Posting |
| `MINIWEBSITE` | Alibaba Minisite |
| `LISTING_PAGE` | Listing Page |

Each is created with `amount=0`, `status='PENDING_HOD'`, `auto_generated=true`,
linked via `gm_id`. ⚠️ **There is no duplicate guard** — nothing stops the same
GM from accumulating a second set of 3 invoices if the generator is called
twice (the withdraw-approve flow specifically deletes the old set first to
avoid this, but other call sites don't).

This generator fires at **every** approval stage (HOD, Account Manager, Sales
Manager final branch, Super HOD) — not gated by the `gmInvoiceGenerationTiming`
config flag that exists for this purpose (`ON_GM_CREATION` vs
`AFTER_FINAL_GM_APPROVAL`); that flag is simply never read by the live code.

An invoice linked to a GM cannot be account-approved until the GM itself is
approved — `product-posting-workflow-routes.ts:188-193` returns 400 ("Approve
the GM itself before approving this invoice") if `gmApprovalStatus !== 'approved'`.

---

## 5. ⚠️ Known gaps in this checkout

A number of supporting services carry the comment *"STUB: real implementation
missing from this checkout (broken MVC-restructure commit)"* and are no-ops
that never call back into real logic. Here's what that actually breaks:

| Area | What's broken | Impact |
|---|---|---|
| **Loan admin approval** | `transitionWorkflowStatus` stub never invokes the callback that updates `gm_loan_terms.admin_approval_status` | `POST /loan-admin-approve` and `/loan-admin-reject` **always throw a 500**. A Loan GM can never pass its admin gate, and since final approval is hard-blocked without it, **a Loan GM can never reach final approval** through the current UI. |
| **Notifications** | `NotificationService.notify()` is a no-op | Every "your GM was approved/rejected" notification is coded but never delivered. Some of the target URLs referenced don't even match a real frontend route. |
| **Audit trail** | `recordGmSalesAudit` is a no-op | No audit log is written for GM create/reject/approve actions despite the code calling it everywhere. |
| **Cross-department ledger** | `CrossDepartmentStatusService.onGmApproved()` is a no-op | Downstream department status sync on GM approval doesn't happen. |
| **Config persistence** | `gm-sales-config.service.ts`'s `patchConfig()` merges and returns an object but never saves it | Any settings UI for GM rules (allowed initiator roles, loan toggle, thresholds) has **no lasting effect** — the next read returns the hardcoded defaults again. |
| **Creation guardrails** | `gm-create-policy.service.ts`'s threshold/loan-enabled checks always return `{ok:true}` | Minimum-payment thresholds and the loan-enabled kill-switch are effectively disabled regardless of configuration. |
| **Partial/Full payment gate** | `enforceLoanPartialFinalApprovalGate`'s receipt-sum check is wrapped in a `BYPASS FOR TESTING` block | Full/Partial GMs can be finally approved **without** their balance being fully paid; only the (separately broken) Loan gate is still "live." |
| **Approval scope** | `gmApprovalScopeClause()` hard-returns an empty string ("Temporary bypass for testing: allow all users to approve any GM entry") | **Any user whose role passes the role gate (e.g. any `hod`) can approve/reject any GM entry system-wide**, not just their own department's — despite a fully-built "own department only" scope resolver existing and simply not being called at the approval sites. |
| **GM commission** | `gm-commission.service.ts` is a stub; `/api/target-system/gm-commission/*` is an empty router (404s); the dashboard's "My GM Commission" widget is a static placeholder | There is **no automated commission calculation** anywhere in the live system. |

### What *does* work

The raw SQL state transitions themselves — create, HOD/Account/Sales-Manager/
Super-HOD approve & reject, withdraw, delete, partial receipts, installments,
loan-terms CRUD, and invoice generation — are hand-written SQL in
`gm-pool-routes.ts` and do **not** depend on any of the stubbed services for
their core row mutations. Only the two loan-admin-gate endpoints and the
side-effect layer (notifications, audit, config, ledger sync, commission) are
affected.

A **separate, working** commission *verification* (manual entry + sign-off, not
an automatic calculator) exists:
- `bv-commission-verification-routes.ts` — privileged roles manually enter
  `totalComm`/`totalReward`/`abReward` per salesperson/month; the salesperson
  self-confirms it.
- `commission-verification-routes.ts` — a more generic version of the same
  pattern, gated by HOD/full-access decision roles.
- `GET /api/reports/bv-system` — a read-only report using a **hardcoded**
  per-package commission estimate (e.g. "Basic→3000, GGS Digital/Lite→2500,
  Basic Plus/Standard→5000"), not an authoritative calculation.

---

## 6. GM → PMS project creation

`POST /api/account/create-project-from-gm` (`account-routes.ts:1794`, role
`account_manager`/`admin`) is the single real entry point. For a GM-sourced
entry it calls `createOrLinkProjectForGm()` (fully working, not stubbed) which:

- Is idempotent on `projects.gm_id` (re-calling just returns the existing link).
- Inserts a `drm.projects` row with `status='Active'`.
- Flips the GM to `status='Approved'` / `approval_status='approved'` (redundant
  safety net alongside the approval-stage flips in §3).
- Creates a `projectFinancials` row and an initial "HOD" `projectApprovals` stage.

The alternate branch (creating a project from a `product_posting` invoice
instead of directly from a GM) routes through the stubbed
`InvoiceWorkflowService` and effectively fails in this checkout.

---

## 7. API route reference

| Method & Path | Role | Purpose |
|---|---|---|
| `GET /api/gm-packages` | any | Static package catalog |
| `GET /api/gm-pool/check-duplicate` | any | Check member/order/company collision |
| `GET /api/gm-pool` | any (row-scoped) | List GM entries |
| `POST /api/gm` | sales_executive (+ admin/super_hod override) | Create GM entry |
| `PATCH /api/gm-pool/:id` | sales_executive/manager/asst. | Edit / resubmit |
| `POST /api/gm-pool/:id/hod-approve` \| `/hod-reject` | hod, super_hod | HOD decision |
| `POST /api/gm-pool/:id/account-manager-approve` \| `/account-manager-reject` | account_manager | Final approval/reject |
| `POST /api/gm-pool/:id/sales-manager-approve` \| `/sales-manager-reject` | sales_manager | Parallel sign-off |
| `POST /api/gm-pool/:id/super-hod-approve` \| `/super-hod-reject` | super_hod | Admin-level decision |
| `POST /api/gm-pool/:id/request-update` | creator (sales roles) | Request field-change approval |
| `POST /api/gm-pool/:id/request-withdraw` | creator | Request withdrawal |
| `POST /api/gm-pool/:id/withdraw-approve` \| `/withdraw-reject` | hod | HOD decides withdrawal |
| `GET /api/gm-pool/:id/invoices` | owner/org-wide | List linked invoices |
| `DELETE /api/gm-pool/:id` | owner/org-wide | Soft-delete (blocked post-HOD-approval) |
| `GET/POST /api/gm-pool/:id/partial-receipts`, `/installments` | account_manager/hod/super_hod | Partial payment tracking |
| `POST /api/gm-pool/:id/finalize-partial` | account_manager/hod/super_hod | Confirm fully paid |
| `GET/POST/PATCH /api/gm-pool/:id/loan-terms` | account_manager/sales_manager | Loan terms CRUD |
| `POST /api/gm-pool/:id/loan-admin-approve` \| `/loan-admin-reject` | super_hod | ⚠️ Broken — always 500s |
| `GET/POST/PATCH/DELETE /api/gm-bv-pool` | any | Merged GM+BV pool CRUD |
| `GET/POST/PATCH /api/account/gm-entries` | account_manager/hod/super_hod/sales_manager | Accounts-module GM list/create |
| `POST /api/account/create-project-from-gm` | account_manager/admin | GM → PMS project creation |
| `POST /api/sales/gm-entries/:id/gm-doc` \| `/gm-bv` | any authenticated | One-time GM Doc / GM BV markers |
| `GET /api/hod/verification/gms`, `POST /:id/status` | hod | HOD's GM queue (Accounts/HOD-module path) |
| `(any) /api/target-system/gm-commission/*` | — | ⚠️ Empty router — 404s |
| `GET/POST/:id/confirm /api/bv-commission-verifications` | privileged create; self-confirm | Manual commission sign-off |
| `GET /api/reports/bv-system` | any (row-scoped) | Hardcoded-heuristic commission report |
| `POST/GET /api/bv-reports` | report permission | Create/list BV reports |

---

## 8. Frontend pages & components

| Route | Component | Notes |
|---|---|---|
| `/gm-pool/add-gm` | `gm-pool-add-gm.tsx` | Main Sales-Executive GM list + create + edit page |
| `/customers/gmbv-pool` | `lead-pools.tsx` | Merged GM+BV pool UI |
| `/account/gm-entries` | `account-gm-entries.tsx` | Accounts-module GM view |
| `/account/temp-gm`, `/account/refund-gm` | respective pages | Separate Temp/Refund GM record kinds |
| `/analytics/gm`, `/reports/gm/new`, `/daily-reports/added-gm` | respective pages | GM reporting views |
| `/reports/bv/new`, `/reports/bv-pending-rc`, `/reports/bv-pending-ecnc`, `/reports/bv-system` | respective pages | BV reporting views |
| *(embedded in dashboards)* | `gm-approval-card.tsx` | Approve/reject/update card for Account Mgr/Sales Mgr/Super HOD |
| *(Account Manager dashboard)* | `account-approval-modal.tsx` | Calls the live `gm-pool-routes.ts` approve/reject endpoints |
| *(Loan GM dialogs)* | `gm/LoanTermsDialog.tsx`, `gm/LoanAdminQueuePanel.tsx` | ⚠️ Admin-approve/reject calls fail server-side |
| *(Partial GM dialog)* | `gm/PartialReceiptsDialog.tsx` | Installments / receipts / finalize-partial |
| *(Sales Exec dashboard widget)* | `my-gm-commission-widget.tsx` | ⚠️ Static placeholder — no real data |

---

## 9. If you're picking this up to fix something

Priority order, based on user-facing impact:

1. **Loan GM admin gate** (`transitionWorkflowStatus` stub) — currently blocks
   100% of Loan GMs from ever reaching final approval. Highest-impact fix.
2. **Approval scope bypass** (`gmApprovalScopeClause`) — a security/data-
   integrity gap: any HOD can act on any department's GM today.
3. **GM commission** — no automated calculation exists at all; only manual
   verification sign-off.
4. **Notifications / audit trail** — silent gaps, lower urgency but worth
   knowing they don't fire before relying on them for anything operational.
