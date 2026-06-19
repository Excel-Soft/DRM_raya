# Patch 5 Stage 7 — Accounts Dashboard + Verification Alignment + Service Role Matrix

Thin, additive change set (P11/P12/P13). **No** workflow transition logic, phase
values, roles, permissions, or DB business structure were changed. `db:push` is
broken repo-wide, so no schema migration was run — all new endpoints read existing
columns. The verification step change remains gated on management confirmation
(see `VERIFICATION_MANAGER_LIFECYCLE_DECISION.md`).

## APIs added

- `GET /api/gm-sales-workflow/ui-config` — authenticated (not admin-only). Returns
  only the three UI-relevant flags: `verificationManagerRequiredAfterQa`,
  `serviceExecutiveCanCreateGM`, `serviceExecutiveCanCreateManualInvoice`. Distinct
  from the admin-only `PATCH /config`; no admin surface changed.
- `GET /api/accounts/dashboard/gm-summary` — Accounts dashboard aggregate. CTEs
  pre-aggregate receipts, invoice statuses, and loan terms to **one row per GM** so
  totals never double-count. GM type is derived from `is_loan` / `is_partial_payment`
  (not the `gm_type` column). Returns `{ totals, byStatus, recentGms, filters,
  dueSoonDays }`. Filters: `gmType, status, dateFrom, dateTo, customer, owner,
  branch, package, invoiceStatus` (+ `dueSoonDays`, `recentLimit`). Loan `overdue`
  = not returned AND `agreed_return_date < current_date`; `dueSoon` default 7 days.
  This is a **new** aggregate, not a replacement for `/gm-entries/stats`.
- `GET /api/account/gm-entries/:id/invoices` — GM detail: linked invoices (auto +
  manual, type, status, HOD + Accounts approval status/date, payment + proof, linked
  project status), partial receipt history, and loan terms. `404 GM_NOT_FOUND` for a
  missing GM.

All three answer with the standard `{ success, data }` envelope.

## Frontend

- `client/src/hooks/use-ui-workflow-config.ts` — `useUiWorkflowConfig()` (reads
  `ui-config`) and `useServiceExecutiveCreateGates()` (combines the flags with the
  caller's role; always-allowed roles bypass) → `{ canCreateGm,
  canCreateManualInvoice }`.
- `client/src/components/accounts-gm-summary-widget.tsx` — new Accounts dashboard
  widget: Full/Partial/Loan + received/pending + loan due-soon/overdue stats, a
  by-status breakdown, a filter bar, a recent-GM table, and a GM detail dialog that
  calls `:id/invoices`. Mounted in `account-manager-dashboard.tsx`.
- `client/src/pages/gm-pool-add-gm.tsx` — the Add-GM toggle is hidden when
  `canCreateGm` is false (Service Executive without the flag). Server still enforces.
- `client/src/components/verification-manager-widget.tsx` — post-QA status tag now
  uses the shared config-aware label helper.

## Shared

- `shared/verification-lifecycle.ts` — canonical lifecycle stage labels +
  `getVerificationLifecycleLabels(verificationManagerRequiredAfterQa)`. **Labels
  only**, no transitions. With the default (`true`) the wording is unchanged.

## Verification lifecycle alignment (Part A)

Labels only, made config-aware. The QA → Verification → final-owner *transition*
logic is untouched and awaits management confirmation of whether the Verification
Manager step is mandatory. Documented in
`VERIFICATION_MANAGER_LIFECYCLE_DECISION.md`.

## Service role matrix (Part E)

GM-create and manual-invoice gates were already enforced server-side; Stage 7 adds
tests and documents the behavior. Full matrix in
`SERVICE_EXECUTIVE_GM_INVOICE_PERMISSION_MATRIX.md`. Summary:
`POST /api/gm` admits sales_executive / admin / super_hod always and
service_executive only when `serviceExecutiveCanCreateGM`; `POST /api/invoices`
admits admin / sales_executive / sales_manager always and service_executive only
when `serviceExecutiveCanCreateManualInvoice`. Unauthenticated → 401, never 404.

## Tests

- `server/patch5-stage7-role-matrix.test.ts` — DB-backed role matrix for
  `POST /api/gm` and `POST /api/invoices` across admin, sales_executive,
  sales_manager, service_executive (flag on/off), hod, account_manager, and
  unauthenticated; plus smoke tests for the three new read surfaces (envelope shape,
  401 when unauthenticated, 400 on invalid filter, 404 for a missing GM). Soft-skips
  if Postgres is unreachable; snapshots and restores the two config flags.

## Docs

- `VERIFICATION_MANAGER_LIFECYCLE_DECISION.md`
- `SERVICE_EXECUTIVE_GM_INVOICE_PERMISSION_MATRIX.md`
- this changelog
