# PATCH 5 — QA Checklist

Functional QA for the GM/Sales workflow after Patch 5 (Stages 0–7). This stage adds
**no features**; it verifies behaviour and records evidence.

**Method legend**
- **AUTO** — covered by automated API tests (`vitest`, `supertest` against the real
  Express app). Suite: `server/patch5-stage7-role-matrix.test.ts` (+ full suite).
- **CODE** — verified by direct code inspection of the authoritative guard/service.
- **CONFIG** — behaviour is admin-config-gated; default preserves pre-Patch-5
  behaviour (see `PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`).
- **MANUAL-PENDING** — full end-to-end UI walk-through with seeded data not executed
  in this stage; logic verified by CODE/AUTO. Recommended before production sign-off.

**Environment evidence:** `npm run check` (tsc) → 0 errors; `npm run build` → exit 0
(`dist/index.js` + `dist/public/index.html` produced); `npm run dev` → boots, "serving
on fixed port 5000", DB connected; `vitest run` → 12 files / 180 tests passed.

---

| # | Check | Expected | Method | Result | Evidence / Notes |
|---|-------|----------|--------|--------|------------------|
| 1 | GM creation allowed only for approved initiating roles | Allowed roles pass; others **403**; unauth **401** | AUTO + CODE | **PASS** | `requireGmSalesActionPermission(GM_CREATE)` on `POST /api/gm` (`server/gm-pool-routes.ts:425`). Default effective: `admin`/`super_admin`, `sales_executive`, `super_hod` (override). Direct API tests: sales_executive admitted, service_executive denied (default), admin admitted, unauthenticated 401. |
| 2 | Create Full, Partial, Loan GM; each follows the correct approval path | FULL: Pending→HOD→Accounts→Approved; PARTIAL adds partial-payment hold; LOAN adds admin (Super HOD) gate | CODE + MANUAL-PENDING | **PASS (logic)** | Type from `is_loan`/`is_partial_payment` via `resolveCanonicalGmType` (`gm-create-policy.service.ts`); paths per `GM_BV_STATE_MACHINE.md`. End-to-end record creation not run with seeded data this stage. |
| 3 | Reject GM when threshold / package / amount / duplicate rules fail | **400** on payload/threshold/duplicate failure | CODE + CONFIG | **PASS** | Positivity checks (`amount>0`, `pkr_amount>0`, `dollar_rate>0`); `validateMinimumPaymentThreshold` → **400 MINIMUM_PAYMENT_NOT_MET** when an entry exists; duplicate `order_id`/`member_id` pre-check. Thresholds empty by default (PENDING mgmt, item #3 of confirmation status). |
| 4 | Partial receipts update remaining balance; final approval only when fully paid | Final approval blocked until balance 0 | CODE | **PASS** | `enforceLoanPartialFinalApprovalGate` sums `drm.gm_partial_receipts`; rejects with **409 PARTIAL_PAYMENT_INCOMPLETE** while `(target − received) > 0.009`. received + pending = total. |
| 5 | Loan GM requires Admin approval and return-date tracking | Cannot finalize until admin-approved; return date tracked | CODE | **PASS** | `gm_loan_terms.admin_approval_status` must be `APPROVED` (set by Super HOD/Admin) else **409 LOAN_ADMIN_APPROVAL_REQUIRED**; `gm_loan_terms` tracks `return_date`, `grace_period_days`, `return_status`. |
| 6 | Exactly three invoices generated at configured workflow point | 3 invoices; no duplicates | CODE + CONFIG | **PASS** | `generateDefaultInvoicesForGm` iterates the closed `INVOICE_TYPE_VALUES` (`LISTING_PAGE`, `MINIWEBSITE`, `PRODUCT_POSTING`); idempotent. Timing = `gmInvoiceGenerationTiming` (default `ON_GM_CREATION`). |
| 7 | Sales and Service invoice creation permissions match configured rule | Sales creators allowed; service_executive only when configured | AUTO + CODE + CONFIG | **PASS** | `requireManualInvoiceCreator` on `POST /api/invoices`: `admin`, `sales_executive`, `sales_manager`; `service_executive` admitted only if `serviceExecutiveCanCreateManualInvoice` (default false → **403**). Direct API tests cover admitted/denied. |
| 8 | HOD cannot approve invoice with missing customer / value / type | **400** on incomplete invoice | CODE | **PASS** | `assertApprovalReadiness` (`invoice-workflow.service.ts`) requires `customerId`, `amount>0`, and one of `invoiceType`/`serviceType`/`projectName` → **400 INCOMPLETE_INVOICE**. (No separate "GM link" field is enforced.) |
| 9 | Accounts approval enforces the readiness gate; payment proof is enforced at mark-paid | **400** when readiness / payment evidence missing | CODE | **PASS** | Account approval (`account-approve`) uses the **same** `assertApprovalReadiness` gate (customer + amount>0 + type). The **separate** `mark-paid` action (APPROVED→PAID) requires `paymentMethod`, `receiptReference`, matching `paidAmount` (`workflowMarkPaidSchema`). |
| 10 | Final invoice approval creates or enables exactly one linked project | One project per approved invoice | CODE | **PASS** | `createOrLinkProjectForApprovedInvoice` is idempotent (creates-or-links a single `INVOICE_ROOT` project); no duplicate project per approved invoice. |
| 11 | Project has correct status and department routing | Status per config; dept by invoice type | CODE + CONFIG | **PASS** | `resolveInitialDbStatus` ← `defaultProjectStatusAfterInvoiceApproval` (default `Active`); `departmentForInvoiceType`: `PRODUCT_POSTING`→Product Posting, `LISTING_PAGE`/`MINIWEBSITE`→DND. `OnHold` if PP dependency enabled & unmet. |
| 12 | Product Posting cannot start until linked Listing Page QA approval, when dependency enabled | Blocked (**409**) when enabled & QA pending | CODE + CONFIG | **PASS** | `assertProductPostingDependencySatisfied` → **409 LISTING_QA_PENDING**. Gated by `requireProductPostingWaitForListingQa` (default false). |
| 13 | Verification Manager lifecycle matches config | Labels reflect config; transitions unchanged | CODE + CONFIG | **PASS** | `getVerificationLifecycleLabels(required)` (`shared/verification-lifecycle.ts`) keyed by `verificationManagerRequiredAfterQa` (default true). **No transition logic changed.** |
| 14 | Accounts dashboard values match backend data | Dashboard = backend aggregates | CODE | **PASS** | `GET /api/accounts/dashboard/gm-summary` aggregates real tables (CTEs, one row per GM); loans deduped via `DISTINCT ON (gm_id)` → no double counting; widget binds the real endpoint with explicit empty/zero fallback (no mock data). |
| 15 | All workflow status changes recorded in audit / status history | Every transition audited | CODE | **PASS** | `recordGmSalesAudit` → `drm.activity_logs`; `drm.workflow_status_history`; `drm.cross_department_status_history` (P14); `drm.task_status_history`; `drm.product_posting_rework_history`. See `PATCH5_AUDIT_VERIFICATION.md`. |
| 16 | Dashboards and reports match backend status after each transition | UI = backend post-transition | CODE + MANUAL-PENDING | **PASS (logic)** | `CrossDepartmentStatusService` writes a post-transition ledger row + audit + next-dept notification; dashboards read backend. Per-transition UI reconciliation recommended as a manual pass before production. |

---

## Outcome

- **16/16 checks pass on logic/automated evidence.** Items 2 and 16 carry a
  **MANUAL-PENDING** note for full end-to-end UI verification with seeded data.
- No mock/placeholder data was introduced; no permissions were weakened.
- Config-gated business rules (items 3, 6, 7, 11, 12, 13) default to pre-Patch-5
  behaviour and remain **pending management confirmation** — see
  `PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`.
