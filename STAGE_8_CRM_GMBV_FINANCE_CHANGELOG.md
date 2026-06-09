# Stage 8 — CRM, GM/BV Lifecycle & Financial Validation Changelog

Additive hardening on top of the existing WebExcels DRM. No existing business
workflow, role, permission, schema column, or API contract was removed or
repurposed. New tables are created at runtime via `ensure-schema` helpers because
`npm run db:push` is broken on a pre-existing FK mismatch.

## New files
- `server/utils/ownership.ts` — record-ownership helpers
  (`getEditableUserIds`, `canEditOwnedRecord`, `assertCanEditCustomer`).
  Executive → own records; manager → their department/team; admin / super_admin /
  super_hod → all. Throws `ApiError(403/404)`.
- `server/utils/gm-bv-state-machine.ts` — canonical GM/BV status enum, the
  allowed-transition map, reason-required targets, `assertTransition()`
  (409 illegal / 400 missing reason) and `mapToCanonical()` for legacy columns.
- `server/utils/assignment-history.ts` — `ensureAssignmentHistoryTable()`,
  `recordAssignment()`, `getAssignmentHistory()` (table `drm.assignment_history`).
- `server/utils/financial-validation.ts` — `assertPositiveAmount`,
  `assertNonNegativeAmount`, `assertValidCurrency`, `assertValidExchangeRate`,
  `assertValidDate`, `pickWritable`, and `INVOICE_WRITABLE_FIELDS`.
- `server/crm-duplicates-routes.ts` — duplicate detection & merge (see
  `CRM_DUPLICATE_POLICY.md`).
- `server/lead-bulk-routes.ts` — bulk lead assign / reassign / status / export.

## New / changed endpoints
- `GET  /api/crm/duplicates` — cluster customers by normalized email/phone/company.
- `GET  /api/crm/duplicates/:id/compare` — side-by-side cluster comparison.
- `POST /api/crm/duplicates/:id/merge` — merge into survivor, repoint child rows,
  soft-delete loser, audit. Restricted to duplicate-override roles.
- `POST /api/crm/duplicates/:id/skip` — record a dismissal in
  `drm.duplicate_decisions`.
- `POST /api/sales/leads/bulk/assign|reassign|status` — bulk actions, each audited.
- `GET  /api/sales/leads/bulk/export` — CSV export.
- `GET  /api/reports/gm-bv-reconciliation` — GM vs invoice vs received vs due vs
  ledger vs refund per company, with mismatch flags and date/user/customer/status/
  department filters (read-only).
- `GET  /api/sales/leads/:id/profile` — now also returns `assignmentHistory`.

## Enforcement added to existing endpoints
- `server/sales-routes.ts`
  - `PATCH /api/sales/leads/:id` — ownership check; reason required to expire a lead.
  - `PATCH /api/sales/customers/:id/grade|note|stage` — ownership check.
  - `POST  /api/sales/followups` — ownership check on the target customer.
  - `POST  /api/sales/leads/:id/assign` — writes `drm.assignment_history`.
- `server/gm-pool-routes.ts`
  - `hod-reject`, `account-manager-reject` — reason (comment) now mandatory.
  - `request-withdraw` — reason now mandatory.
- `server/account-routes.ts`
  - `PATCH /api/account/invoices/:id` — mass-assignment fixed; only whitelisted
    columns are writable; amounts validated `>= 0`; currency validated.
  - `POST /api/account/gm-entries` — USD amount must be `> 0`.
  - `POST /api/account/ledger` — amount `> 0`, valid currency, `entryType` in
    {Credit, Debit}.
  - `POST /api/account/refund-gm` — amount `> 0`, reason mandatory.

## Verification
- `npx tsc --noEmit` — holds at the pre-existing baseline of 57 errors (zero net new).
- App boots on port 5000; routes registered in `server/routes.ts`.
- Smoke tests: see "Tests run" in the completion summary.

## Notes / limitations
- GM/BV reconciliation matches on normalized company name because there is no
  shared `customer_id` FK across `gm_entries`, `invoices` and `refund_gm_entries`.
- New tables are created lazily on first use via their `ensure-schema` helpers.
