# Office Accounts — Retain / Remove Decisions

Patch 6 Stage 7. Decisions reflect the **current** codebase state (verified
2026-06-22 against `client/src/App.tsx`, `client/src/components/app-sidebar.tsx`,
and the page files). No page files were deleted (per project preference to keep
existing backup/scratch files); "remove" is realised at the **routing** level
where the route already redirects away from a dead page.

| Sub-module | Route | Decision | Rationale / current state |
|---|---|---|---|
| Chart of Accounts | `/office/chart-of-accounts` | **RETAIN** | Live engine over `drm.account_heads` via `GET/POST/PATCH /api/office/account-heads`. The canonical account-head UI. |
| Account Head | `/office/account-head` | **MERGE → Chart of Accounts** | Route already `Redirect`→`/office/chart-of-accounts` (App.tsx). Sidebar entry is commented out. The old page (`office-account-head.tsx`) holds mock `CATEGORIES_DATA` and is never rendered. No duplicate engine introduced. |
| Old Account Head | `/office/old-account-head` | **REMOVE (route redirected)** | Route already `Redirect`→`/office/chart-of-accounts` (App.tsx). The page (`office-old-account-head.tsx`, `handleSearch` = `console.log`) is unreachable. Not in sidebar. Left on disk as scratch; safe to drop the import + file in a later cleanup. |
| Trial Balance Report | `/office/trial-balance-report` | **RETAIN (now backend-backed)** | Was `console.log` only. Now wired to `GET /api/office/trial-balance` (+ audited CSV export). See `TRIAL_BALANCE_FORMULA.md`. |
| Office Expenses | `/office/expenses` | **RETAIN (hardened)** | `GET/POST/PATCH/DELETE /api/office/expenses`. Added edit (PATCH) + `amount > 0` / valid-date business rules; RBAC + audit on create/update/delete. |
| Office VAS | `/office/vas` | **RETAIN** | Read-only view of paid invoices via `GET /api/office/vas`. Migrated from raw `fetch` to the shared `apiRequestJson` helper (auth + honest errors). |
| General / Company Ledger | `/account/ledger` | **RETAIN** | `GET /api/account/ledger` over `drm.ledger_entries`; RBAC + audited export already present. |
| Journal Voucher | (voucher field within expenses) | **RETAIN** | `voucher_number` on `drm.office_expenses` via the expenses endpoints. No separate engine. |
| Cheque System | `/office/cheques` | **RETAIN** | `GET /api/office/cheques` over `drm.cheques`. Out of scope for Stage 7 changes. |
| Business Customers | `/office/business-customers` | **RETAIN** | `GET /api/office/business-customers` (sourced from `drm.customers`). Out of scope for Stage 7 changes. |

## Notes

- **No destructive DB work.** `db:push` is broken on a pre-existing FK type
  mismatch; any schema needs would be additive runtime DDL only. Stage 7 required
  none.
- **Soft-delete for expenses** remains a documented future option (would need an
  additive `status`/`deleted_at` column). Today DELETE is a hard delete that
  requires a reason and is audited.
- **"Remove" without file deletion** is intentional: the redirect makes the dead
  page unreachable while preserving the file as scratch history.
