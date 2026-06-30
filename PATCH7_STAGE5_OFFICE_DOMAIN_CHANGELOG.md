# Patch 7 Stage 5 — Office Accounts + Domain/Hosting Closure (Changelog)

Date: 2026-06-30. Mode: **gap-closure, not rebuild.** Most Office Accounts and
Domain/Server work was already hardened in Patch 4 Stage 1/2/4 and Patch 6
Stage 6/7. This stage closes the remaining genuine gaps (dead/fake IT Domain &
Backup UI, three legacy finance honesty/permission gaps), fixes one pre-existing
AB-report crash discovered during smoke testing, verifies the rest, and
documents.

Constraints honoured: no silent edit/delete of stored financial values; no
hardcoded data presented as production; no console-only / dead buttons; no fake
export success toasts; no raw backend error leakage; `db:push` is broken
(pre-existing FK type mismatch) → no schema push, no destructive DDL; no rewrite
of working code; no duplicate endpoints/tables; no external WhatsApp/SMS/email
provider introduced.

## 1. IT Domains page — `client/src/pages/it-domains.tsx` (DOM-002, frontend honesty)

- **Removed fake exports.** The previous `Excel/CSV/PDF` buttons only fired a
  `setTimeout` and then a "exported successfully" toast with no file. Replaced
  with **real client-side exports** over the actual `/api/it/domains` rows:
  - **CSV** via a `Blob` download (`it_domains.csv`).
  - **Excel** via `xlsx` (`utils.json_to_sheet` → `writeFile`, `it_domains.xlsx`).
  - **PDF dropped** (no real generator; faking it is not allowed).
  - `Copy` and `Print` retained (already real). Export of an empty list now
    shows an honest "No data to export" info toast instead of a false success.
- **Removed the decorative filter card** (Company / Person / Contact / Email
  inputs). `it_domains` has **no** company / email / contact columns, so those
  inputs were unbacked. The working **Search** box (filters real `domainName`)
  is kept.
- **Status badges are now derived from real data.** The hardcoded "Renew"
  labels were replaced with an `expiryStatus()` helper computed from each row's
  real `expiryDate` / `hostingExpiryDate` / `sslExpiryDate`
  (`Expired` / `N d left` / `Active` / `N/A`).
- **Removed the dead WhatsApp action** (no messaging provider is wired).
  Replaced with a **Renewal Message composer** that builds the reminder text
  from real row fields and offers **Copy Message** to clipboard (honest, no
  fake "sent").
- **Quotation dialog made honest.** There is no authoritative price stored for
  domains, so the line total now shows **"Not available"** with an explanatory
  note, and the **"Generate Quotation"** button (which did nothing) was removed.
- Unbacked profile fields (Grade, Contact score, Company, Email) now render
  **N/A** instead of invented values (`D`, `0`).

## 2. IT Backup page + endpoint — `client/src/pages/it-backup.tsx`, `server/it-assets-routes.ts` (DOM-002)

- **Frontend:** rewired the Add Backup form to real controlled state
  (`domainId` Select sourced from `/api/it/domains`, `backupType`, `backupUrl`,
  `details`) → `POST /api/it/backups` via `apiRequestJson`; invalidates
  `["/api/it/backups"]` on success; honest success/error toasts (sanitized
  message), loading state. Display maps `domainId → domainName`. Removed the
  dead delete (trash) control and dead pagination (no backing soft-delete /
  paged endpoint).
- **Backend `GET /api/it/backups`:** now role-gated with
  `requireRole(...IT_READ_ROLES)` (was previously not guarded at that layer).
- **Backend `POST /api/it/backups`:** now `requireRole(...IT_WRITE_ROLES)`,
  validates with the existing `insertItBackupSchema` (sanitized Zod errors),
  records `AuditLogService.record` (`action: "it_backup.create"`, module
  `domain_hosting`, actor id), and returns **201** on success.

## 3. Legacy finance honesty + write gating — `server/account-routes.ts`, `server/middleware/financial-permission.ts` (ACC-LEGACY-001)

- **AB report (`GET /api/account/ab-report/stats`): removed the magic `* 280`.**
  The dollar buy figure was being multiplied by a hardcoded `280` and presented
  as a real PKR number. It now reports the **real USD total** (`Total Dollar
  (USD): $<n>`) and returns honest conversion metadata:
  `meta.dollarConversion = { usdTotal, pkrRate: null, pkrTotal: null,
  rateSource: "unavailable", note }`. **No stored value was changed** — this is
  presentation only.
- **Dollar wallet transaction (`/api/account/dollar-system/transaction`): removed
  `rate || 277`.** A missing rate previously defaulted to a fabricated `277`
  written into the ledger. It now stores the **validated caller-supplied rate or
  `NULL`** (`drm.gm_entries.dollar_rate` is nullable — verified). The audit
  payload records the same `storedRate` (no longer `277`).
- **Replaced the mock wallet id.** `WLT-${Date.now()}` could collide on rapid
  calls; it is now `WLT-<timestamp>-<random>` (same `WLT-` convention, unique).
- **Write-only financial permission gating** added to three legacy POST routes
  via `requireFinancialPermission` (fail-closed; reads untouched):
  - `POST /api/account/donations` → `finance:donation.create`
  - `POST /api/account/temp-gm` → `finance:temp_gm.create`
  - `POST /api/account/buyers` → `finance:dollar_buyer.create`
  - New stable keys added to `FINANCIAL_ACTIONS`; default policy
    `FINANCIAL_WRITE_ROLES = [admin, account_manager]` (same policy already used
    by the rest of Office Accounts). See **Unresolved** for the temp-GM role note.

## 4. Pre-existing AB-report crash fixed (discovered in smoke testing)

`GET /api/account/ab-report/stats` was returning **500** before any of the above
took effect, due to two pre-existing SQL type errors in the aggregate query
(unrelated to the magic-rate change):

- `FILTER (WHERE is_loan = true)` — `drm.gm_entries.is_loan` is **integer**, not
  boolean (`operator does not exist: integer = boolean`). Fixed to `is_loan = 1`.
- `temp_stats` CTE filtered `coalesce(is_deleted, false) = false`, but
  `drm.temp_gm_entries` has **no `is_deleted` column**. Fixed to `WHERE 1=1`
  (date filter still applies). The `gm_entries` CTE keeps its real boolean
  `is_deleted` filter.

The endpoint now returns **200**. This was the only way to make the AB-report
page load and to make the magic-rate honesty fix observable.

## 5. Post-review fixes (architect `evaluate_task`)

A code review flagged two further gaps in the same surface; both fixed:

- **Dollar System page was broken by the same SQL bug class.**
  `GET /api/account/dollar-system/list` (feeds `client/src/pages/dollar-system.tsx`)
  also compared the integer columns with booleans: `is_loan = true/false` and
  `is_partial_payment = true` (wallet stats + Full/Partial/Loan lists). Fixed to
  `= 1` / `= 0`. Endpoint now returns **200** (was 500) — the retained Dollar
  System page loads. No stored values changed.
- **Raw Zod errors on IT create endpoints.** `POST /api/it/backups` and
  `POST /api/it/domains` returned the raw `result.error` object on validation
  failure (leaking internal Zod JSON). Both now return the app-standard
  sanitized envelope `{ error: result.error.issues[0]?.message ?? "Invalid
  request." }` (HTTP 400). Verified: a wrong-typed body returns
  `{"error":"Expected string, received number"}`, not a Zod dump.

## Files changed

- `client/src/pages/it-domains.tsx` — rewritten (honesty: real export, derived
  status, copy-message, honest quotation).
- `client/src/pages/it-backup.tsx` — rewritten (controlled create form, honest
  toasts, dead controls removed).
- `server/it-assets-routes.ts` — backups GET/POST role-gated + POST audited.
- `server/account-routes.ts` — AB-report magic-rate removed + metadata + SQL
  type fixes; dollar-tx rate/`WLT-` id; gating on donations/temp-gm/buyers.
- `server/middleware/financial-permission.ts` — 3 new `FINANCIAL_ACTIONS` keys.

## APIs added / modified

- **Modified** `GET /api/it/backups` — now `IT_READ_ROLES` gated.
- **Modified** `POST /api/it/backups` — `IT_WRITE_ROLES` + Zod + audit + 201.
- **Modified** `GET /api/account/ab-report/stats` — real USD total + conversion
  metadata; SQL type fixes (now 200, was 500).
- **Modified** `GET /api/account/dollar-system/list` — integer/boolean SQL type
  fixes (`is_loan`/`is_partial_payment` `= 1/0`); now 200, was 500.
- **Modified** `POST /api/it/domains` — sanitized Zod validation error envelope.
- **Modified** `POST /api/account/dollar-system/transaction` — no fabricated
  rate; unique wallet ref.
- **Modified** `POST /api/account/donations`, `POST /api/account/temp-gm`,
  `POST /api/account/buyers` — financial write permission added.
- **No new endpoints. No duplicate endpoints/tables.**

## DB changes

- **None.** No DDL, no migration, no `db:push`. All affected columns already
  exist (`gm_entries.dollar_rate` nullable; `it_backups`/`it_domains` columns;
  `gm_entries.is_loan` integer; `gm_entries.is_deleted` boolean;
  `temp_gm_entries` has no `is_deleted`). See
  `PATCH7_DB_MIGRATION_RECONCILIATION.md`.

## Trial balance behavior

- **Unchanged.** `/office/trial-balance-report` →
  `GET /api/office/trial-balance` remains backend-backed (Patch 6 Stage 7,
  `server/utils/trial-balance.ts`), with audited CSV export. Verified still
  intact; no edits this stage. See `TRIAL_BALANCE_FORMULA.md`.

## Server Names behavior

- **Unchanged.** `/it/servers` (`client/src/pages/it-servers.tsx`) full CRUD +
  controlled create form from Patch 6 Stage 6 is retained and untouched. See
  `DOMAIN_HOSTING_SERVER_NAMES_QA.md`.

## Domain secondary (Domains / Backup) behavior

- `/it/domains` and `/it/backup` are the **secondary** Domain/Hosting pages
  (the primary being `/it/servers`). Both are now honest: real exports / derived
  status / copy-message / honest quotation on Domains; real audited, role-gated,
  validated create on Backup. Both are routed (`App.tsx`) and present in the
  sidebar under "Domain Hosting".

## Migration status

- `db:push` broken (pre-existing FK type mismatch) → not run. No schema change
  required this stage. Runtime schema-maintenance on boot still reports
  `[accounts] schema maintenance completed successfully`.

## Tests run

- `npm run check` (tsc `--noEmit`): **clean** (0 errors).
- `npm test` (vitest): **227 passed / 227** (15 files).
- JWT smoke tests (minted token, `localhost:5000`): backup POST
  401 / 403 / 400 / 201; domains GET 200; AB-report GET 200 with
  `rateSource: "unavailable"` metadata and `Total Dollar (USD)` row;
  donations / temp-gm / buyers POST 403 (non-financial) and 400-on-validation
  (admin passes the guard); dollar-system/list GET 200 (with & without dates);
  backup wrong-typed body → 400 sanitized `{error}` (no Zod dump). All pass.
- Smoke-test backup rows created during testing were deleted afterward (dev DB
  left at 0 backup rows).

## Unresolved / notes

- **Temp-GM role policy.** `POST /api/account/temp-gm` is now restricted to
  `[admin, account_manager]`. If the business expects a broader set of roles to
  *create* temp-GM requests (e.g. a request-then-approve flow), widen the policy
  by passing `roles`/`allowRole` to `requireFinancialPermission` at that call
  site. Flagged for management confirmation.
- **AB-report PKR conversion** is intentionally `null` (`rateSource:
  "unavailable"`) because there is no authoritative aggregate-level PKR rate.
  If a real rate source is later defined, populate `dollarConversion.pkrRate`
  there rather than reintroducing a constant.
