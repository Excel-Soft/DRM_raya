# Patch 4 — Stage 2: Office Accounts Master Data & Ledger (Changelog)

Date: 2026-06-17. Scope: **ISS-04 (Office Accounts)** master-data and ledger
layer only — Chart of Accounts / Account Heads, the General Ledger, and the
double-entry Journal Voucher. This stage builds on the Stage 1 safety foundation
(`requireFinancialPermission`, `withPgTransaction`, `financial-export`,
`api-error`, audit). It is **additive** and does not redesign existing modules,
change any existing success API shape, or run destructive DB migrations.

## Guarantees / non-goals
- **No silent financial data changes.** No record values were altered or
  back-filled. No fake/placeholder rows were created or seeded.
- **Additive, non-destructive DB only.** New columns are added with
  `ADD COLUMN IF NOT EXISTS`; new tables with `CREATE TABLE IF NOT EXISTS`. No
  `db:push` (it is broken repo-wide on a pre-existing FK mismatch), no `ALTER`
  that rewrites or drops existing columns, no `DROP`.
- **Balanced postings only.** A voucher/manual journal can post to the ledger
  only when `sum(debit) == sum(credit)` (compared in integer cents) with at
  least two lines, each line a debit XOR a credit `> 0`. Unbalanced input is
  rejected before any row is written; all posting happens inside a single
  `withPgTransaction`.
- **Existing consumers untouched.** `GET /api/office/account-heads` still returns
  a plain array (consumed by `chart-of-accounts.tsx` and
  `office-trial-balance.tsx`). The legacy Company Ledger
  (`/api/account/ledger`, `/api/reports/ledger`, `account-ledger.tsx`) was left
  completely alone. Only **error** responses use the standard sanitized envelope.
- **Test-safe.** No test references `/api/office/*`; the suite (154 tests) is
  unaffected.

## DB changes (additive — `server/db/ensure.ts`)
New idempotent `ensureOfficeAccountsStage2Schema()`, called from `ensureDbOnce`,
using independent `ALTER ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT
EXISTS` statements (no risky FKs across the known varchar/uuid id mismatch):
- `drm.account_heads` += `parent_account_id`, `opening_balance` (numeric,
  default 0), `normal_balance` (text, default `'Debit'`), `branch` (+ indexes on
  `parent_account_id`, `branch`).
- `drm.ledger_entries` += `account_head_id`, `status` (text, default
  `'Posted'`), `voucher_id`, `voucher_line_id`, `reversal_of_id`, `branch`,
  `remarks`, `posted_at`, `posted_by_user_id` (+ indexes on `account_head_id`,
  `status`, `voucher_id`).
- New `drm.journal_vouchers` (`id`, `voucher_no` unique, `voucher_date`,
  `status` DRAFT/POSTED/CANCELLED, `branch`, `remarks`, totals, audit/user
  columns) and `drm.journal_voucher_lines` (`id`, `voucher_id`,
  `account_head_id`, `debit`, `credit`, `narration`, `line_no`), with supporting
  indexes. Ids are varchar to match the existing id conventions; no FK is added
  where the varchar/uuid relationship is uncertain.

Mirrored in `shared/schema.ts`: `accountHeads` and `ledgerEntries` extended with
the new columns; new `journalVouchers` / `journalVoucherLines` tables plus their
insert/select Zod schemas and inferred types.

## Backend — Account Heads (`server/office-account-routes.ts`)
- `GET /api/office/account-heads` — unchanged **array** shape; now supports
  optional `type` / `status` / `parentAccountId` / `search` query filters and
  pagination params (ignored by existing callers).
- `GET /api/office/account-heads/export` — new role-gated, audited CSV export
  using the same filters as the list.
- `POST` — hardened: unique `code` → `409`, parent must exist, opening balance
  numeric, `normalBalance` validated. Audited.
- `PATCH /:id` — update + `isActive` toggle; parent cannot be self, parent must
  exist; audited transition.
- `DELETE /:id` — if the head is referenced by posted ledger rows it is
  **soft-disabled** (`isActive = 0`) rather than hard-deleted; reason required;
  audited.

## Backend — Journal Voucher (`server/office-account-routes.ts`)
- `GET /api/office/journal-vouchers` (list, with `status` / `q` filters),
  `GET /:id` (header + lines), `POST` (creates a **DRAFT**; never posts on
  create), `POST /:id/post`, `POST /:id/cancel` (reason required).
- Posting runs inside `withPgTransaction`: validates ≥2 lines, each line debit
  XOR credit `> 0`, all heads exist and are active, remarks present, and
  `sum(debit) == sum(credit)` in cents; writes one `ledger_entries` row per line
  and flips the voucher to `POSTED`. A posted voucher is immutable (re-post /
  edit rejected with `409`).

## Backend — Office Ledger (`server/office-account-routes.ts`)
- `GET /api/office/ledger` — filtered rows (date range, account head, branch,
  reference type, status, free-text), each split into `debit` / `credit` with
  `accountHeadCode` / `accountHeadName`.
- `GET /api/office/ledger/summary` — `{ totals: { debit, credit, difference,
  count }, byAccountHead: [...] }`.
- `GET /api/office/ledger/export` — role-gated, audited CSV using the same
  filters as the list.
- `POST /api/office/ledger/:id/reverse` — reason required; reverses only a
  `Posted` `manual_journal` entry with no `voucherId`, writing mirror rows and
  marking the original `Reversed`. Posted rows are otherwise immutable
  (PATCH/DELETE on a posted entry → `409`).
- Added the Stage 2 keys to `FINANCIAL_ACTIONS`
  (`server/middleware/financial-permission.ts`). Writes/exports are gated to
  `admin`, `account_manager`, `super_hod`.

## Frontend
- `client/src/pages/chart-of-accounts.tsx` — rewritten to be fully DB-backed
  (dropped the hardcoded account tree). Search + category/type/status filters,
  client-side pagination (20/page), add/edit dialog, active toggle, delete with
  required reason (handles soft-disable), CSV export honoring the active filters,
  and explicit loading / empty / error states with inline validation.
- `client/src/pages/general-ledger.tsx` — **new.** Date / account-head / branch /
  reference / status / search filters, summary cards, running balance, totals
  footer, reverse-manual-journal action (reason required), CSV export
  (50/page); loading / empty / error / retry states.
- `client/src/pages/journal-voucher.tsx` — **new.** List with status/search
  filters; create dialog with multi-line debit-XOR-credit entry and a live
  balance badge; view dialog; post / cancel (reason required) with confirmation;
  success only after the API confirms; loading / empty / error / retry states.
- `client/src/App.tsx` — routes `/office/general-ledger` and
  `/office/journal-voucher`; `/office/account-head` and
  `/office/old-account-head` now **redirect** to `/office/chart-of-accounts`
  (the page files are retained, per the no-delete preference).
- `client/src/components/app-sidebar.tsx` — added "General Ledger" and
  "Journal Voucher" links under the Office Account group; removed the redundant
  "Old Account Head" item.

## Route decisions
- Canonical Stage 2 surface = `/api/office/ledger` + `/api/office/journal-vouchers`.
  The legacy Company Ledger (`/api/account/ledger`, `/api/reports/ledger`) was
  intentionally left untouched to avoid changing existing consumers.
- Canonical account-heads page = `/office/chart-of-accounts`; the two older
  account-head routes redirect to it rather than being deleted.

## Explicitly deferred (follow-up, not regressions)
- Stage 3 transaction/report modules (invoices, receipts/payments, cheques, VAS,
  donations, dollar system / buyers, business customers, account reports) are out
  of this stage.
- The legacy `account-routes.ts` writes deferred in Stage 1 remain deferred.

## Verification
- `npm run check` — 0 errors.
- `npm test` — 154 tests pass.
- `npm run dev` — app boots clean; backend smoke (23/23 earlier) covered CRUD,
  unique-code/parent/soft-delete, balanced post, unbalanced reject, immutability,
  reverse, and exports.
