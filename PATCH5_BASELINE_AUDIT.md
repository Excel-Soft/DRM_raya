# PATCH 5 — STAGE 0: GM / Sales Workflow Baseline Audit

**Date:** 2026-06-18
**Mode:** Read-only audit. No code, schema, workflow, or data was changed.
**Scope:** Inspect the live codebase against the Patch 5 requirements (P1–P14).
All findings below are **code-verified** unless explicitly marked *unconfirmed*
or *needs management confirmation*. Line references are indicative of the
inspected June 2026 source.

> **Honesty note:** "Present" means the behaviour was found in code. "Absent"
> means it was not found during inspection. Where a requirement depends on a
> business rule that only management can decide, it is listed in
> `PATCH5_MANAGEMENT_CONFIRMATION_REQUIRED.md` and **not** assumed here.

---

## 1. App run status
- `Start application` workflow (`npm run dev`, Express + Vite on port 5000) is
  **running**; the app boots and serves the API.
- Backend entry `server/index.ts` → `server/routes.ts`; frontend `client/`.
- The smaller `src/` scaffold and `api:dev`/`auth:dev` scripts are legacy and
  were **not** treated as the active app (per `replit.md`).

## 2. npm check / build status
- `node -v` = **v20.20.0**, `npm -v` = **10.8.2**.
- `npm run check` (`tsc --noEmit`) → **EXIT 0, 0 type errors** (clean).
  (The historical ~57-error tsc baseline noted in prior patches no longer
  reproduces; the typecheck is currently green.)
- No build/refactor was performed (read-only stage).

## 3. Database status
- PostgreSQL reachable; schema **`drm`** present (read-only queries succeeded).
- Relevant tables confirmed present: `gm_entries`, `gm_pool_entries`,
  `gm_reports`, `temp_gm_entries`, `refund_gm_entries`, `invoices`,
  `product_posting_invoices`, `projects`, `project_approvals`,
  `project_assignments`, `project_details`, `project_documents`,
  `project_financials`, `project_payments`, `loan_requests`, `loan_reports`,
  `product_posting_workflows`, `product_posting_data`,
  `product_posting_phase_definitions`, `product_posting_commission_slabs`,
  `product_posting_evidence_links`, `product_posting_rework_history`,
  `commission_verifications`, `link_report_commission_verifications`.
- Note (do not run): `npm run db:push` is known broken repo-wide on a
  pre-existing FK type mismatch; schema is applied via runtime `ALTER TABLE …`
  helpers (e.g. `ensureGmEntriesColumns`, `ensureProductPostingInvoicesTable`).

## 4. Current GM creation endpoints
| # | Endpoint | File | Frontend | Effective guard | Audit |
|---|----------|------|----------|-----------------|-------|
| 1 | `POST /api/gm` (router base `/api`) | `server/gm-pool-routes.ts:285` | `gm-pool-add-gm.tsx` | `authMiddleware` + `checkUrlPermission` + `if(!req.user)`. **No role restriction** at handler. | Activity log only; no `AuditLogService.record` in handler |
| 2 | `POST /api/account/gm-entries` | `server/account-routes.ts:388` | `account-gm-entries.tsx` | `if(!req.user)` + global `checkUrlPermission`. **No role restriction.** | Not explicit |
| 3 | `POST /api/account/dollar-system/transaction` | `server/account-routes.ts:1948` | `dollar-system.tsx` | `requireFinancialPermission(dollarTransaction)` | **Yes** (`AuditLogService`, ~L2023); also auto-creates 3 invoices at L2043 |
| 4 | `POST /api/account/temp-gm` | `server/account-routes.ts` | `account-temp-gm.tsx` | `if(!req.user)` + `checkUrlPermission` → `temp_gm_entries` | Not explicit |
| 5 | `POST /api/account/refund-gm` | `server/account-routes.ts:~1405` | `account-refund-gm.tsx` | `if(!req.user)`; validates `amount>0` + mandatory comment → `refund_gm_entries` | Not explicit |
| 6 | HOD GM create (calls invoice gen) | `server/hod-routes.ts:981` | HOD dashboard | HOD route guards | — |
| 7 | BV-pool GM create | `server/repositories/gm-bv-pool.repository.ts:308` | `gm-bv-pool.tsx` | via BV pool routes | — |
| 8 | `POST /api/service/gm` | `server/service-core-routes.ts:464` | (service) | **Returns 501 Not Implemented** (honest stub — Service Executives cannot create GM here) | — |

**Critical authorization finding (P1):** `checkUrlPermission`
(`server/settings.middleware.ts:14`) **fails CLOSED for unauthenticated** users
(401) and bypasses only platform `admin`, but at lines **102–110 it FAILS OPEN**
("No matching rule → ALLOW") and the `drm.url_permissions` table is described in
the code comment as *"currently unpopulated"*. Net effect: the GM-creation
routes are gated by **authentication only** — any logged-in non-admin role
passes the backend. There is **no backend role allow-list** restricting GM
creation to approved initiating roles. The sidebar (`app-sidebar.tsx`) exposes
`/gm-pool/add-gm` to ~20 roles including `service_executive`, but that is
**frontend gating only**.

**Service Executive:** the dedicated `POST /api/service/gm` is a 501 stub, and
the manual invoice page is frontend-gated to `sales_executive`
(`canCreateInvoice = userRoleName === "sales_executive"`). But because the
generic GM endpoints fail open, a Service Executive (or any authenticated role)
is **not blocked at the backend** from calling `POST /api/gm` or
`POST /api/account/gm-entries` directly. → management Q1/Q2.

## 5. Current GM type fields / statuses
From `shared/schema.ts` `gm_entries` (L1043–1095):
- **`gm_type`** — explicit `pgEnum gm_entry_type` = **`GM` | `TempGM` | `RefundGM`**
  (L1045). This enum classifies *record kind*, **not** Full/Partial/Loan.
- **Full / Partial / Loan** — modelled as **implicit integer boolean flags**:
  `is_loan` (L1069) and `is_partial_payment` (L1070). There is **no explicit
  `Full|Partial|Loan` enum**. The frontend `loanMode` (`none|loan|installment`)
  maps to these flags (`gm-pool-routes.ts:305–306`).
- `installments` `jsonb` (L1065): `[{ dollar, pkr, chequeNo, payDate }]`.
- `status` — `pgEnum gm_entry_status` (`Pending|Approved|Rejected|Completed`, L1068).
- `payment_status` — **free-text** (L1066). `approval_status` (handler) is
  free-text (`pending_hod → pending_managers → approved`); `super_hod_status`
  free-text (L1080).
- Amounts: `amount_usd`, `customer_dollar`, `dollar_rate`, `amount_pkr`,
  `alibaba_discount_usd`, `extra_discount_usd/pkr/hod`.
- **No `return_date` column** on `gm_entries`. Loan return tracking lives in the
  separate `loan_requests` table (see §8).
- **No direct `invoice_id` FK** on `gm_entries`; invoice/project linkage is via
  `product_posting_invoices` and `projects.invoice_id`.

## 6. Current payment validation
- **Present:** required USD amount (`>0`), package required, `pkr_amount>0`,
  `dollar_rate>0` (`gm-pool-routes.ts` createSchema), `alibaba_discount ≤ order
  dollar` (L296), duplicate-GM detection by `customer_id`/`company_name`
  (`gm-pool-routes.ts:~425–431`), refund `amount>0` + mandatory comment.
- **Partial:** `ab_type` column exists and is collected, but automated AB
  discount *rules* are manual inputs, not logic-enforced.
- **Absent:** any **minimum payment threshold** beyond "> 0" (no per-type /
  per-package floor). → P3 + management Q3.

## 7. Current partial payment support
- **Present:** `is_partial_payment` flag, `loanMode='installment'`,
  `installments` jsonb, payment-proof (`payment_proof_url` accepted).
- **Partial:** receipt entries live inside the `installments` JSON blob (no
  first-class receipt rows for GM partials); remaining-balance is implicit
  (`amount_pkr` vs paid) and only first-class for loans (`loan_requests.
  remaining_amount`); accounts dashboard shows combined pending only.
- **Absent:** a hard **final-approval gate** that blocks GM approval until full
  payment is received — approval is at Account Manager discretion
  (`gm-pool-routes.ts:~676`). → P4.

## 8. Current loan GM support
There are **two unconnected loan surfaces**:
1. GM `is_loan` flag + `installments` JSON on `gm_entries` (created via the GM
   forms).
2. A separate **loans module**: `loan_requests` / `loan_reports`,
   `server/loan-routes.ts` (`manager-approve` ~L214, `hod-approve` ~L258,
   `pay-installment` ~L374), report at `server/reports-routes.ts:~642` and
   `client/src/pages/loan-report-new.tsx`.

| Loan element | Status | Evidence |
|---|---|---|
| Loan amount | Present | `loan_requests.amount` |
| Company co-pay / contribution | **Absent** | no column/logic found |
| Agreed return date | **Absent** | no `return_date`; uses installments |
| Repayment terms | Present | `installment_amount`, `pay-installment` |
| Remarks | Present | `loan_requests.detail` |
| Admin approval stage | Present | `manager-approve` + `hod-approve` |
| Overdue status | Partial | `jobs/overdue-checker.ts` covers **tasks only** (not invoices/loans); loans tracked via `remaining_amount`, no loan-specific overdue |
| Reminders | Partial | generic follow-up reminders; no loan-repayment job |
| Loan GM report | Present | `reports-routes.ts`, `loan-report-new.tsx` |

→ P5: company co-pay, agreed return-date, a loan-specific approval gate, overdue
calculation and reminders are missing; the GM-loan flag and the `loan_requests`
module are not unified.

## 9. Current invoice generation timing
- **Three default zero-amount invoices** — `"Alibaba Product Posting"`,
  `"Alibaba Minisite"`, `"Listing Page"` — are created by
  `createProductPostingInvoices` (`server/utils/invoice-utils.ts:23`, names
  hardcoded at L36) into `product_posting_invoices` with status `PENDING_HOD`.
- **They are generated at GM CREATION**, in these call sites:
  `gm-pool-routes.ts:468` (GM-pool create), `hod-routes.ts:981` (HOD create),
  `gm-bv-pool.repository.ts:308` (BV-pool create), and
  `account-routes.ts:2043` (dollar/wallet op). **Not** at GM *approval*.
  (Note: one initial automated reading attributed this to
  `POST /api/account/gm-entries`; direct grep shows the call sites above — the
  account `gm-entries` handler does **not** call it.)
- → This **conflicts** with Patch 5 P6 (post-approval timing) and is a
  management decision (Q4): generate at creation vs after final GM approval.

## 10. Current manual invoice creation rules
There are **two manual-invoice routes** with different enforcement:
- **New workflow route (hardened):** `POST /api/invoices`
  (`server/routes/invoice-routes.ts:50`) → `InvoiceWorkflowService`. Has backend
  **`requireRole("sales_executive","sales_manager","admin")`**, allows
  `DRAFT` / `PENDING_HOD`, duplicate prevention via `findActiveDuplicate`,
  required rejection reason, and audit via `AuditLogService.recordTransition`.
- **Legacy route actually used by the UI (auth-only):** the visible page
  `client/src/pages/sales/create-invoice.tsx` posts to
  **`POST /api/account/invoices`** (`server/account-routes.ts:1052`) and updates
  via `PATCH /api/account/invoices/:id` — these have **no backend role guard**
  (auth-only). So the manual-invoice surface is split: a role-guarded new route
  vs an auth-only legacy route that the current screen targets. → P7.
- **Invoice "type":** controlled by `serviceType` / `project_name` which are
  **free-text** (the 3 default names are hardcoded strings) — **not a pgEnum**.
  → P7.
- **Frontend creator gating:** `create-invoice.tsx` hardcodes
  `canCreateInvoice = userRoleName === "sales_executive"` (frontend only),
  which does not protect the legacy backend route. → P7 + management Q2.

## 11. Current HOD / Accounts invoice validation
- **New system (good):** `POST /api/invoices/:id/hod-approve|hod-reject`,
  `/account-approve|/account-reject`, `/mark-paid`
  (`InvoiceWorkflowService.hodDecision` / `accountDecision` / `markPaid`).
  Enforces a **state machine** (`LEGAL_TRANSITIONS`; `PAID/REJECTED/CANCELLED`
  terminal), role checks, amount reconciliation on `markPaid`, required
  rejection reason, and audit logging.
- **Legacy system (gap — P8):** `PATCH /api/account/invoices/:id/status`
  (`server/account-routes.ts:1110`) updates `drm.invoices.status` to **any
  value** with only `if(!req.user)` — **no role gate, no state-machine
  validation, no audit**. This matches the prior unfixed APR-001/INV-001
  finding. `PATCH /api/account/invoices/:id` (L1075) and `DELETE` (L1140) on the
  legacy table similarly need guard review.

## 12. Current invoice-to-project behavior
- **Auto path:** account-approval moves a `product_posting_invoice` to
  `APPROVED`, which surfaces it in the **pending-projects queue**
  (`projects.repository.findPendingInvoices`, only invoices with no linked
  project → duplicate-project prevention).
- **Manual path:** `POST /api/account/create-project-from-gm`
  (`server/account-routes.ts:554`) handles both `gm_entries` and
  `product_posting_invoices` via **raw `pool.query`**, creating a project with
  status **`"Active"`** (L629), a workflow, financials, and an initial HOD
  approval stage — **bypassing `InvoiceWorkflowService`**.
- **Department routing:** by `projects.department_type` (`DND` for
  Listing/Minisite, `PRODUCT_POSTING`), backfilled from project-name regex.
- **Mixed behaviour (P9):** auto vs manual paths diverge; manual path bypasses
  the workflow service; initial project status is hardcoded `"Active"` →
  management Q7.

## 13. Current Product Posting QA dependency behavior
- Listing-Page and Product-Posting projects both live in `drm.projects`,
  distinguished by `department_type` + name matching.
- `product_posting_workflows` has `qa_reviewed_at`, `qa_user_id`, `qa_remarks`;
  `current_phase` ∈ `QA_REVIEW | QA_COMPLETE | VERIFICATION_PENDING |
  VERIFICATION_COMPLETE`.
- Work is assigned via
  `POST /api/product-posting/projects/:projectId/assign-task`
  (`server/routes/product-posting-workflow-routes.ts:122`, mounted at
  `/api/product-posting` in `server/routes.ts:375`; guarded by
  `requireRole("product_posting_manager","dd_manager","qa_manager","admin")`).
- **No enforced dependency (P10):** the assign-task path does **not** check that
  the corresponding Listing-Page project has passed QA before Product Posting
  can start. Queues are separated by role in the UI, but the backend does not
  block. → management Q5.

## 14. Current Verification Manager lifecycle status
- For the product-posting workflow, phases progress `QA_COMPLETE →
  VERIFICATION_PENDING → VERIFICATION_COMPLETE`
  (`product-posting-workflow-routes.ts`), with final status
  `VERIFICATION_COMPLETE`. Backend values and frontend labels
  (`PRODUCT_POSTING_PHASE_LABELS`, `shared/schema.ts:~62`) **agree**.
- **Open (P11):** whether Verification is a **required final stage for every
  department lifecycle** (not just product posting), and what the canonical
  "final" status is across reports/dashboards, is **not uniformly enforced** →
  management Q6.

## 15. Current Accounts dashboard GM / invoice visibility
From `server/dashboard-routes.ts:~261–375` and
`client/src/pages/account-manager-dashboard.tsx`:
- **Present:** total revenue from GM entries, customer status counts
  (New/Renew/Expire), service-type KPIs; (frontend) total revenue, outstanding
  invoices (count + amount), active projects, total clients, a combined
  "Martini status" of pending invoices + GMs; and GM **loan count** +
  **partial-payment count** (`loan_count` / `partial_payment_count` from
  `server/account-routes.ts`, shown as "Loans" / "Partial Pay" tiles).
- **Missing (P12):** loan/partial **financial breakdown (amounts, not just
  counts)**, payment-confirmation detail, partial received vs pending balance,
  receipt history, loan return date, due/overdue loan status, and **invoice
  status per GM**.

## 16. Current cross-module status update points
- A **central service exists**: `CrossDepartmentStatusService`
  (`server/services/cross-department-status.service.ts`) with hooks
  (`onInvoiceHodApproved`, `onProjectCreated`, `onWorkflowManagerCompleted`, …)
  that write `drm.cross_department_status_history` and audit via
  `AuditLogService.recordTransition`.
- **But it is not universally used (P14):** the legacy invoice-status PATCH
  (§11) and the raw `create-project-from-gm` path (§12) update tables directly,
  bypassing the central service and its audit ledger. GM status changes and
  legacy `drm.invoices` are not consistently routed through it.

## 17. Management confirmation items
The following require explicit management decisions and are listed verbatim in
`PATCH5_MANAGEMENT_CONFIRMATION_REQUIRED.md`: (1) Service Executive GM creation;
(2) Service Executive manual invoice creation; (3) minimum payment threshold
rules by GM type/package; (4) 3 default invoices at GM creation vs after final GM
approval; (5) Product Posting always waits for Listing-Page QA; (6) Verification
Manager required final stage; (7) exact initial project status after final
invoice approval. **No business assumption was hard-coded for any of these.**

## 18. Recommended implementation order
Foundational → permissions → validation → workflow → views, P0 first, honoring
management answers:
1. **P2** — explicit `Full|Partial|Loan` enum + controlled GM type/state model
   (foundation many others build on).
2. **P1** — backend role allow-list for GM creation (replace fail-open URL check
   for these routes) — needs Q1.
3. **P13 / P7** — Service-Exec GM/invoice participation + manual-invoice creator
   role + invoice-type enum — needs Q1/Q2.
4. **P3** — minimum payment threshold validation — needs Q3.
5. **P8** — harden HOD/Accounts invoice approval (retire/guard legacy PATCH
   status; enforce state machine + audit on all invoice tables).
6. **P4** — partial-payment receipts + final-approval gate.
7. **P5** — loan GM admin approval, return-date tracking, overdue + reminders;
   unify loan surfaces.
8. **P6 / P9** — standardize invoice generation timing + invoice→project
   creation through one service — needs Q4/Q7.
9. **P10** — enforce Product Posting dependency on Listing-Page QA — needs Q5.
10. **P11** — align department final status with Verification stage — needs Q6.
11. **P12** — complete Accounts dashboard GM-type + invoice-status view.
12. **P14** — route all GM/invoice/project/QA/verification status changes
    through `CrossDepartmentStatusService` (extend existing service).

## 19. Files likely to change (future stages — NOT changed in Stage 0)
- Backend: `server/gm-pool-routes.ts`, `server/gm-bv-pool-routes.ts`,
  `server/repositories/gm-bv-pool.repository.ts`, `server/account-routes.ts`,
  `server/hod-routes.ts`, `server/loan-routes.ts`,
  `server/routes/invoice-routes.ts`,
  `server/services/invoice-workflow.service.ts`,
  `server/utils/invoice-utils.ts`,
  `server/routes/product-posting-workflow-routes.ts`,
  `server/services/product-posting-workflow.service.ts`,
  `server/services/cross-department-status.service.ts`,
  `server/repositories/projects.repository.ts`, `server/dashboard-routes.ts`,
  `server/settings.middleware.ts`, `server/utils/role-utils.ts`,
  `shared/schema.ts`.
- Frontend: `client/src/pages/gm-pool-add-gm.tsx`,
  `client/src/pages/account-gm-entries.tsx`, `client/src/pages/gm-pool.tsx`,
  `client/src/pages/gm-bv-pool.tsx`, `client/src/pages/invoice-pool.tsx`,
  `client/src/pages/sales/create-invoice.tsx`,
  `client/src/pages/account-manager-dashboard.tsx`,
  `client/src/components/app-sidebar.tsx`, `client/src/App.tsx`,
  product-posting / QA / verification dashboards.
