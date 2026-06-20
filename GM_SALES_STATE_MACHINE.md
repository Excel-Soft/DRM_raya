# GM / Sales State Machine

Patch 6 — Stage 3 reference for the GM (General Manager money-entry) and Sales
workflow. This documents the **already-implemented** GM type machine, initiator
guards, minimum-payment thresholds, Partial-receipt collection, and the Loan
admin gate. Nothing here changes a management-confirmed business rule: every
behaviour that would alter the current flow is gated behind
`drm.gm_sales_workflow_config` with safe defaults that preserve today's behaviour.

## Source of truth

| Concern | Location |
| --- | --- |
| Canonical enums + legal-transition maps | `shared/gm-sales-constants.ts` |
| Config (keys, defaults, descriptions) | `shared/gm-sales-constants.ts` (`GM_SALES_CONFIG_DEFAULTS`) |
| Config service (table ensure/seed, get/patch) | `server/services/gm-sales-config.service.ts` |
| Config API | `server/routes/gm-sales-workflow-routes.ts` |
| GM creation / lifecycle (sales) | `server/gm-pool-routes.ts` |
| GM creation / lifecycle (accounts) | `server/account-routes.ts` |
| GM type/threshold validation | `server/services/gm-sales-validation.service.ts`, `server/services/gm-create-policy.service.ts` |
| Central transition guard | `server/services/workflow-status.service.ts`, `server/services/workflow-transition.service.ts` |
| Audit | `server/services/gm-sales-audit.ts` (writes to `drm.activity_logs`) |

## GM type (FULL / PARTIAL / LOAN)

Canonical GM type is **derived from integer flags** on `drm.gm_entries`, not from
`gm_entry_type` (which remains `GM` / `TempGM` / `RefundGM`):

| Canonical type | `is_loan` | `is_partial_payment` | Route |
| --- | --- | --- | --- |
| `FULL` | 0 | 0 | Standard full GM approval / payment route |
| `PARTIAL` | 0 | 1 | Receipt-collection route, all-paid gate |
| `LOAN` | 1 | 0 | Loan-terms + admin approval + return tracking |

Mapping helpers are fallback-safe (`mapGmTypeToDbFlags`, `mapDbFlagsToGmType` in
`shared/gm-sales-constants.ts`) and never throw. If both flags are set the record
is treated as `LOAN` with a warning. GM type is required on submission; a type
change after submission is blocked for non-elevated roles (sales executives are
hard-blocked from patching once the entry moves past `pending_hod`,
`server/gm-pool-routes.ts`).

## Logical GM stage machine

The GM record has no single status column — its stage is derived from
`gm_entries` + `gm_loan_terms` (`deriveOfficialGmStatus`). The legal logical
transitions (`GM_LEGAL_TRANSITIONS`) are:

```
DRAFT                   -> SUBMITTED | CANCELLED
SUBMITTED               -> PENDING_HOD | CANCELLED
PENDING_HOD             -> PENDING_ACCOUNTS | REJECTED | CANCELLED
PENDING_ACCOUNTS        -> PENDING_ADMIN | PARTIAL_PAYMENT_PENDING | APPROVED | REJECTED | CANCELLED
PENDING_ADMIN           -> APPROVED | LOAN_RETURN_PENDING | REJECTED | CANCELLED
PARTIAL_PAYMENT_PENDING -> PARTIAL_FULLY_PAID | CANCELLED
PARTIAL_FULLY_PAID      -> APPROVED | CANCELLED
LOAN_RETURN_PENDING     -> APPROVED | CANCELLED
APPROVED                -> PROJECT_CREATED
PROJECT_CREATED         -> (terminal)
REJECTED                -> (terminal)
CANCELLED               -> (terminal)
```

Illegal transitions are rejected by the central `WorkflowStatusService` before any
row is written.

## Initiator role guards (section B)

GM creation is permission-gated, not auth-only:

- Sales entry `POST /api/gm` (`server/gm-pool-routes.ts`, router mounted at `/api`) →
  `requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_CREATE)`.
- Accounts entry `POST /api/account/gm-entries` (`server/account-routes.ts`) →
  `requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_CREATE_ACCOUNT)`.
- Loan admin gate → `requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ADMIN)`.

Allowed initiator roles are config-driven:

| Config key | Default | Meaning |
| --- | --- | --- |
| `fullGmAllowedInitiatorRoles` | `["sales_executive"]` | Roles that may initiate a FULL GM |
| `partialGmAllowedInitiatorRoles` | `["sales_executive"]` | Roles that may initiate a PARTIAL GM |
| `loanGmAllowedInitiatorRoles` | `["sales_executive"]` | Roles that may initiate a LOAN GM |
| `accountGmAllowedInitiatorRoles` | `["account_manager","hod","super_hod","sales_manager"]` | Roles for the Accounts GM endpoint |
| `serviceExecutiveCanCreateGM` | `false` | Service Executive GM creation (off until management confirms) |
| `gmCreateOverrideRoles` | `["admin","super_hod"]` | Elevated override roles (every override is audited) |
| `loanGmCreationEnabled` | `true` | When false, LOAN GM submissions are rejected |

Unauthorized roles receive **403** from both UI and direct API. Every creation
stores `created_by` (`req.user.userId`) and `created_by_role` (active role at
creation time) on `drm.gm_entries` and is audited.

## Minimum payment thresholds (section D)

`minimumPaymentThresholds` config is a map `{ [gmType]: { [package]: minAmount } }`.
**Empty (`{}`) by default = no enforcement** — thresholds are only applied once
management seeds them. When present, the amount is validated:

- before GM submission, and
- before HOD approval

via `server/services/gm-sales-validation.service.ts` /
`server/services/gm-create-policy.service.ts`. A below-threshold GM is rejected
with a clear backend error (mirrored in the UI). No thresholds are hardcoded.

## Partial GM receipts (section E)

Table `drm.gm_partial_receipts` (`shared/schema.ts`, created at runtime in
`server/db/ensure.ts`): `id`, `gm_id`, `amount_usd`, `amount_pkr`, `dollar_rate`,
`receipt_date`, `method`, `reference`, `notes`, `collected_by`, `created_at`.

Endpoints (`server/gm-pool-routes.ts`):

| Method + Path | Purpose |
| --- | --- |
| `GET /api/gm-pool/:id/partial-receipts` | List receipts + running payment summary (remaining balance) |
| `POST /api/gm-pool/:id/partial-receipts` | Record a receipt (amount > 0; PARTIAL GM only) |
| `POST /api/gm-pool/:id/finalize-partial` | Finalize once the all-paid gate passes |

There is no dedicated individual-receipt `PATCH`/`DELETE` endpoint; the running
payment summary (remaining balance) is returned inline by the `GET` above rather
than by a separate `payment-summary` route.

Rules: only a PARTIAL GM accepts receipts; the remaining balance is recalculated
after every receipt; **final approval is blocked while a balance remains**
(`remaining > 0.009` → HTTP 409 in `server/account-routes.ts`); every receipt
action is audited.

## Loan GM approval + return tracking (section F)

Table `drm.gm_loan_terms` (one row per GM, `gm_id` unique): `loan_amount_usd`,
`company_copay_usd`, `agreed_return_date`, `admin_approval_status`
(`PENDING`/`APPROVED`/`REJECTED`), `admin_approved_by/at`, `admin_comment`,
`return_status`, `returned_at`, `created_by`.

Endpoints (`server/gm-pool-routes.ts`):

| Method + Path | Purpose |
| --- | --- |
| `GET /api/gm-pool/:id/loan-terms` | Read loan terms |
| `POST /api/gm-pool/:id/loan-terms` | Create loan terms (return date required) |
| `PATCH /api/gm-pool/:id/loan-terms` | Edit loan terms (re-arms the admin gate to PENDING) |
| `GET /api/gm-pool/loan-admin-queue` | Admin approval queue |
| `POST /api/gm-pool/:id/loan-admin-approve` | Admin (Super HOD) approves the loan gate |
| `POST /api/gm-pool/:id/loan-admin-reject` | Admin rejects the loan gate |
| `PATCH /api/gm-pool/:id/loan-return` | Record loan return / overdue tracking |
| `GET /api/gm-pool/loan-return-report` | Loan return / overdue report |

The loan admin gate is a permissive sub-state machine
(`GM_LOAN_ADMIN_GATE_TRANSITIONS`): re-approve is idempotent, a terms edit
re-arms it to `PENDING`. A LOAN GM **cannot reach final approval until the gate is
`APPROVED`** (`status !== "APPROVED"` → HTTP 409 in `server/account-routes.ts`).
Overdue is computed from `agreed_return_date`. All loan actions are audited.

## Management confirmations still pending

These defaults intentionally preserve current behaviour and await management
confirmation before any change:

- `serviceExecutiveCanCreateGM` / `serviceExecutiveCanCreateManualInvoice` — `false`.
- `minimumPaymentThresholds` — empty until management enters values.
- `requireProductPostingWaitForListingQa` — `false`.
- `gmInvoiceGenerationTiming` — `ON_GM_CREATION`.
- `projectGenerationMode` — `MANUAL`.
