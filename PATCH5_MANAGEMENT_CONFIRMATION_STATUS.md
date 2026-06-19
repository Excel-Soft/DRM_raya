# PATCH 5 — Management Confirmation Status

Status of the seven business rules that **cannot be inferred from code** and require
explicit management sign-off. Per the Patch 5 constraints, **no business assumption
was hard-coded**: each rule is backed by an admin-controlled config key in
`drm.gm_sales_workflow_config` (read via `server/services/gm-sales-config.service.ts`,
defaults in `shared/gm-sales-constants.ts → GM_SALES_CONFIG_DEFAULTS`). Every default
was chosen to **preserve the system's pre-Patch-5 behaviour** until management
confirms otherwise.

Legend — **Status**: `PENDING` = awaiting management decision (default in force);
`CONFIRMED` = management has confirmed and config matches.

---

### 1. Is Service Executive allowed to create GM records?
- **Config key / current value:** `serviceExecutiveCanCreateGM = false`
- **Source of decision:** Default only (preserves "not an officially sanctioned
  initiator"). Origin: `PATCH5_MANAGEMENT_CONFIRMATION_REQUIRED.md` Q1.
- **Status:** **PENDING**
- **Effect on behaviour:** With `false`, `service_executive` is rejected with **403
  FORBIDDEN** at `POST /api/gm` (and the type-specific gates). The Service-Executive
  "Add GM" control is hidden client-side via `ui-config`. Flip to `true` to admit.
- **Impacts:** P1, P13.

### 2. Is Service Executive allowed to create manual invoices?
- **Config key / current value:** `serviceExecutiveCanCreateManualInvoice = false`
- **Source of decision:** Default only. Origin: confirmation doc Q2.
- **Status:** **PENDING**
- **Effect on behaviour:** With `false`, `service_executive` is rejected with **403
  FORBIDDEN** at `POST /api/invoices` (enforced by `requireManualInvoiceCreator`).
  Canonical creators remain `admin`, `sales_executive`, `sales_manager`. Flip to
  `true` to admit `service_executive`.
- **Impacts:** P7, P13.

### 3. What minimum payment thresholds are configured?
- **Config key / current value:** `minimumPaymentThresholds = {}` (empty)
- **Source of decision:** Default only — empty map = **no threshold enforcement**
  (current behaviour: positivity checks `amount > 0`, `pkr_amount > 0`,
  `dollar_rate > 0` only). Origin: confirmation doc Q3.
- **Status:** **PENDING**
- **Effect on behaviour:** Enforcement is presence-based per `(gmType, package)`.
  When an entry exists and the amount is below it, GM creation is rejected with
  **400 MINIMUM_PAYMENT_NOT_MET**. With `{}`, no minimum is applied.
- **Impacts:** P3.

### 4. When are the three default invoices generated?
- **Config key / current value:** `gmInvoiceGenerationTiming = ON_GM_CREATION`
  (other supported value: `AFTER_FINAL_GM_APPROVAL`)
- **Source of decision:** Default preserves current behaviour (invoices created at
  GM creation). Origin: confirmation doc Q4.
- **Status:** **PENDING**
- **Effect on behaviour:** Exactly three zero-amount invoices (`LISTING_PAGE`,
  `MINIWEBSITE`, `PRODUCT_POSTING`) are generated at the configured event by
  `generateDefaultInvoicesForGm`; generation is idempotent (no duplicates per GM).
- **Impacts:** P6, P9.

### 5. Is Product Posting blocked until Listing Page QA?
- **Config key / current value:** `requireProductPostingWaitForListingQa = false`
- **Source of decision:** Default preserves current behaviour (no hard backend
  dependency). Origin: confirmation doc Q5.
- **Status:** **PENDING**
- **Effect on behaviour:** With `false`, Product-Posting task assignment is not
  blocked. With `true`, `assertProductPostingDependencySatisfied` rejects assignment
  with **409 LISTING_QA_PENDING** until the linked Listing-Page QA is approved, and
  the generated project starts `OnHold`.
- **Impacts:** P10.

### 6. Is Verification Manager required after QA?
- **Config key / current value:** `verificationManagerRequiredAfterQa = true`
- **Source of decision:** Default reflects current product-posting lifecycle
  (`QA_COMPLETE → VERIFICATION_PENDING → VERIFICATION_COMPLETE`). Confirmation still
  required for whether Verification is mandatory **uniformly across all departments**.
  Origin: confirmation doc Q6.
- **Status:** **PENDING**
- **Effect on behaviour:** **Labels only** are config-aware
  (`getVerificationLifecycleLabels`): when `true`, dashboards show "QA Complete →
  Verification Pending → Verification Complete"; when `false`, post-QA collapses to
  "QA Complete" as terminal. **No transition logic was changed** in this patch.
- **Impacts:** P11.

### 7. What is the initial project status after invoice approval?
- **Config key / current value:** `defaultProjectStatusAfterInvoiceApproval = ACTIVE`
  (other supported values: `DOCUMENTS_PENDING`, `PENDING_PROJECT`, `IN_EXECUTION`)
- **Source of decision:** Default preserves current behaviour (`create-project-from-gm`
  sets `Active`). Origin: confirmation doc Q7.
- **Status:** **PENDING**
- **Effect on behaviour:** Projects created/linked from an approved invoice start at
  the configured status (default `Active`), except when the Product-Posting
  dependency (Q5) is enabled and unmet, in which case the project starts `OnHold`.
- **Impacts:** P9, P12.

---

## Summary

| # | Question | Config key | Value | Status |
| - | -------- | ---------- | ----- | ------ |
| 1 | Service Exec create GM | `serviceExecutiveCanCreateGM` | `false` | PENDING |
| 2 | Service Exec create manual invoice | `serviceExecutiveCanCreateManualInvoice` | `false` | PENDING |
| 3 | Minimum payment thresholds | `minimumPaymentThresholds` | `{}` | PENDING |
| 4 | Default invoice timing | `gmInvoiceGenerationTiming` | `ON_GM_CREATION` | PENDING |
| 5 | Product Posting waits for Listing QA | `requireProductPostingWaitForListingQa` | `false` | PENDING |
| 6 | Verification Manager required after QA | `verificationManagerRequiredAfterQa` | `true` | PENDING |
| 7 | Initial project status | `defaultProjectStatusAfterInvoiceApproval` | `ACTIVE` | PENDING |

All seven remain **PENDING management confirmation**. Each is changeable at runtime by
an `admin` via `PATCH /api/gm-sales-workflow/config` without code changes; every change
is audited (`gm_sales.config_update`).
