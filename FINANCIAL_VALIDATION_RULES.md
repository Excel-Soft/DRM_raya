# Financial Validation Rules

Shared guards live in `server/utils/financial-validation.ts` and throw
`ApiError(400)` (standard error envelope) on failure. They are additive — valid
requests behave exactly as before.

## Helpers
- `assertPositiveAmount(value, field)` — number, `> 0`.
- `assertNonNegativeAmount(value, field)` — number, `>= 0`.
- `assertValidCurrency(value, field)` — one of `USD`, `PKR`, `Dollar`.
- `assertValidExchangeRate(value, field)` — number, `> 0`.
- `assertValidDate(value, field)` — parseable date.
- `pickWritable(body, allowed)` — mass-assignment guard; keeps only whitelisted keys.
- `INVOICE_WRITABLE_FIELDS` — invoice columns a PATCH may modify.

## Rules enforced on endpoints
### Invoices — `PATCH /api/account/invoices/:id`
- Only `INVOICE_WRITABLE_FIELDS` are writable. `id`, `invoiceNumber`,
  `createdByUserId`, `createdAt` are immutable here (mass-assignment fix).
- `subtotal`, `tax`, `total` validated `>= 0`; `currency` validated.

### GM entries — `POST /api/account/gm-entries`
- USD amount must be `> 0`.

### Ledger — `POST /api/account/ledger`
- `amount` must be `> 0`.
- `currency` must be valid.
- `entryType` must be `Credit` or `Debit`.

### Refund GM — `POST /api/account/refund-gm`
- `amount` must be `> 0`.
- `comment` (reason) is mandatory.

## Design notes
- All guards fail loud (explicit 400) rather than silently coercing values.
- Whitelisting (not blacklisting) is used for invoice updates so newly added
  columns are immutable by default until explicitly allowed.
