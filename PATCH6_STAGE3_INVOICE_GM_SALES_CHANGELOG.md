# Patch 6 — Stage 3: Invoice / GM / Sales / Project / Accounts Dashboard

## Summary

Stage 3 closes the Patch 6 invoice / GM / Sales workflow: strict state machines,
role guards, validation, project generation, dashboard visibility, and audit.

**On inspection, sections A–K were already implemented** in the codebase under the
GM/Sales workstream (config table `drm.gm_sales_workflow_config`, the invoice and
GM state machines, partial-receipt and loan-terms flows, default-invoice
generation, invoice→project generation with the Listing-Page QA dependency, and
the Accounts dashboard GM summary). Re-implementing them would have risked the
duplicate-invoice / duplicate-project damage this patch explicitly forbids.

The implementation satisfies A–K **with documented surface gaps** — the live
endpoint paths and the dashboard response shape differ from the spec's
hypothetical surfaces, and a few spec'd sub-surfaces (individual partial-receipt
`PATCH`/`DELETE`, a `/api/reports/gm-loans` path, zero-value-with-reason invoices)
are not present. These differences are catalogued under "Unresolved / notes".

Stage 3 therefore (a) verified each requirement against the live implementation,
(b) delivered the **missing documentation** (section L), and (c) ran the
verification suite. No business rules were changed; no source files were modified;
no destructive DB commands were run.

## Files changed

New documentation (section L):

- `PATCH6_STAGE3_INVOICE_GM_SALES_CHANGELOG.md` (this file)
- `GM_SALES_STATE_MACHINE.md`
- `INVOICE_TRANSITION_RULES.md`
- `INVOICE_TO_PROJECT_RULES.md`
- `ACCOUNTS_DASHBOARD_GM_BREAKDOWN.md`

No source files were modified (the implementation already satisfied A–K).

## Pre-existing implementation map (verified)

| Spec | Requirement | Where it lives |
| --- | --- | --- |
| A | Config table + GET/PATCH config (admin), safe defaults | `drm.gm_sales_workflow_config`; `server/services/gm-sales-config.service.ts`; `server/routes/gm-sales-workflow-routes.ts`; `shared/gm-sales-constants.ts` |
| B | GM creation initiator guard, createdBy/role audited | `requireGmSalesActionPermission(GM_CREATE / GM_CREATE_ACCOUNT)`; `server/gm-pool-routes.ts`; `server/account-routes.ts` |
| C | FULL / PARTIAL / LOAN type machine, type-change blocked | `shared/gm-sales-constants.ts` (`GM_TYPES`, `GM_LEGAL_TRANSITIONS`); `server/services/workflow-status.service.ts` |
| D | Minimum payment thresholds (config, empty by default) | `minimumPaymentThresholds`; `server/services/gm-sales-validation.service.ts`, `gm-create-policy.service.ts` |
| E | Partial receipts + all-paid gate | `drm.gm_partial_receipts`; `server/gm-pool-routes.ts`; gate in `server/account-routes.ts` |
| F | Loan terms + admin gate + return tracking | `drm.gm_loan_terms`; `server/gm-pool-routes.ts`; gate in `server/account-routes.ts` |
| G | Invoice transition service (no raw status) | `server/services/invoice-workflow.service.ts`; `server/routes/invoice-routes.ts` |
| H | Default-invoice generation timing + idempotency | `server/services/gm-invoice-generation.service.ts` |
| I | Approved invoice → exactly one project (idempotent) | `server/services/invoice-to-project.service.ts` |
| J | Product Posting waits for Listing-Page QA (config) | `drm.project_dependencies`; `server/services/invoice-to-project.service.ts` |
| K | Accounts dashboard GM summary (Full/Partial/Loan) | `GET /api/accounts/dashboard/gm-summary` (`server/account-routes.ts`) |
| L | Documentation | this stage (5 files above) |

## APIs (already present, verified)

The GM pool router is mounted at `/api` (`app.use("/api", router)` in
`server/gm-pool-routes.ts`), so all `/gm-pool/*` routes are reached at
`/api/gm-pool/*`.

- Config: `GET /api/gm-sales-workflow/config` (admin), `PATCH /api/gm-sales-workflow/config` (admin), `GET /api/gm-sales-workflow/ui-config` (any authed; 3 UI flags).
- Invoices: `POST /api/invoices`; `GET /api/invoices` (+ `/queue/hod`, `/queue/account`); `GET /api/invoices/:id/history`, `/:id/export`; `POST /api/invoices/:id/{submit-hod,hod-approve,hod-reject,account-approve,account-reject,mark-paid,cancel}`; `PATCH /api/invoices/:id` (whitelisted); `POST /api/invoices/:invoiceId/generate-project` (manual project generation).
- GM create: `POST /api/gm`; `POST /api/account/gm-entries`; `PATCH /api/account/gm-entries/:id/{approve,reject}`.
- GM partial / loan: `GET|POST /api/gm-pool/:id/partial-receipts`; `POST /api/gm-pool/:id/finalize-partial`; `GET|POST|PATCH /api/gm-pool/:id/loan-terms`; `GET /api/gm-pool/loan-admin-queue`; `POST /api/gm-pool/:id/{loan-admin-approve,loan-admin-reject}`; `PATCH /api/gm-pool/:id/loan-return` (return / overdue tracking); `GET /api/gm-pool/loan-return-report` (loan report).
- Accounts dashboard: `GET /api/accounts/dashboard/gm-summary`.

## DB changes

None this stage. The required tables already exist (`drm.gm_sales_workflow_config`,
`drm.gm_partial_receipts`, `drm.gm_loan_terms`, `drm.project_dependencies`,
`drm.projects`, `drm.product_posting_invoices`) and are created/seeded
idempotently at runtime (`CREATE TABLE IF NOT EXISTS` + `INSERT ... ON CONFLICT`)
because repo-wide `db:push` is broken. No destructive DB commands were run.

## State machines implemented (verified)

- **Invoice**: `DRAFT → PENDING_HOD → PENDING_ACCOUNT → APPROVED → PAID`, with
  `REJECTED` / `CANCELLED` branches (`INVOICE_LEGAL_TRANSITIONS`). Raw status
  updates are not accepted; a positive amount is required (zero/negative rejected).
- **GM (logical)**: `DRAFT → SUBMITTED → PENDING_HOD → PENDING_ACCOUNTS →
  {PENDING_ADMIN | PARTIAL_PAYMENT_PENDING} → … → APPROVED → PROJECT_CREATED`
  (`GM_LEGAL_TRANSITIONS`), derived from `gm_entries` + `gm_loan_terms`.
- **Loan admin gate**: `PENDING / APPROVED / REJECTED` permissive sub-machine
  (`GM_LOAN_ADMIN_GATE_TRANSITIONS`).

## Dashboard changes

No code change required. `GET /api/accounts/dashboard/gm-summary` already returns
the Full / Partial / Loan breakdown inside a `{ success: true, data: { ... } }`
envelope (`sendSuccess`). The keys inside `data` are `totals`, `byStatus`,
`recentGms`, `filters`, and `dueSoonDays` (loan due-soon / overdue counts live
inside `totals`, and per-GM invoice status + overdue flags live on each
`recentGms` row). It accepts the documented query filters. There is **no** export
endpoint for this summary. See `ACCOUNTS_DASHBOARD_GM_BREAKDOWN.md`, including the
access-scoping open item.

## Tests run

- `npx tsc --noEmit` (`npm run check`): **0 errors**.
- Targeted suites (run per-file; the full single-process run OOMs in-sandbox):
  - `workflow-status.service.test.ts` — 6 passed
  - `workflow-transition.service.test.ts` — 28 passed
  - `patch5-stage7-role-matrix.test.ts` — 20 passed
  - `stage8-event-reception.test.ts` — 21 passed
  - `stage9-bv-report.test.ts` — 20 passed
  - `stage10-operational.test.ts` — 9 passed
  - `stage10-smoke.test.ts` — 12 passed
  - (116 relevant tests green.)

## Management confirmations still pending

All gated behind `drm.gm_sales_workflow_config` with current-behaviour-preserving
defaults until management confirms:

- `serviceExecutiveCanCreateGM` = `false`
- `serviceExecutiveCanCreateManualInvoice` = `false`
- `minimumPaymentThresholds` = `{}` (no enforcement until seeded)
- `gmInvoiceGenerationTiming` = `ON_GM_CREATION`
- `projectGenerationMode` = `MANUAL`
- `requireProductPostingWaitForListingQa` = `false`
- `defaultProjectStatusAfterInvoiceApproval` = `ACTIVE` (`DOCUMENTS_PENDING` /
  `PENDING_PROJECT` need a confirmed schema change)

## Unresolved / notes

- **Endpoint paths differ from the spec's hypothetical surfaces.** The implemented
  GM partial-receipt and loan endpoints live under the established
  `/api/gm-pool/*` prefix rather than the spec's `/api/gm/*`; capability is
  equivalent. Loan reporting **is** provided — `GET /api/gm-pool/loan-return-report`
  plus the loan admin queue `GET /api/gm-pool/loan-admin-queue` — just not at a
  `/api/reports/gm-loans` path. No dedicated individual-receipt `PATCH`/`DELETE`
  endpoint exists (the running balance is returned inline by the receipts `GET`).
  These were left as-is to avoid net-new surface beyond the patch scope.
- **Zero-value invoices.** The current validators require a positive amount, so
  zero/negative invoices are rejected; there is no "zero-value with reason" path.
- **SECURITY (open item).** `GET /api/accounts/dashboard/gm-summary` enforces
  authentication in-handler but applies **no** role / row scoping in the handler
  itself (no `getDepartmentFilterUserIds`); any role restriction depends on the
  global URL-permission layer. Whether this endpoint should be restricted to
  account/managerial roles and/or scoped to the caller's permitted GMs needs
  management/security confirmation. Not changed here — tightening it would alter
  access behaviour, which this documentation stage must not do without
  confirmation.
- The transition service is named `invoice-workflow.service.ts` (not
  `invoice-transition.service.ts`); it already owns the transition logic, so no
  second service was added.
- Full single-process `vitest run` is OOM-killed in this sandbox (environmental);
  suites pass when run per-file.
