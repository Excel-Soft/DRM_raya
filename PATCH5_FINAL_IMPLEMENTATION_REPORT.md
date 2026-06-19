# PATCH 5 — Final Implementation Report

Consolidated report for Patch 5 (GM/Sales workflow), Stages 0–8. This stage (8) adds
**no features** — it is QA, regression, documentation, and management sign-off prep.
Per-stage file-level detail is in `PATCH5_STAGE1…7_*_CHANGELOG.md`.

---

## P1–P14 status

| # | Item | Status | Summary |
|---|------|--------|---------|
| P1 | GM creation role enforcement | **DONE** | `requireGmSalesActionPermission(GM_CREATE)` on `POST /api/gm`; default initiators `sales_executive` (+`super_hod` override, `admin*`); fails closed (401/403/503). |
| P2 | GM routing Full/Partial/Loan + approval paths | **DONE** | `resolveCanonicalGmType` (is_loan/is_partial_payment); FULL→HOD→Accounts→Approved; PARTIAL adds payment hold; LOAN adds Super-HOD admin gate. |
| P3 | GM validation: threshold / package / duplicate | **DONE (config-gated)** | Positivity checks always on; `validateMinimumPaymentThreshold` → 400 when configured; duplicate order/member pre-check. Thresholds empty by default — **mgmt confirm**. |
| P4 | Partial-receipt workflow + zero-balance gate | **DONE** | Receipts summed from `gm_partial_receipts`; final approval → 409 PARTIAL_PAYMENT_INCOMPLETE while balance > 0. |
| P5 | Loan GM admin approval + return-date tracking | **DONE** | `gm_loan_terms.admin_approval_status` must be APPROVED (409 LOAN_ADMIN_APPROVAL_REQUIRED); tracks return_date / grace period. |
| P6 | Default 3-invoice generation + timing | **DONE (config-gated)** | `generateDefaultInvoicesForGm`, idempotent, 3 types; `gmInvoiceGenerationTiming` default `ON_GM_CREATION` — **mgmt confirm** for post-approval. |
| P7 | Manual invoice creation roles | **DONE (config-gated)** | `requireManualInvoiceCreator`: admin/sales_executive/sales_manager; service_executive only if flag (default off) — **mgmt confirm**. |
| P8 | Invoice approval validation (HOD/Accounts) | **DONE** | `assertApprovalReadiness` (customer + amount>0 + type) → 400; mark-paid requires payment method/reference/amount. |
| P9 | Project generation from approved invoice | **DONE** | `createOrLinkProjectForApprovedInvoice` idempotent; manual `POST /api/invoices/:id/generate-project` + AUTOMATIC mode. |
| P10 | Product-Posting depends on Listing-Page QA | **DONE (config-gated)** | `assertProductPostingDependencySatisfied` → 409 LISTING_QA_PENDING; `requireProductPostingWaitForListingQa` default off — **mgmt confirm**. |
| P11 | Verification-Manager lifecycle | **PARTIAL (labels only)** | `getVerificationLifecycleLabels` config-aware; **transition logic intentionally unchanged** pending mgmt confirmation of uniform enforcement. |
| P12 | Initial project status after invoice approval | **DONE (config-gated)** | `defaultProjectStatusAfterInvoiceApproval` default `Active` — **mgmt confirm**. |
| P13 | UI / sidebar permissions match backend | **DONE** | `ui-config` gates service_executive GM/invoice controls to match backend defaults; legacy account-invoice route noted for follow-up guard. |
| P14 | Centralised cross-module status sync + audit | **DONE** | `CrossDepartmentStatusService` writes `cross_department_status_history` + `activity_logs` + next-dept notification across GM/invoice/PMS/product-posting/software. |

**Tally:** 13 DONE (6 of them config-gated to preserve current behaviour pending
management confirmation), 1 PARTIAL (P11, labels-only by design). No item regresses
prior behaviour; no permission was weakened.

---

## APIs added / modified (Patch 5)

- `POST /api/gm` — now guarded by `GM_CREATE` (was auth-only).
- `POST /api/account/gm-entries` — guarded by `GM_CREATE_ACCOUNT`.
- GM partial-receipt / finalize-partial / loan-terms / loan-admin-approve endpoints
  under `/gm-pool/*` — guarded by the respective `GM_*` action keys.
- `POST /api/invoices` — guarded by `requireManualInvoiceCreator`.
- `POST /api/invoices/:id/hod-approve|hod-reject|account-approve|account-reject` —
  role-guarded + readiness validation.
- `POST /api/invoices/:id/generate-project` — explicit idempotent project generation.
- `POST /api/product-posting-workflow/projects/:projectId/assign-task` — dependency
  assertion (409 LISTING_QA_PENDING when enabled).
- `GET|PATCH /api/gm-sales-workflow/config` — admin-only config read/update (audited).
- `GET /api/accounts/dashboard/gm-summary` — real-data aggregate (deduped).

## DB changes (schema `drm`)

- **New tables:** `gm_sales_workflow_config` (key/value, idempotent seed),
  `gm_partial_receipts`, `gm_loan_terms`, `project_dependencies`,
  `cross_department_status_history`.
- **Reused:** `activity_logs`, `workflow_status_history`, `task_status_history`,
  `product_posting_rework_history`.
- Applied via runtime idempotent DDL (`ADD COLUMN/CREATE TABLE IF NOT EXISTS`) — **not**
  `drizzle-kit push` (push is broken on a pre-existing FK type mismatch).

## Configuration decisions (defaults preserve current behaviour)

`serviceExecutiveCanCreateGM=false`, `serviceExecutiveCanCreateManualInvoice=false`,
`gmInvoiceGenerationTiming=ON_GM_CREATION`, `requireProductPostingWaitForListingQa=false`,
`verificationManagerRequiredAfterQa=true`, `defaultProjectStatusAfterInvoiceApproval=ACTIVE`,
`minimumPaymentThresholds={}`, `full/partial/loanGmAllowedInitiatorRoles=["sales_executive"]`,
`accountGmAllowedInitiatorRoles=["account_manager","hod","super_hod","sales_manager"]`,
`gmCreateOverrideRoles=["admin","super_hod"]`, `loanGmCreationEnabled=true`,
`projectGenerationMode=MANUAL`. All runtime-changeable by `admin`; every change audited.

## Tests run (this stage)

- `npm run check` (tsc `--noEmit`) → **0 errors**.
- `npm run build` (vite + esbuild) → **exit 0**; `dist/index.js` + `dist/public/index.html` produced.
- `npm run dev` → boots clean, "serving on fixed port 5000", DB connected.
- `vitest run` → **12 files / 180 tests passed**, incl. `patch5-stage7-role-matrix`
  (20 direct API permission assertions) and `workflow-transition.service` tests.

## QA documents produced (Stage 8)

`PATCH5_QA_CHECKLIST.md`, `PATCH5_PERMISSION_QA_MATRIX.md`,
`PATCH5_STATUS_TRANSITION_QA.md`, `PATCH5_DATA_INTEGRITY_QA.md`,
`PATCH5_AUDIT_VERIFICATION.md`, `PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`,
`PATCH5_FINAL_IMPLEMENTATION_REPORT.md` (this file).

## Unresolved errors

None blocking. tsc/build/tests are green. Non-blocking: vite chunk-size warning
(>500 kB) and an 8-month-old browserslist DB notice — neither affects behaviour.

## Management confirmations still required

The 7 business rules in `PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md` (items 1–7) remain
**PENDING**. Defaults preserve pre-Patch-5 behaviour; no code change is needed to apply
a decision (admin `PATCH /api/gm-sales-workflow/config`).

## Recommended follow-ups (not in scope here)

- Extend direct-API permission tests beyond the create paths to approval/finalisation/
  loan/project-generation/dependency endpoints.
- Add a backend role guard to the legacy `POST /api/account/invoices` route (P7/P13).
- Decide P11 verification enforcement uniformity once management confirms.
