# Office Accounts — Sub-Module Inventory

Audit date: 2026-06-16. Stage 0 (audit only). Status values reflect the current
codebase, not work performed. Line numbers indicative as of audit date.
CRUD / Validation / Report-Export / Permission / Audit columns:
**P** = present, **~** = partial, **M** = missing/unconfirmed.

| Sub-module | Route | Page file | Backend endpoint | Table / source | CRUD | Validation | Report/Export | Permission | Audit | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Chart of Accounts | `/office/chart-of-accounts` | `client/src/pages/chart-of-accounts.tsx` | `GET /api/office/account-heads` | `drm.account_heads` | ~ | ~ | M | ~ | M | P0 |
| Account Head | `/office/account-head` (sidebar entry commented out) | `client/src/pages/office-account-head.tsx` | `POST /api/office/account-heads` | `drm.account_heads` | ~ | ~ | M | ~ | M | P1 |
| Old Account Head | `/office/old-account-head` | `client/src/pages/office-old-account-head.tsx` | none (static; `handleSearch` only logs) | n/a | M | M | M | M | M | P1 |
| Trial Balance Report | `/office/trial-balance-report` | `client/src/pages/office-trial-balance.tsx` | none (`handleGenerate` only logs) | (would aggregate ledger) | M | M | M | M | M | P0 |
| General / Company Ledger | `/account/ledger` | `client/src/pages/account-ledger.tsx` | `GET /api/account/ledger` | `drm.ledger_entries` | ~ | ~ | ~ | ~ | M | P1 |
| Journal Voucher | (field within expenses) | `client/src/pages/office-expenses.tsx` | `POST /api/office/expenses` (`voucher_number`) | `drm.office_expenses.voucher_number` | ~ | ~ | M | ~ | M | P2 |
| Office Expenses | `/office/expenses` | `client/src/pages/office-expenses.tsx` | `GET/POST /api/office/expenses` | `drm.office_expenses` | P | ~ (types only; no cheque-balance/amount-bound rules) | ~ | ~ | M | P0 |
| Cheque System | `/office/cheques` | `client/src/pages/cheque-system.tsx` | `GET /api/office/cheques` | `drm.cheques` | ~ | ~ | M | ~ | M | P1 |
| VAS Documents | `/office/vas-documents` | `client/src/pages/vas-documents.tsx` | `GET /api/service/vas/documents` | ⚠️ `drm.vas_documents` **not found** — confirm source | ~ | ~ | M | ~ | M | P1 |
| Office VAS | `/office/vas` | `client/src/pages/office-vas.tsx` | (verify in Stage 1) | (verify) | ~ | ~ | M | ~ | M | P1 |
| Business Customers | `/office/business-customers` | `client/src/pages/business-customers.tsx` | `GET /api/office/business-customers` | returns from `drm.customers` (not a dedicated `business_customers` source) — confirm intent | ~ | ~ | M | ~ | M | P1 |
| Account Reports | `/reports`, `/reports/:type` | `client/src/pages/user-reports.tsx` | `GET /api/reports/:type` | multiple | ~ | ~ | ~ | ~ | M | P1 |
| Donations | `/account/donations` | `client/src/pages/account-donations.tsx` | `POST /api/account/donations` | `drm.donations` | P | ~ | M | ~ | M | P1 |
| Dollar System | `/account/dollar-system` | `client/src/pages/dollar-system.tsx` | `POST /api/account/dollar-buying` | `drm.dollar_buying`, `drm.dollar_buyers` | P | ~ | M | ~ | M | P1 |
| Invoices (Make Invoice) | `/account/invoices` | `client/src/pages/account-invoices.tsx` | `GET /api/account/invoices` | `drm.invoices` | ~ | ~ | ~ | ~ | M | P0 |
| Create GM | `/account/gm-entries` | `client/src/pages/account-gm-entries.tsx` | `/api/account/gm-entries` (verify) | `drm.gm_entries` | ~ | ~ | ~ | ~ | M | P0 |
| Add Temp GM | `/account/temp-gm` | `client/src/pages/account-temp-gm.tsx` | (verify in Stage 1) | (verify) | ~ | ~ | M | ~ | M | P1 |
| Add Refund GM | `/account/refund-gm` | `client/src/pages/account-refund-gm.tsx` | `/reports/refund-entries` etc. (`server/reports-routes.ts`) | `drm.refund_gm_entries` | ~ | ~ | ~ | ~ (owner scope on non-privileged) | M | P0 |
| AB Report | `/account/ab-report` | `client/src/pages/ab-report.tsx` | (verify in Stage 1) | (verify) | ~ | ~ | ~ | ~ | M | P1 |

## Notes / flags

- **Static (no backend wiring):** Old Account Head and Trial Balance Report — both
  only `console.log` on action; no API call.
- **`vas_documents` table not found in `drm`** under that name — the VAS Documents
  page reads `/api/service/vas/documents`; confirm the real table/view in Stage 1.
- **Business Customers** returns data mapped from `drm.customers` rather than a
  dedicated `business_customers` table — confirm whether this is intended.
- **Financial writes:** Office Expenses POST validates types (Zod) but not business
  rules (amount bounds, cheque balance). Generalize this check across GM / refund /
  donation / invoice / dollar / cheque flows in Stage 1 before any changes.
- **Audit logging** is unconfirmed for nearly all financial mutations — verify
  `ActivityLogService` coverage per sub-module in Stage 1.
- **Endpoints marked "(verify in Stage 1)"** are inferred from routing/sidebar and
  must be confirmed against the actual backend before any Stage-2 change.
- No financial workflow, approval logic, role, or schema was modified in Stage 0.

## Patch 6 Stage 7 update (2026-06-22)

The Stage 0 table above is preserved as the original audit snapshot. The
following reflects the **current** state after Stage 7 (Office Accounts Full
Closure). See `PATCH6_STAGE7_OFFICE_ACCOUNTS_CHANGELOG.md`,
`OFFICE_ACCOUNTS_RETAIN_REMOVE_DECISION.md`, `OFFICE_ACCOUNTS_QA_MATRIX.md`, and
`TRIAL_BALANCE_FORMULA.md`.

| Sub-module | Now | Backend endpoint(s) | CRUD | Validation | Report/Export | Permission | Audit |
|---|---|---|---|---|---|---|---|
| Trial Balance Report | **Backend-backed** (was static `console.log`) | `GET /api/office/trial-balance`; `GET /api/office/trial-balance/export` | read | P (date order, inclusive end, currency safety) | P (CSV, gated+audited) | P (export `trial_balance.export`) | P (export) |
| Office Expenses | **Hardened + editable** | `GET/POST/PATCH/DELETE /api/office/expenses` | P | P (`amount>0`, valid date, mass-assignment guard) | P (CSV/Excel) | P (`expense.create/update/delete`) | P (create/update/delete, before/after) |
| Office VAS | **Shared helper** (was raw `fetch`) | `GET /api/office/vas` | read | n/a | M | auth-only read | n/a (read) |
| Account Head | **MERGE → Chart of Accounts** (route redirects) | n/a | — | — | — | — | — |
| Old Account Head | **REMOVE (route redirects)** | n/a | — | — | — | — | — |

- **No schema changes** in Stage 7 (`db:push` broken on a pre-existing FK type
  mismatch → additive runtime DDL only; none was needed).
- Dead/mock UI controls removed: Trial Balance parent/child/office multiselects;
  Office Expenses Parent/Child/Transactional head filters. Remaining filters map
  to real columns only.
