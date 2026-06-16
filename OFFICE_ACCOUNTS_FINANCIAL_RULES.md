# Office Accounts — Financial Safety Rules

The contract every Office Accounts (and adjacent financial) endpoint should
follow. Stage 1 of Patch 4 implements this for the Office Accounts routes and
provides the shared building blocks so the rest of the financial surface can be
migrated consistently. See `PATCH4_STAGE1_OFFICE_ACCOUNTS_SAFETY_CHANGELOG.md`
for what is wired today, and `FINANCIAL_VALIDATION_RULES.md` /
`EXPORT_STANDARD.md` for the broader validation and export standards.

## 1. Authentication & authorization (fail closed)
- Every financial **write** (create / edit / delete / status-change / export)
  must pass `requireFinancialPermission(actionKey)` from
  `server/middleware/financial-permission.ts`.
- Default policy: only `admin` and `account_manager` may perform financial
  writes/exports. Override per route via `roles` / `allowRole` (e.g.
  `allowRole: isManagerialRole` for approvals).
- Unauthenticated → `401`; role not permitted → `403`. Never rely solely on the
  global URL-permission gate (it defaults to allow when unconfigured).
- Use the `FINANCIAL_ACTIONS` keys so the permission log line and the audit
  `action` use the same vocabulary.

## 2. Input validation & mass-assignment
- Validate request bodies before writing. Reuse the throw-on-failure guards in
  `server/utils/financial-validation.ts`:
  `assertPositiveAmount`, `assertNonNegativeAmount`, `assertValidCurrency`
  (`USD`/`PKR`/`Dollar`), `assertValidExchangeRate`, `assertValidDate`.
- Never spread raw `req.body` into a write. Whitelist with `pickWritable(body,
  ALLOWED_FIELDS)` (or a Zod schema). Status fields must be validated against
  their enum (e.g. cheque status ∈ `Pending|Cleared|Bounced|Cancelled`).

## 3. Destructive actions require a reason
- Every financial DELETE must carry a non-empty `reason` (min 3 chars), read
  from the request body (query fallback for DELETE compatibility).
- Missing/blank reason → `400`. The reason is recorded in the audit entry.
- Deletes must never be silent: capture the deleted row's key fields in the
  audit `before` payload where available.

## 4. Atomicity
- Writes spanning multiple rows/tables must run in one transaction:
  `withFinancialTransaction` (Drizzle) or `withPgTransaction` (raw SQL) from
  `server/utils/financial-transaction.ts`.
- Only work performed on the supplied `tx`/`client` is atomic. Do **not** wrap
  best-effort, post-response side-effects and claim atomicity.

## 5. Audit trail
- Every financial write records an audit event via `AuditLogService.record`
  (or `recordTransition` for status changes) into `drm.activity_logs`.
- Audit is best-effort and never throws on the request path.
- Include `module`, `entityType`, `entityId`, and a minimal `before`/`after`
  (or `previousStatus`/`nextStatus`). **Never** put secrets, password hashes, or
  tokens in the payload.

## 6. Error responses (no leaks)
- All error responses use the standard envelope via `sendApiError` / `sendError`
  (`server/utils/api-error.ts`): `{ success:false, error:{ code, message,
  details? }, message }`.
- Never return `error.message` or `error.stack` (or raw SQL) to the client. Log
  the full error server-side; return a sanitized message.
- **Success response shapes are never changed** by these rules — only errors are
  standardized.

## 7. Exports
- Server-side CSV exports go through `sendCsvExport`
  (`server/utils/financial-export.ts`): RFC-4180 escaping, descriptive
  timestamped filename, `Content-Type: text/csv`.
- Exports must be RBAC-gated (same as the underlying view), **respect the same
  active filters** as the on-screen data, serialize **real backend data only**,
  and be audited. A user may only export what they can see.

## Quick checklist (per financial write)
1. `requireFinancialPermission(FINANCIAL_ACTIONS.x)` on the route.
2. Validate + whitelist the body (no raw `req.body`).
3. DELETE → require `reason`.
4. Multi-table → wrap in a transaction helper.
5. `AuditLogService.record(...)` on success.
6. `catch` → `sendError` / `sendApiError` (sanitized, no leaks).
7. Success response shape unchanged.
