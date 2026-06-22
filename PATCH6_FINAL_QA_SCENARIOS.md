# PATCH 6 — Final QA Scenarios (Stage 10, Section C)

Date: 2026-06-22. The 18 required scenarios below, each with **how it was tested**,
**evidence**, and an **honest result**. Result vocabulary:
- **PASS (executed)** — verified live in the running app this stage.
- **CODE-VERIFIED** — enforcement proven in source (guard/validation/persistence), but
  the full functional happy-path walkthrough is **UAT-PENDING**.
- **UAT-PENDING** — live role-based browser execution outstanding (per DoD: PENDING,
  never a fabricated pass).
- **MGMT** — blocked on a management business-rule decision.

---

### 1. Anonymous user hits every protected API → 401/403
**Test:** 16-endpoint anonymous sweep via curl. **Evidence:** all protected `/api/*` →
**401** (`missing-token`); disabled Support → **404**. **Result: PASS (executed).**

### 2. Unauthorized authenticated role → 403 on sensitive actions
**Test:** signed JWTs for 14 roles against middleware-guarded actions.
**Evidence:** `attributes.create`/`attributes.delete` → **403** for all non-FULL_ACCESS
roles; `gm.create` → **403** for all non-initiator roles (incl. sales_manager,
service_executive). Allowed roles pass to handler (400/200). **Result: PASS (executed)**
for the action-permission + GM-sales guard families. Broader per-route coverage of every
mutation is **UAT-PENDING** (SEC-003 adoption is not universal).

### 3. Sales Executive creates valid & invalid GM; invalid fails with clear errors
**Test/Evidence:** `POST /api/gm` guarded by `requireGmSalesActionPermission(GM_CREATE)`
(`gm-pool-routes.ts:425`); body validated by `createSchema` (zod) + threshold check in
`gm-create-policy.service.ts`; duplicate company blocked by unique index. Live: an empty
body as `sales_executive` returns **400** (validation rejects) — invalid path proven;
the **valid** create happy-path is **UAT-PENDING**. **Result: CODE-VERIFIED / UAT-PENDING.**

### 4. Service Executive GM/invoice participation fully functional OR fully hidden/disabled
**Test/Evidence:** config flags `serviceExecutiveCanCreateGM` /
`serviceExecutiveCanCreateManualInvoice` default **false** (`shared/gm-sales-constants.ts`);
live `gm.create` as `service_executive` → **403**. So participation is **fully disabled**
by default (the management-decided state). **Result: PASS (executed, disabled state)** —
enabling is **MGMT** (item A/H).

### 5. Full / Partial / Loan GM each follow approved workflow path
**Evidence:** `resolveCanonicalGmType` (FULL/PARTIAL/LOAN) + `getInitialGmDbState`
(`gm-create-policy.service.ts`); state machines in `GM_TYPE_WORKFLOW_RULES.md`,
`GM_SALES_STATE_MACHINE.md`; approval routes `gm-pool/:id/{hod,account-manager,sales-manager,super-hod}-approve`.
**Result: CODE-VERIFIED / UAT-PENDING** (per-type live workflow) + **MGMT** (thresholds, item A).

### 6. Partial GM receipt collection blocks final approval until all-paid
**Evidence:** `enforceLoanPartialFinalApprovalGate` sums `drm.gm_partial_receipts`;
remaining > 0.009 → **`PARTIAL_PAYMENT_INCOMPLETE`** (`gm-pool-routes.ts:194–215`);
`PARTIAL_GM_RECEIPT_WORKFLOW.md`. **Result: CODE-VERIFIED / UAT-PENDING.**

### 7. Loan GM requires approved terms, Admin approval, return-date, overdue reporting
**Evidence:** gate checks `drm.gm_loan_terms.admin_approval_status='APPROVED'`
(`gm-pool-routes.ts:228`); `loanGmTermsSchema` requires `loanAmount`+`expectedReturnDate`
(`gm.validators.ts`); overdue job `server/jobs/overdue-checker.ts`; report
`GET /api/gm-pool/loan-return-report`; `LOAN_GM_WORKFLOW.md`.
**Result: CODE-VERIFIED / UAT-PENDING.**

### 8. Invoice HOD/Accounts approval rejects invalid role/stage/customer/proof/amount/type/duplicate
**Evidence:** `requireRole("hod","super_hod","admin")` / `requireRole("account_manager","admin")`;
`assertApprovalReadiness` rejects missing `customerId`, `amount<=0`, missing `invoiceType`
(`invoice-workflow.service.ts:186`); `findActiveDuplicate` blocks duplicates unless
manager/admin override+reason; `INVOICE_TYPE_AND_APPROVAL_RULES.md`. **Caveat:** legacy raw
status route **INV-001** (`account-routes.ts` PATCH status) remains **Open** (no workflow/
audit). **Result: CODE-VERIFIED / UAT-PENDING; INV-001 Open.**

### 9. Final Accounts approval creates or links exactly one project
**Evidence:** `accountDecision` → `createOrLinkProjectForApprovedInvoice`
(`invoice-to-project.service.ts:419`) idempotent via `uq_projects_invoice_root` (find-or-create).
**Caveat:** project generation is **best-effort** — failure does **not** block invoice
approval (`invoice-routes.ts`). **Result: CODE-VERIFIED / UAT-PENDING** (verify re-run →
same project; verify behaviour when generation fails).

### 10. Product Posting cannot start before Listing-Page QA approval (if dependency on)
**Evidence:** `assertProductPostingDependencySatisfied` checks PENDING dependency in
`drm.project_dependencies`, 409 `LISTING_QA_PENDING`; release via `satisfyListingQaDependencies`
(`invoice-to-project.service.ts:266/320`); `PRODUCT_POSTING_LISTING_QA_DEPENDENCY.md`.
**Default `requireProductPostingWaitForListingQa` = OFF.** **Result: CODE-VERIFIED / UAT-PENDING + MGMT (item C).**

### 11. Server Names add/edit/delete/list persists after refresh
**Evidence:** `it-servers.tsx` ↔ `it-assets-routes.ts` ↔ `it-assets.repository.ts`;
tables `drm.it_servers/it_domains/it_registries/it_hosting_packages`; zod validation;
`DOMAIN_HOSTING_SERVER_NAMES_QA.md` confirms persistence across refresh. **Caveat:** other
IT entities full-CRUD is **DOM-002 Partial** (Add-Domain wiring). **Result: CODE-VERIFIED / UAT-PENDING.**

### 12. Support module fully hidden/disabled/removed if out of scope
**Test/Evidence:** flags `SUPPORT_MODULE_ENABLED` / `VITE_SUPPORT_MODULE_ENABLED` default
**OFF**; live `GET /api/support/tickets` → **404**; UI routes render `SupportInactive`;
nav hidden (code). **Result: PASS (executed: `/api/support/tickets`→404); CODE-VERIFIED
(nav hidden, `SupportInactive` UI)** — **MGMT (item I)**: confirm remove vs keep
soft-disabled (data preserved in `drm.support_tickets`).

### 13. Social Media Posting create/edit/delete/schedule/list persists + updates dashboard
**Evidence:** `social-media.tsx` ↔ `social-media-routes.ts`; `drm.social_media_posts`;
DRAFT→PENDING→APPROVED/REJECTED; **internal/manual** posting (no external API);
`SOCIAL_MEDIA_POSTING_WORKFLOW.md`. **Result: CODE-VERIFIED / UAT-PENDING** (live create→
schedule→dashboard metric refresh).

### 14. Every Office Accounts submodule uses real backend data (no hardcoded/console-only)
**Evidence:** Expenses (`drm.office_expenses`), Chart of Accounts (`drm.account_heads`),
General Ledger (`drm.ledger_entries`), Trial Balance (live compute, de-mocked), Cheques
(`drm.cheques`), Donations (`drm.donations`), Dollar (`drm.dollar_buying`) — all **live**.
Old Account Head **removed/redirected** to Chart of Accounts.
`OFFICE_ACCOUNTS_SUBMODULE_INVENTORY.md`. **Caveats:** OFF-002/OFF-003 originally Open
(legacy stubs) — addressed/redirected; OFF-005 VAS source is **MGMT (item J)**.
**Result: CODE-VERIFIED / UAT-PENDING; residual MGMT on VAS source.**

### 15. Raw Attendance, Salary, Event, Reception, Daily Target, Diagnosis, BV reports — correct filtered data + export parity
**Evidence:** `PATCH6_REPORT_EXPORT_PARITY_RESULTS.md` confirms same-source/same-filter/
same-scope/audited parity; export via `server/utils/financial-export.ts` +
`client/src/lib/export-utils.ts`. **MGMT:** REP-001 source (item L), REP-002 salary formula
(item E), REP-004 day-target basis (item K), REP-005 BV migration (item F).
**Result: CODE-VERIFIED / UAT-PENDING; several MGMT.**

### 16. Service followups/complaints/dropouts/renewals validate required fields + update reports/status
**Evidence:** `server/validators/service.validators.ts` (outcome/reason/amount>0 mandatory);
`service-lifecycle.service.ts` + `cross-department-status.service.ts` drive transitions.
**Caveat:** SRV-002 (full zod + per-action guard on every service write) is **Partial**;
SRV-001 service→GM/VAS/BV bridge returns 501 → **MGMT (item H)**.
**Result: CODE-VERIFIED / UAT-PENDING; SRV-001 MGMT, SRV-002 Partial.**

### 17. Build / type-check / tests pass in Replit
**Evidence:** `npm ci` exit 0; `npm run check` 0 errors; `npm run build` exit 0 (chunk
advisory only); `npm test` 219/219 pass. **Result: PASS (executed).** See
`PATCH6_BUILD_TYPECHECK_REPORT.md`.

### 18. No browser console errors in critical flows
**Evidence:** boot console = `[vite] connecting...` → `[vite] connected.` only (no errors).
**Caveat:** a full authenticated walkthrough of every critical flow (GM create→approve,
invoice approve→project, reports export, etc.) capturing console is **UAT-PENDING** (needs
seeded role logins). **Result: PARTIAL — boot clean; critical-flow console audit UAT-PENDING.**

---

## Scenario tally
- **PASS (executed):** 1, 2, 4, 12, 17 (and the disabled/permission portions of 3).
- **CODE-VERIFIED / UAT-PENDING:** 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16.
- **PARTIAL:** 18 (boot clean; full flow pending).
- **Management decisions still blocking closure:** scenarios 4(enable), 5, 10, 12, 14, 15, 16
  — a subset of the **12 decision items (A–L)**: A, C, E, F, H, I, J, K, L.
