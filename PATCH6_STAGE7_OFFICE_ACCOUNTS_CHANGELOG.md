# Patch 6 Stage 7 — Office Accounts Full Closure (Changelog)

Date: 2026-06-22. Goal: make every **retained** Office Accounts page
backend-backed, validated, RBAC-protected, audited, filterable/exportable, with
loading/empty/error states + docs. No destructive DB work; no silent financial
edits/deletes; no mock data presented as production; no console-only buttons; no
raw backend errors to the client.

## Submodules

**Retained:** Chart of Accounts, Trial Balance, Office Expenses, Office VAS,
General/Company Ledger, Journal Voucher (voucher field), Cheque System, Business
Customers.
**Merged:** Account Head → Chart of Accounts (route already redirects).
**Removed (route-level):** Old Account Head (route already redirects to Chart of
Accounts; dead page unreachable). See `OFFICE_ACCOUNTS_RETAIN_REMOVE_DECISION.md`.

## Backend

### Trial Balance (new)
- `server/utils/trial-balance.ts` — pure, DB-free `computeTrialBalance` +
  `isDebitNormal`. Opening = `signed(openingBalance)` + ledger movement strictly
  before `start`; period = within `[start, end-of-day]`; closing = opening +
  periodDr − periodCr. All ledger statuses included (reversals net). Zero-balance
  drop, totals-before-pagination, 2-dp rounding, imbalance detection. See
  `TRIAL_BALANCE_FORMULA.md`.
- `GET /api/office/trial-balance` (auth-only) — filters `startDate`, `endDate`,
  `branch`, `accountType` (CSV of categories), `includeZeroBalance`, `page`,
  `limit`. Returns rows + totals + `imbalance`/`imbalanceAmount` +
  `currencyWarning`/`currencies` + pagination + echoed filters. Inclusive end
  date; `startDate>endDate` rejected. Sanitized errors.
- `GET /api/office/trial-balance/export` — CSV; **RBAC** `trial_balance.export`
  (`STAGE2_FINANCIAL_ROLES`) + **audited** (`AuditLogService.record`). Full
  filtered set, no pagination (mirrors `/ledger/export`).

### Office Expenses (hardened)
- `POST /api/office/expenses` — added `assertPositiveAmount(amount)` and
  `assertValidDate(expenseDate)` business rules on top of the existing Zod parse;
  RBAC + audit unchanged.
- `PATCH /api/office/expenses/:id` (new) — **RBAC** `expense.update`
  (`STAGE2_FINANCIAL_ROLES`); mass-assignment guard via `pickWritable` over
  `EXPENSE_WRITABLE_FIELDS` (expenseHead, office, amount, currency, voucherNumber,
  chequeNumber, fileUrl, detail, expenseDate); `amount>0` + valid-date checks;
  404 if missing; empty-update rejected; **before/after audit**
  (`expense.update`).
- `DELETE /api/office/expenses/:id` — unchanged: hard delete (no `status`
  column), requires a reason, audited. Soft-delete documented as a future
  additive-column option.

### Permissions
- `server/middleware/financial-permission.ts` — `FINANCIAL_ACTIONS` gained
  `trialBalanceExport: "trial_balance.export"` and `expenseUpdate: "expense.update"`.

## Frontend

- `client/src/pages/office-trial-balance.tsx` — rewritten. Removed mock
  `CHILD_HEAD_OPTIONS`/`OFFICE_OPTIONS` and the parent/child/office multiselects
  that mapped to no backend filter. Real filters: category multiselect (real
  enum), branch (datalist suggestions from `account-heads`), start/end date,
  include-zero-balance. Real query to `/api/office/trial-balance`; results table
  (Code, Account, Opening Dr/Cr, Period Dr/Cr, Closing Dr/Cr) + totals row +
  imbalance + currency banners + CSV export (blob via `apiRequest`, gated by the
  audited endpoint). Loading/empty/error states.
- `client/src/pages/office-expenses.tsx` — added **Edit** (pencil) → reuses the
  create dialog → `PATCH`. `createMutation` switched to `mutationRequest` so
  failures surface the backend message instead of a false success. Client-side
  `amount>0` guard. Removed the dead filter controls (Parent Head from a mock
  map, Child Head with permanently-empty options, Transactional Head never sent);
  kept real filters: date range, office, and a **Head** filter whose options are
  derived from real `expense_head` values in the data. Pagination + CSV/Excel
  export retained. The expenses-list and cheques queries were migrated from raw
  `fetch().then(r => r.json())` (which parsed 4xx/5xx error bodies as data and
  silently showed an empty list) to the shared `apiRequestJson` helper, and an
  **error-state** row was added. The create/edit dialog's **Office** and
  **Transactional Head** selects now offer the standard enumeration *unioned with
  the real values present in the data plus the row's current value when editing*,
  so editing an existing expense never blanks/loses a head or office that is
  absent from the static list.
- `client/src/pages/office-vas.tsx` — migrated the raw `fetch` queryFn to the
  shared `apiRequestJson` helper (auth header + honest errors) and added an
  error-state table row. Read-only behaviour preserved.

## Database
- **No schema changes.** `db:push` is broken on a pre-existing FK type mismatch;
  Stage 7 needed no DDL. All work runs against existing tables
  (`account_heads`, `ledger_entries`, `office_expenses`).

## Verification
- `npm run check` (tsc): clean.
- `npm test` (vitest): 14 files / 219 tests passing.
- App boots via the `Start application` workflow.
- See `OFFICE_ACCOUNTS_QA_MATRIX.md` for manual scenarios.
