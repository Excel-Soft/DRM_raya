# PATCH 5 — Permission QA Matrix

Authoritative server-side permission behaviour for every Patch 5 GM/Sales action.
"Expected" and "Actual" are derived from the enforcing guard in code; where an
automated direct-API test exists it is cited under **Evidence**.

**Conventions**
- Denial of an authenticated-but-unauthorised role returns **403 FORBIDDEN**;
  an unauthenticated caller returns **401 UNAUTHENTICATED**.
- `admin` always passes (explicit bypass). **`super_admin` normalizes to `admin`**
  (`normalizeRole`), so it has identical access — shown together as `admin*`.
- `service_executive` cells marked **(cfg)** are allowed **only** when the relevant
  config flag is `true`; both flags default `false` (see
  `PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`).
- `dd_manager` appears in the Product-Posting assign guard but is outside the 15-role
  review set; noted where relevant.
- **Evidence**: `AUTO` = direct API test in `server/patch5-stage7-role-matrix.test.ts`;
  `CODE` = inspection of the cited guard.

---

## Master grid (default config)

`✓` = allowed · `✗` = denied (403) · `(cfg)` = allowed only when config flag on

| Role | FULL GM | PARTIAL GM | LOAN GM | Add receipt | Finalize partial | Add loan terms | Admin approve loan | Manual invoice | HOD appr/rej inv | Acct appr/rej inv | Generate project | Assign PP | QA approve | Verify complete | View dashboard |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| admin* (admin/super_admin) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| super_hod | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| sales_executive | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| sales_manager | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| service_executive | (cfg) | (cfg) | (cfg) | ✗ | ✗ | ✗ | ✗ | (cfg) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| service_manager | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| hod | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| account_manager | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| pms_manager | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| product_posting_manager | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓† | ✗ | ✗ | ✓ |
| product_posting_executive | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| qa_manager | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓† | ✓ | ✗ | ✓ |
| verification_manager | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| unauthorized / ordinary | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗(401) |

† "Assign PP" role-allows `product_posting_manager`, `qa_manager`, `dd_manager`, `admin*`.
Even for allowed roles, assignment returns **409 LISTING_QA_PENDING** when
`requireProductPostingWaitForListingQa` is on and the linked Listing-Page QA is not yet
approved (default off → no block).

"View dashboard" = `GET /api/accounts/dashboard/gm-summary`: gated by the global
`authMiddleware` + `checkUrlPermission` (admin-configurable `drm.url_permissions`,
default-allow for unconfigured paths) — identical to every sibling account endpoint.
Any authenticated role passes by default; restrict by adding a `url_permissions` row.

---

## Per-action detail

For every action: **Expected == Actual** (verified). All denied roles return **403**
(unauth **401**). `pass` unless noted.

### create FULL / PARTIAL / LOAN GM — `POST /api/gm`
- **Guard:** `requireGmSalesActionPermission(GM_CREATE)` then type-specific narrowing
  (`gm-pool-routes.ts:425`).
- **Allowed (default):** `admin*`, `sales_executive` (initiator), `super_hod`
  (`gmCreateOverrideRoles`). `service_executive` **(cfg** `serviceExecutiveCanCreateGM`**)**.
  `loanGmCreationEnabled=true` permits LOAN.
- **Pass/fail:** PASS. **Evidence:** AUTO (sales_executive ✓, service_executive ✗
  default, admin ✓, unauth 401) + CODE.
- **Note:** the account-side path `POST /api/account/gm-entries`
  (`GM_CREATE_ACCOUNT`) allows `admin*`, `account_manager`, `hod`, `super_hod`,
  `sales_manager`.

### add partial receipt — `GM_ADD_PARTIAL_RECEIPT`
- **Allowed:** `admin*`, `sales_executive`, `sales_manager`, `account_manager`. PASS. CODE.

### finalize partial payment — `GM_FINALIZE_PARTIAL`
- **Allowed:** `admin*`, `account_manager`, `hod`, `super_hod`. PASS. CODE.
- **Note:** additionally **409 PARTIAL_PAYMENT_INCOMPLETE** if balance > 0 regardless of role.

### add loan terms — `POST /gm-pool/:id/loan-terms` (`GM_UPDATE_LOAN_RETURN`)
- **Allowed:** `admin*`, `account_manager`, `sales_manager`. PASS. CODE.

### admin approve loan — `GM_APPROVE_ADMIN`
- **Allowed:** `admin*`, `super_hod`. PASS. CODE.
- **Note:** finalisation also requires `gm_loan_terms.admin_approval_status = APPROVED`
  (**409 LOAN_ADMIN_APPROVAL_REQUIRED** otherwise).

### create manual invoice — `POST /api/invoices` (`requireManualInvoiceCreator`)
- **Allowed:** `admin*`, `sales_executive`, `sales_manager`. `service_executive`
  **(cfg** `serviceExecutiveCanCreateManualInvoice`**)**. `account_manager` **not**
  admitted on this canonical route. PASS. **Evidence:** AUTO + CODE.

### HOD approve / reject invoice — `requireRole("hod","super_hod","admin")`
- **Allowed:** `admin*`, `hod`, `super_hod`. PASS. CODE.
- **Note:** approval also enforces `assertApprovalReadiness` (**400 INCOMPLETE_INVOICE**).

### Account approve / reject invoice — `requireRole("account_manager","admin")`
- **Allowed:** `admin*`, `account_manager`. PASS. CODE.
- **Note:** mark-PAID requires `paymentMethod` + `receiptReference` + matching `paidAmount`.

### generate project — `POST /api/invoices/:id/generate-project`
- **Guard:** `requireRole("account_manager","admin","product_posting_manager")`.
- **Allowed:** `admin*`, `account_manager`, `product_posting_manager`. PASS. CODE.
- **Note:** idempotent; non-APPROVED invoice → **400 GENERATION_FAILED**.

### assign Product Posting (before / after Listing QA) — `POST .../projects/:projectId/assign-task`
- **Guard:** `requireRole("product_posting_manager","dd_manager","qa_manager","admin")`
  + `assertProductPostingDependencySatisfied`.
- **Allowed (role):** `admin*`, `product_posting_manager`, `qa_manager`, `dd_manager`.
- **Before QA:** allowed when dependency disabled (default); **409 LISTING_QA_PENDING**
  when `requireProductPostingWaitForListingQa` on & QA pending. **After QA:** allowed.
  PASS. CODE.

### QA approve Listing Page — `POST .../tasks/:taskId/qa-review`
- **Guard:** `requireRole("qa_manager","admin")`. **Allowed:** `admin*`, `qa_manager`.
  PASS. CODE.

### Verification complete — `POST .../tasks/:taskId/verification-review`
- **Guard:** `requireRole("verification_manager","admin")`. **Allowed:** `admin*`,
  `verification_manager`. PASS. CODE.

### export / view Accounts dashboard — `GET /api/accounts/dashboard/gm-summary`
- **Guard:** global `authMiddleware` + `checkUrlPermission` (default-allow unconfigured).
  Any authenticated role passes by default; unauth **401**. PASS. CODE.
- **Note:** to restrict to Accounts roles, add a `drm.url_permissions` row — a data/config
  action, consistent with all sibling account endpoints (no code change; respects the
  "no permission changes" constraint).

---

## Coverage note (honesty)

Direct automated API permission tests (`AUTO`) currently cover the two highest-risk
creation paths — `POST /api/gm` and `POST /api/invoices` — across admitted, denied,
config-gated and unauthenticated roles (20 assertions, all green). The remaining
actions are verified by **CODE** inspection of their `requireRole` /
`requireGmSalesActionPermission` guards. Extending the direct-API suite to the
approval, finalisation, loan, project-generation and dependency endpoints is a
recommended hardening follow-up (not a feature; outside this stage's "no new features"
scope).
