# Patch 4 — Stage 1: Office Accounts Financial Safety Foundation (Changelog)

Date: 2026-06-16. Scope: **ISS-04 (Office Accounts)** financial-safety
*foundation* only. This stage builds the shared safety layer and wires it into
the Office Accounts routes. It is intentionally **not** a redesign and does not
change any business workflow, approval logic, role, permission model, success
API shape, or DB business structure.

## Guarantees / non-goals
- **No silent financial data changes.** No record values were altered or
  back-filled. No fake/placeholder rows were created.
- **No destructive DB migrations.** No `db:push`, no `ALTER`/`DROP`. Audit reuses
  the existing `drm.activity_logs` table.
- **Success responses unchanged.** Only *error* responses moved to the standard
  sanitized envelope. The shape of every successful response is identical.
- **Test-safe.** No test references `/api/office` or `/api/account`; the suite
  (154 tests) is unaffected.

## New shared modules (reusable foundation)
- `server/middleware/financial-permission.ts` — `requireFinancialPermission(actionKey, opts?)`,
  a thin, fail-closed wrapper over the existing `requireActionPermission`.
  Default policy: only `admin` and `account_manager` may perform financial
  writes/exports. Includes the `FINANCIAL_ACTIONS` key map.
- `server/utils/financial-transaction.ts` — `withFinancialTransaction` (Drizzle)
  and `withPgTransaction` (raw node-postgres BEGIN/COMMIT/ROLLBACK) for atomic
  money writes. Documents that only work performed on the supplied
  `tx`/`client` is covered (no false atomicity).
- `server/utils/financial-export.ts` — `csvEscape`, `buildCsv`,
  `buildExportFilename`, `sendCsvExport`. RFC-4180 escaping and descriptive,
  timestamped filenames per `EXPORT_STANDARD.md`. The helper never invents data;
  the caller stays responsible for auth, filters, and audit.

## Reused (not duplicated)
- Error envelope: `server/utils/api-error.ts` (`sendApiError`, `sendError`).
- Validators: `server/utils/financial-validation.ts` (`assert*`, `pickWritable`)
  and `server/validators/financial.validators.ts`.
- Audit: `server/services/audit-log.service.ts`
  (`AuditLogService.record` / `recordTransition`, best-effort).
- Permission base: `server/middleware/action-permission.ts`.

## Wired: `server/office-account-routes.ts`
For every write the foundation now applies: permission guard → input
validation/whitelist → action → audit, with sanitized error responses.
- **Permissions**: `requireFinancialPermission` on all POST/PATCH/DELETE and on
  the new export endpoint.
- **Sanitized errors**: every `catch` returns the standard envelope; removed all
  paths that returned `error.message` / `error.stack` to the client.
- **Cheque status PATCH** (`/cheques/:id/status`): body is whitelisted with
  `pickWritable(["status"])` and validated against the
  `Pending|Cleared|Bounced|Cancelled` enum; transition is audited; 404 when the
  cheque does not exist.
- **Delete requires a reason**: account-heads, expenses, vas, cheques and
  business-customers DELETEs read a `reason` (body, with query fallback),
  validated (min 3 chars). Missing reason → `400`. Each delete is audited.
- **Audit on create/delete/status-change** for all of the above.
- **New export** `GET /api/office/expenses/export` (CSV): role-gated, audited,
  uses the **same filters** as `GET /api/office/expenses` (additive endpoint;
  existing client-side export untouched).

## Wired (surgical): `server/account-routes.ts`
- Sanitized the two leaking ledger catches: `GET /api/account/ledger` and
  `GET /api/account/ledger/summary` no longer leak `message`/`stack`.
- Sanitized the dollar-system list catch.
- Hardened `POST /api/account/dollar-system/transaction`:
  `requireFinancialPermission`, additive amount/rate validation (only on
  provided fields), the wallet INSERT now runs in `withPgTransaction`, the
  action is audited, and the catch is sanitized + guarded against
  already-sent headers. The post-response product-posting invoices remain
  intentionally best-effort and outside the transaction.

## Frontend (minimal)
- `client/src/pages/chart-of-accounts.tsx` and
  `client/src/pages/office-expenses.tsx` delete buttons now prompt for a
  required reason, send `{ reason }`, check `res.ok`, and show an error toast on
  failure. No layout/redesign changes.

## Explicitly deferred (follow-up, not regressions)
- The remaining ~25 writes in `account-routes.ts` (GM/BV/donations/dollar-buying
  etc.) are **not** re-wired in this foundation stage; they retain their current
  behavior and should be migrated to the foundation in a later stage.
- Static/mock Office Accounts pages noted in `PATCH4_ISSUE_MATRIX.md`
  (Old Account Head, Trial Balance) and the export violations in
  `EXPORT_STANDARD.md` are out of this stage.
- `SEC-01` (hardcoded `JWT_SECRET` in `.replit`) is out of Patch 4 scope.

## Verification
- `npm run check` — 0 new errors (pre-existing baseline unchanged).
- `npm test` — 154 tests pass.
- Manual smoke tests on `/api/office/*` and the dollar-system transaction.
