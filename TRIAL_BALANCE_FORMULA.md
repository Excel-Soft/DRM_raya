# Trial Balance — Formula & Invariants

Patch 6 Stage 7. The trial balance is computed by the pure helper
`server/utils/trial-balance.ts` (`computeTrialBalance`). The route layer
(`server/office-account-routes.ts`) loads the data and the helper does the math,
so the formula is unit-testable with fixtures and free of DB concerns.

## Inputs

- **Account heads** (`drm.account_heads`, active only): `id`, `code`, `name`,
  `category`, `normalBalance`, `openingBalance`. Optionally filtered by
  `category` (the `accountType` query param) and `branch`.
- **Ledger entries** (`drm.ledger_entries`) for those heads, up to and including
  the period `end`: `entryType` (`Debit`/`Credit`), `amount`, `currency`, `date`.
  **All statuses are included** (Posted / Reversed / Reversal) so a reversal nets
  to zero — matching the existing `/ledger/summary` behaviour.

## Sign convention

`openingNet` is a single signed number per head: **positive = debit balance**,
negative = credit balance.

A head is **debit-normal** when `normalBalance === "Debit"`, or — as a fallback
for heads created before `normalBalance` was populated — when its `category` is
`Assets` or `Expenses` (`TRIAL_BALANCE_DEBIT_CATEGORIES`). Otherwise it is
credit-normal.

## Formula (per account head)

```
openingNet = signed(openingBalance)                       // + if debit-normal, − if credit-normal
           + Σ(ledger movement strictly BEFORE `start`)   // dr = +amount, cr = −amount

periodDebit  = Σ(amount of Debit  rows within [start, end])
periodCredit = Σ(amount of Credit rows within [start, end])

closingNet = openingNet + periodDebit − periodCredit
```

Each net is then split into a Debit/Credit column for presentation:

```
openingDebit  = openingNet  >= 0 ?  openingNet  : 0
openingCredit = openingNet  <  0 ? −openingNet  : 0
closingDebit  = closingNet  >= 0 ?  closingNet  : 0
closingCredit = closingNet  <  0 ? −closingNet  : 0
```

When no `start` is supplied, there is no "before period" bucket and opening is
just `signed(openingBalance)`. When no `end` is supplied, all ledger rows up to
"now" are in-period.

## Key invariants

- **Opening balance is NOT double counted.** `account_heads.openingBalance` is
  the non-ledger cutover/master opening and is *not* re-posted into
  `ledger_entries`. It is the single source of truth for the opening figure; the
  only thing added on top is ledger movement strictly before `start`.
- **Totals are computed over the full filtered set**, then the route paginates
  the returned `rows` *after* the helper runs. Totals never reflect a single page.
- **Imbalance flag.** `imbalance = |ΣclosingDebit − ΣclosingCredit| > 0.01`.
  `imbalanceAmount` carries the signed difference. A correctly-kept double-entry
  ledger should net to zero; a non-zero value signals data issues, not a bug in
  the report.
- **`includeZeroBalance = false`** drops heads whose opening, period, and closing
  are all zero. `true` keeps every (filtered) head.
- **Currency safety.** Amounts are **never** converted across currencies. The
  route inspects distinct ledger currencies and returns `currencyWarning: true`
  with the `currencies` list when more than one appears, because a mixed-currency
  total is meaningless. The frontend shows a banner in that case.
- **Rounding.** All figures are rounded to 2 decimals (`round2`) and serialised
  as fixed-2 strings.

## Endpoints

- `GET /api/office/trial-balance` — auth-only read (mirrors `/ledger`). Returns
  `{ rows, totals, imbalance, imbalanceAmount, currencyWarning, currencies,
  pagination, filters }`. Query: `startDate`, `endDate`, `branch`, `accountType`
  (comma-separated categories), `includeZeroBalance`, `page`, `limit`.
- `GET /api/office/trial-balance/export` — CSV export. **RBAC-gated**
  (`trial_balance.export`, `STAGE2_FINANCIAL_ROLES`) and **audited**
  (`AuditLogService.record`). Exports the full filtered set (no pagination),
  mirroring `/ledger/export`.

## Tested via

The pure helper is intended to be exercised with fixtures (debit/credit-normal
heads, pre-period vs in-period dating, reversal netting, zero-balance dropping,
imbalance detection). See `OFFICE_ACCOUNTS_QA_MATRIX.md` for manual scenarios.
