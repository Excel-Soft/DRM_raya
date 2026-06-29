# Patch 5 Requirement Coverage Verification

**Date:** 2026-06-29 (verified during Patch 7 — Stage 2)

This document is the requirement-by-requirement evidence that the Invoice / GM /
Sales / Full-Partial-Loan / Project-generation scope is implemented. It records
**where** each requirement lives, its **status**, and the deliberate decisions
where the actual implementation differs in *name* from the original spec (to avoid
creating duplicate endpoints/tables/services).

Legend: ✅ implemented & verified · 🔒 gap closed in Patch 7 Stage 2 · ⚙️
config-gated (default preserves current behaviour) · ⏳ pending management confirmation.

## A. Invoice state machine & transitions

| Requirement | Implementation | Status |
| --- | --- | --- |
| Invoice statuses (DRAFT…PAID/REJECTED/CANCELLED) | `INVOICE_WORKFLOW_STATUSES` (`shared/gm-sales-constants.ts`) | ✅ |
| Legal transition map; no illegal jumps | `INVOICE_LEGAL_TRANSITIONS` + `assertTransition` | ✅ |
| No raw status writes | only service-backed transition methods | ✅ |
| Role-gated transitions | `requireRole(...)` per route (`invoice-routes.ts`) | ✅ |
| Reject reason required | `hod-reject` / `account-reject` validators | ✅ |
| Approval readiness (customer, +amount, type) | `assertApprovalReadiness` | ✅ |
| Audit + notify on every transition | `drm.activity_logs` + stage notify | ✅ |

> **Naming decision:** the spec's `invoice-transition.service.ts` is implemented as
> the pre-existing `invoice-workflow.service.ts`. No second transition service was
> created (it would duplicate the logic).

## B. Duplicate-invoice prevention

| Requirement | Implementation | Status |
| --- | --- | --- |
| Block 2nd active invoice for same customer+service+source | `findActiveDuplicate` | ✅ |
| Fail-closed on lookup error | throws → creation blocked | ✅ |
| Manager/admin override with recorded reason | `overrideReason` | ✅ |

## C. Default-invoice generation (LISTING_PAGE / MINIWEBSITE / PRODUCT_POSTING)

| Requirement | Implementation | Status |
| --- | --- | --- |
| Generate the 3 default invoices | `gm-invoice-generation.service.ts` | ✅ |
| Idempotent — one per `(GM, invoiceType)` | retry links existing row | ✅ |
| Generation timing controlled, single event | `gmInvoiceGenerationTiming` (`ON_GM_CREATION` default) | ⚙️ |

## D. Invoice → project generation

| Requirement | Implementation | Status |
| --- | --- | --- |
| Approved qualifying invoice → exactly one root project | `createOrLinkProjectForApprovedInvoice` | ✅ |
| Idempotent (retry links, no duplicate) | one `INVOICE_ROOT` per invoice | ✅ |
| Trigger on final Accounts approval | `POST /api/invoices/:id/account-approve` (best-effort) | ✅ |
| Explicit manual generate path | `POST /api/invoices/:invoiceId/generate-project` | ✅ |
| Auto vs manual generation | `projectGenerationMode` (`MANUAL` default) | ⚙️ |
| Product Posting waits on Listing-Page QA | `requireProductPostingWaitForListingQa` (`false` default) | ⚙️ |

## E. Full / Partial / Loan GM workflows

| Requirement | Implementation | Status |
| --- | --- | --- |
| Type derivation (Full/Partial/Loan) | `is_loan` / `is_partial_payment` flags + `classifyGmPaymentType` | ✅ |
| Partial receipts recorded | `gm_partial_receipts` + partial-receipt routes | ✅ |
| Block final approval while partial balance outstanding | `enforceLoanPartialFinalApprovalGate` | ✅ |
| Loan terms + loan-admin approval before final approval | `gm_loan_terms` + loan-admin routes + same gate | ✅ |
| Loan return / repayment reporting | loan-admin queue + loan-return report | ✅ |

> **Decision — receipts are append-only.** No receipt `PATCH`/`DELETE` was added;
> corrections are new receipts (audit-preserving). The running payment summary is
> embedded in `GET .../partial-receipts` (`loadPartialSummary`), so **no standalone
> payment-summary endpoint** was created.
>
> **Decision — loan reporting reuse.** No `/api/reports/gm-loans` was added; loan
> reporting is already served by the loan-admin queue + loan-return report.

## F. Accounts dashboard GM breakdown

| Requirement | Implementation | Status |
| --- | --- | --- |
| Full/Partial/Loan totals, received-vs-pending, due-soon/overdue | `GET /api/accounts/dashboard/gm-summary` (`account-routes.ts`) | ✅ |
| Real data, zeros on empty (no mocks) | live `gm_entries` + receipts/loan joins | ✅ |
| Per-GM invoice status | derived on each `recentGms` row | ✅ |
| Access scoping to managerial/permitted GMs | authentication-only in handler | ⏳ |

## G. GM / Sales route authorization (P0 — closed in this patch)

| Requirement | Implementation | Status |
| --- | --- | --- |
| Approvals/rejects gated by role, not just auth | `requireGmSalesActionPermission` on all GM mutation routes | 🔒 |
| Raw `approval_status` override restricted | `fix-status` → admin-only break-glass + audit | 🔒 |
| Edit endpoint cannot set formal approval columns | `approval_status`/`final_status`/`*_status` not in `updateSchema`; `PATCH /gm-pool/:id` is role-gated by `GM_EDIT` (was auth-only) | ✅ 🔒 |
| Wrong role → 403 + audit; anon → 401 | smoke-verified (17/17) | 🔒 |

See `PATCH7_STAGE2_INVOICE_GM_SALES_CHANGELOG.md` §2 for the full route→role map.

## Spec → actual endpoint / name mapping

| Spec name | Actual in code | Why |
| --- | --- | --- |
| `/api/gm/:gmId` (GM mutations) | `/api/gm-pool/:id` | Established route family; adding the alias would duplicate endpoints. |
| `invoice-transition.service.ts` | `invoice-workflow.service.ts` | Same responsibility; one service, no duplication. |
| Standalone payment-summary endpoint | summary embedded in `GET .../partial-receipts` | Append-only receipts; summary computed in `loadPartialSummary`. |
| `/api/reports/gm-loans` | loan-admin queue + loan-return report | Loan reporting already covered. |
| `invoice-to-project` auto-create | `projectGenerationMode` (MANUAL default) + explicit `generate-project` | Config-gated to preserve current behaviour. |

## Pending management confirmations (no behaviour change until confirmed)

- `gm-summary` access scoping (restrict to account/managerial roles and/or scope to
  permitted GMs).
- `gmInvoiceGenerationTiming`, `projectGenerationMode`,
  `requireProductPostingWaitForListingQa`, `serviceExecutiveCanCreateManualInvoice`,
  `defaultProjectStatusAfterInvoiceApproval` — all remain at their documented
  defaults.
