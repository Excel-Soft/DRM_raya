# GM / Sales Enums & Status Mapping

Patch 5 defines **canonical** GM/Sales values in TypeScript
(`shared/gm-sales-constants.ts`). These do **not** replace the existing Postgres
enum types in `shared/schema.ts`. Where a canonical value differs from what the
database stores, use the fallback-safe mapping helpers (they never throw and
return `{ ok, value, warnings }`).

## Canonical vs database values

### GM type
Canonical: `FULL`, `PARTIAL`, `LOAN`.
DB reality: there is **no** GM-type enum for these. `drm.gm_entries.gm_entry_type`
is `GM | TempGM | RefundGM` (a different concept). Full/Partial/Loan is encoded by
the integer flags `is_loan` and `is_partial_payment`.

| Canonical | `is_loan` | `is_partial_payment` |
| --------- | --------- | -------------------- |
| FULL      | 0         | 0                    |
| PARTIAL   | 0         | 1                    |
| LOAN      | 1         | 0                    |

Helpers: `mapGmTypeToDbFlags()`, `mapDbFlagsToGmType()`.

### Invoice type
Canonical: `LISTING_PAGE`, `MINIWEBSITE`, `PRODUCT_POSTING`.
DB reality: stored today as the product-posting project name (free text).

| Canonical        | Product name (today)       |
| ---------------- | -------------------------- |
| LISTING_PAGE     | Listing Page               |
| MINIWEBSITE      | Alibaba Minisite           |
| PRODUCT_POSTING  | Alibaba Product Posting    |

Helper: `mapInvoiceTypeToProductName()`.

### Invoice status
Canonical: `DRAFT`, `PENDING_HOD`, `PENDING_ACCOUNT`, `APPROVED`, `REJECTED`,
`PAID`, `CANCELLED`.
DB reality — two distinct enums:
- `product_posting_invoices.product_invoice_status`:
  `PENDING_HOD | PENDING_ACCOUNT | APPROVED | REJECTED | CANCELLED`
  (no `DRAFT`, no `PAID`).
- legacy `invoices.invoice_status`:
  `Draft | Pending | Sent | Paid | Overdue | Cancelled`.

Helpers: `mapInvoiceStatusToProductDb()` (warns/returns ok:false for DRAFT/PAID),
`mapInvoiceStatusToLegacyDb()` (APPROVED→Sent, REJECTED→Cancelled, with warnings).

### GM workflow stages
Canonical (superset, for later workflow code): `DRAFT`, `SUBMITTED`, `PENDING_HOD`,
`PENDING_ACCOUNTS`, `PENDING_ADMIN`, `PARTIAL_PAYMENT_PENDING`, `PARTIAL_FULLY_PAID`,
`LOAN_RETURN_PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `PROJECT_CREATED`.
DB reality: `drm.gm_entries.status` is `Pending | Approved | Rejected | Completed`
plus separate flags/fields (`is_partial_payment`, `is_loan`, withdrawal/update
request fields). The richer canonical stages are not yet persisted; they are for
mapping/validation use until a confirmed schema change.

### Project initial status
Canonical: `ACTIVE`, `DOCUMENTS_PENDING`, `PENDING_PROJECT`, `IN_EXECUTION`.
DB reality: `drm.projects.status` is
`Active | Completed | OnHold | READY_FOR_QA | IN_EXECUTION`.

| Canonical          | DB `project_status`       |
| ------------------ | ------------------------- |
| ACTIVE             | Active                    |
| IN_EXECUTION       | IN_EXECUTION              |
| DOCUMENTS_PENDING  | *(no DB value — ok:false)* |
| PENDING_PROJECT    | *(no DB value — ok:false)* |

Helper: `mapProjectInitialStatusToDb()`. `DOCUMENTS_PENDING` / `PENDING_PROJECT`
require a future, management-confirmed addition to the `project_status` enum before
they can be persisted.

## Audit actions (`GM_SALES_AUDIT_ACTIONS`)
`gm.create`, `gm.type_change`, `gm.submit`, `gm.approve`, `gm.reject`,
`gm.partial_receipt_add`, `gm.partial_final_approve`, `gm.loan_terms_add`,
`gm.loan_admin_approve`, `gm.loan_return_update`, `invoice.auto_generate`,
`invoice.manual_create`, `invoice.hod_approve`, `invoice.hod_reject`,
`invoice.account_approve`, `invoice.account_reject`, `invoice.project_generate`,
`product_posting.dependency_locked`, `product_posting.dependency_unlocked`,
`workflow.transition` (plus `gm_sales.config_update` for config changes).

## Permission action keys (`GM_SALES_ACTION_KEYS`)
`gm.create`, `gm.create.full`, `gm.create.partial`, `gm.create.loan`, `gm.edit`,
`gm.submit`, `gm.approve.hod`, `gm.approve.accounts`, `gm.approve.admin`,
`gm.add_partial_receipt`, `gm.finalize_partial`, `gm.update_loan_return`,
`invoice.manual_create`, `invoice.auto_generate`, `invoice.hod_approve`,
`invoice.hod_reject`, `invoice.account_approve`, `invoice.account_reject`,
`invoice.mark_paid`, `invoice.generate_project`,
`product_posting.assign_when_dependency_met`.
