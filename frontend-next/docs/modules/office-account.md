# Office Account — migration module doc

Assigned scope: legacy's "Office Account" sidebar group (`permKey: "Office Account"`,
`app-sidebar.tsx` lines 240-251) — 8 real-money accounting pages backed by one large
Express route file (`backend/src/server/routes/office-account-routes.ts`, 2202 lines) covering
account heads, trial balance, general ledger, journal vouchers, business customers, VAS,
expenses and cheques.

**Status: 8 of 8 items built on Next.**

## Route inventory

| Legacy path | Label | Next path |
|---|---|---|
| `/office/trial-balance-report` | Trial Balance Report | `/dashboard/office/trial-balance-report` |
| `/office/chart-of-accounts` (+ `/office/account-head`, `/office/old-account-head`) | Chart of Account | `/dashboard/office/chart-of-accounts` |
| `/office/general-ledger` | General Ledger | `/dashboard/office/general-ledger` |
| `/office/journal-voucher` | Journal Voucher | `/dashboard/office/journal-voucher` |
| `/office/business-customers` | Business Customer | `/dashboard/office/business-customers` |
| `/office/vas` | Office Vas | `/dashboard/office/vas` |
| `/office/expenses` | Office Expense | `/dashboard/office/expenses` |
| `/office/cheques` | Cheque System | `/dashboard/office/cheques` |

## Why these paths aren't nested under `/dashboard/drm/*`

Next's `route-access.ts` already has a `"/drm"` prefix rule (`ADMIN_ONLY_ROUTE_ROLES`) used by
the real DRM Setting module (Attributes, Permission, Promotion, etc. — genuinely admin-only
pages). Office Account is a different legacy sidebar group entirely (`permKey: "Office Account"`,
gated to `["admin", "super_hod", "hod", "account_manager"]` in `menu-perm-roles.ts`, already
correct and unchanged).

Checked legacy's actual client-side gate (`frontend/src/hooks/useRouteProtection.ts`) and
confirmed it has **no entry at all** for any `/office/*` path — these pages are client-side
ungated in legacy; the backend's own `requireFinancialPermission(...)` checks (role-gated per
endpoint, see below) are the real authority. Placing these under `/dashboard/office/*` (not
`/dashboard/drm/*`) means `toLegacyGuardPath` maps them to `/office/*`, which matches no
`ROUTE_PERMISSIONS` key — correctly reproducing legacy's real behavior instead of wrongly
inheriting the admin-only DRM Setting gate.

## Backend is the real authority

Every endpoint is gated with `requireFinancialPermission(...)`, mostly scoped to
`STAGE2_FINANCIAL_ROLES`. All of create/update/delete are audited via `AuditLogService.record()`
with before/after snapshots. Three things worth knowing:

- **Office Expense creation and Journal Voucher posting both write directly to
  `ledgerEntries`** — this is a real double-entry system under the hood, not a cosmetic report.
  General Ledger's numbers are the union of office-expense debits, journal-voucher postings, and
  manual journal entries.
- **Ledger rows are immutable by design.** `PATCH /ledger/:id` and `DELETE /ledger/:id` both
  return a 409 explaining a reversing entry is required instead — this isn't a missing feature,
  it's the architecture. Reversal (`POST /ledger/:id/reverse`) only works on manual-journal rows;
  voucher-sourced rows must be reversed by cancelling the voucher.
- **Account head deletion soft-disables instead of hard-deleting** when the head is referenced by
  ledger postings (`body.softDisabled` in the delete response) — ported as the backend already
  implements it; the legacy UI never actually surfaces a delete button for this, see below.

## Found but not fixed — two quirks carried over faithfully

- **Chart of Accounts: `deleteMutation` and `toggleMutation` are dead code in legacy.** Both are
  fully implemented with onSuccess/onError toasts in `chart-of-accounts.tsx`, but neither is ever
  invoked from the JSX — there is no Delete button and no active/inactive Switch rendered anywhere
  in the page, despite `Switch` being imported. The backend fully supports both (PATCH `isActive`
  toggle, DELETE with soft-disable fallback). Ported faithfully: only Add and Edit actions exist
  in the Next version too, matching exactly what a user of the legacy page could actually do.
  Wiring these up would be a real feature addition, not a migration — left for a product decision.
- **Office Expense: pagination state existed but no controls rendered.** Legacy's
  `office-expenses.tsx` has `currentPage`/`rowsPerPage=10` state and slices the list to 10 rows,
  but never renders a Previous/Next control anywhere — rows 11+ were permanently invisible with no
  way to reach them. This reads as an accidental wiring omission rather than a deliberate limit
  (unlike, say, the intentionally-paginated Increment/Reports tables that do have working
  controls). Rather than replicate a data-visibility bug, the Next version shows the full filtered
  list in one table. Flagged here in case Habib wants this reverted to bug-for-bug parity.

## Per-page notes worth keeping

- **Trial Balance Report** — client-side hierarchical tree build (parent → child → transactional)
  from the flat `account-heads` list, same algorithm as legacy (`HierarchicalRows`/
  `HierarchicalView`), including the imbalance/currency-mismatch warning banners and the
  accounting-head → parent → child cascading multi-select filters.
- **General Ledger** — running balance computed client-side over the full filtered (unpaginated)
  result set before slicing into pages, matching legacy exactly (balance must be chronological
  across the whole set, not per-page). The "Reverse" action (`Undo2` icon) only shows for
  `Posted` + no `voucherId` + `referenceType === "manual_journal"` rows, exactly mirroring
  `canReverse()`.
- **Chart of Accounts** — 3-level expandable card/table hierarchy (parent → child → transactional
  → sub-transactional) with auto-generated next-code suggestion on open (`/account-heads/next-code`,
  level-aware: +5000 for new top-level roots, +100/+1 for nested levels) and category→type
  cascading dropdowns (`ACCOUNT_TYPES` map, client-side only — not from the API).
- **Journal Voucher** — balanced-entry validation ported exactly: every line must be either a
  debit or a credit (never both, never neither), at least two filled lines required, and the
  create dialog won't let an unbalanced draft silently through without the "Out of balance"
  badge. Lifecycle is Draft → Posted/Cancelled; only Draft vouchers can be posted; any
  non-cancelled voucher can be cancelled (with a required reason, same `window.prompt` pattern as
  legacy).
- **Office Expense** — the searchable transactional-head combobox and multi-select category/
  office filters (Popover+Command, DropdownMenu-checkbox) were ported using this app's established
  substitutes: `Select`+`SelectItem` for the single-pick combobox, `DropdownMenu`+
  `DropdownMenuCheckboxItem` for the multi-selects (same primitives, same behavior, no
  typeahead-search affordance since no Command component exists in this app). File upload is
  ported exactly as a client-side base64 data-URI reader with no server-side storage — this is
  what legacy actually does, not a shortcut taken here.
- **Cheque System** — the decorative Askari Bank cheque mockup (logo, perforated cheque-number
  boxes, "Pay"/"Rupees"/PKR box layout) was ported pixel-for-pixel since it's a deliberate, real
  piece of the page's design, not incidental styling.
- **Business Customer / Office Vas** — both are read-only, filtered lists. Both backends expose
  POST/DELETE endpoints (and Vas's GET even accepts an unused `search` param) that the legacy UI
  never calls — ported as read-only to match what the page actually does, not what the API could
  support.

## Files touched this pass

- `src/lib/navigation/office-routes.ts` / `.test.ts` (new — 8 route constants, sidebar-paths
  array, legacy-redirect array covering 10 legacy source paths including the 2
  `/office/account-head` and `/office/old-account-head` redirect aliases)
- `src/lib/navigation/migrated-routes.ts` / `legacy-redirects.ts` (added Office import + spread)
- `src/lib/navigation/navigation-config.ts` (Office Account group — all 8 hrefs now import
  canonical constants instead of bare legacy strings)
- `src/modules/office-account/office-account-ui.tsx` (new — `OfficeAccountShell`, re-exports
  `DrmSection`/`DrmFormModal`/`DrmFormActions`)
- `src/modules/office-account/office-account-types.ts` (new — shared `AccountHead` type used by
  5 of the 8 pages)
- `src/modules/office-account/{business-customers,office-vas,cheque-system,office-expenses,
  trial-balance,general-ledger,chart-of-accounts,journal-voucher}-view.tsx` (new, 8 files)
- `src/app/(app)/dashboard/office/{business-customers,vas,cheques,expenses,trial-balance-report,
  general-ledger,chart-of-accounts,journal-voucher}/page.tsx` (new, 8 route files)
- `package.json` (`test:navigation` script now includes `office-routes.test.ts`)
- `docs/modules/office-account.md` (this file)

## Verification

`npm run typecheck` clean, full `npm test` passing (54 assertions, 0 failures), production build
(`next build --webpack`) compiles all 8 new routes as static pages with zero errors. All 8
primary backing endpoints live-tested with a JWT minted against a real admin user
(`account-heads`, `trial-balance`, `ledger` + `ledger/summary`, `expenses`, `vas`, `cheques`,
`business-customers`, `journal-vouchers`) — every one returned real, correctly-shaped data (the
empty `journal-vouchers: []` response is a true empty state, not an error — no vouchers have been
created in this DB yet). Browser click-through still blocked — no Playwright/chromium tool in
this environment.
