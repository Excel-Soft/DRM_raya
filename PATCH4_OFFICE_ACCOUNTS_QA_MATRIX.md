# Patch 4 — Office Accounts QA Matrix (ISS-04)

Stage 7 QA for every Office Accounts sub-module. This stage is **verification +
documentation only** — no business logic, permissions, or workflows were
changed.

## Verification legend
- **✅ Code-verified** — confirmed by static code inspection + automated checks
  (route registered, endpoint exists, guard/validation/audit present) and the
  unauthenticated API smoke test below.
- **🟡 Manual run pending** — requires an authenticated UI session per role; could
  not be executed in this environment (no interactive login). Documented, not run.
- **❌ Gap found** — missing coverage; see notes / Final Report limitations.
- **n/a** — not applicable to this sub-module.

## Automated evidence (run this stage)
- `npm run check` (tsc): **0 errors**.
- `npm run build`: **success** (Vite client + esbuild server).
- `npm test` (vitest): **10 files, 154 tests passed**.
- Unauthenticated API smoke — every endpoint below returned **401** (access
  blocked): `/api/office/account-heads`, `/api/office/ledger`,
  `/api/office/journal-vouchers`, `/api/office/expenses`, `/api/office/cheques`,
  `/api/office/business-customers`, `/api/office/dollar`, `/api/account/invoices`,
  `/api/account/donations`.

## Backend split (important)
- **`server/office-account-routes.ts`** (Stage 1–2 hardened): every mutation +
  export is gated by `requireFinancialPermission(...)` and writes an audit row via
  `AuditLogService.record` / `recordTransition`.
  - Default write roles `FINANCIAL_WRITE_ROLES = [admin, account_manager]`.
  - Account-heads / journal-voucher / ledger widen to `STAGE2_FINANCIAL_ROLES`
    (`admin, account_manager, super_hod`).
- **`server/account-routes.ts`** (legacy GM / invoice / donation / dollar flows):
  enforces **authentication only** (global auth → 401). It contains **no role
  guard and no `403`** except the **dollar transaction**
  (`requireFinancialPermission(FINANCIAL_ACTIONS.dollarTransaction)` +
  `AuditLogService.record`). This is the main signoff finding (see ❌ rows).

## Matrix

| Sub-module | Route | Load | Create | Edit | Delete/Void | Approve/Status | Invalid input | Filter | Export | Permission | Audit | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chart of Accounts (Account Heads) | `/office/chart-of-accounts` | ✅ | ✅ `POST /api/office/account-heads` | ✅ `PATCH` | ✅ `DELETE` | n/a | 🟡 | ✅ | ✅ `/account-heads/export` | ✅ STAGE2 + 401 | ✅ record/transition | **PASS (code)** | Fully hardened; page has loading/empty/error states. |
| General Ledger | `/office/general-ledger` | ✅ | ✅ `ledger.post` | n/a | ✅ `ledger.reverse` | ✅ post/reverse transitions | 🟡 | ✅ shared WHERE | ✅ `/ledger/export` | ✅ STAGE2 + 401 | ✅ record | **PASS (code)** | Reversal is the "void" path; transitions audited. |
| Journal Voucher | `/office/journal-voucher` | ✅ | ✅ `journal_voucher.create` | n/a | ✅ `journal_voucher.cancel` | ✅ `journal_voucher.post` | 🟡 | ✅ | n/a | ✅ STAGE2 + 401 | ✅ transition | **PASS (code)** | Cancel = void; post/cancel audited via recordTransition. |
| Office Expenses | `/office/expenses` | ✅ | ✅ `expense.create` | ❌ no update endpoint | ✅ `expense.delete` | n/a | 🟡 | ✅ | ✅ `/expenses/export` | ✅ WRITE_ROLES + 401 | ✅ record | **PASS (code)** | Create+delete only; no edit endpoint (by design — confirm). |
| Cheque System | `/office/cheques` | ✅ | ✅ `cheque.create` | n/a | ✅ `cheque.delete` | ✅ `cheque.status_update` | 🟡 | ✅ | n/a | ✅ WRITE_ROLES + 401 | ✅ record/transition | **PASS (code)** | Status change audited via recordTransition. |
| VAS Documents | `/office/vas-documents` | ✅ | ✅ `vas.create` | n/a | ✅ `vas.delete` | n/a | 🟡 | ✅ | n/a | ✅ WRITE_ROLES + 401 | ✅ record | **PASS (code)** | Baseline flagged `vas_documents` table source — confirm table exists in `drm`. |
| Business Customers | `/office/business-customers` | ✅ | ✅ `business_customer.create` | ❌ no update endpoint | ✅ `business_customer.delete` | n/a | 🟡 | ✅ | n/a | ✅ WRITE_ROLES + 401 | ✅ record | **PASS (code)** | Create+delete only; confirm edit not required. |
| Invoices | `/account/invoices` | ✅ | ⚠️ `POST` (auth only) | ⚠️ `PATCH` (auth only) | ⚠️ `DELETE` (auth only) | ⚠️ `PATCH /:id/status` (auth only) | 🟡 | ✅ | n/a | ❌ no role guard | ❌ no per-action audit | **PARTIAL — FLAG** | Legacy `account-routes.ts`; relies on upstream quotation/approval workflow. No `requireFinancialPermission` / `403` / `AuditLogService`. |
| Donations | `/account/donations` | ✅ | ⚠️ `POST` (auth only) | n/a | ⚠️ `DELETE` (auth only) | n/a | 🟡 | ✅ | n/a | ❌ no role guard | ❌ no audit | **PARTIAL — FLAG** | Legacy `account-routes.ts`; authenticated only. |
| Dollar System / Buyers / Buying | `/account/dollar-system` | ✅ | ✅ transaction guarded; ⚠️ buyer/buying CRUD auth-only | n/a | ⚠️ buyer/buying `DELETE` (auth only) | n/a | 🟡 (zod on rate) | ✅ | n/a | 🟡 partial (transaction ✅) | 🟡 partial (transaction ✅) | **PARTIAL — FLAG** | Money-moving dollar transaction is role-guarded + audited; ancillary buyer/buying CRUD authenticated only. |
| GM Entries | `/account/gm-entries` | ✅ | ⚠️ `POST` (auth only) | n/a | ⚠️ `DELETE` (auth only) | ⚠️ approve/reject (auth only) | 🟡 | ✅ | n/a | ❌ no role guard | ❌ no audit | **PARTIAL — FLAG** | Legacy `account-routes.ts`. Approve/reject not role-gated; no audit on GM mutations. (The one `ActivityLogService.log` nearby is on `/pending-quotations/:id/approve` project auto-creation, **not** GM.) |
| Trial Balance Report | `/office/trial-balance-report` | 🟡 | n/a | n/a | n/a | n/a | n/a | ✅ date filters | 🟡 verify | 🟡 read — verify role | n/a (read) | **VERIFY** | Baseline flagged this page as previously static/mock — confirm it is now backend-driven. |
| AB Report (Account Reports) | `/account/ab-report` | 🟡 | n/a | n/a | n/a | n/a | n/a | ✅ filters | 🟡 verify | 🟡 read — verify role | n/a (read) | **VERIFY** | Read-only report; confirm data source + export-respects-filters. |

## No-crash / state coverage
Static inspection of the page components confirms loading/empty/error handling in
the data-heavy pages (chart-of-accounts, general-ledger, journal-voucher,
office-expenses, dollar-system). Simpler list pages (invoices, cheques, VAS,
donations, business-customers) surface API failures through the shared query
layer: `client/src/lib/queryClient.ts` throws on non-2xx (`getQueryFn` with
`on401: "throw"`), so React Query `isError` fires, and mutations use toast. No
blank-crash fallback was found. Full per-page visual confirmation per role is
**🟡 manual run pending** (needs login).

## Key findings (carry to Final Report)
1. **Permission/audit coverage gap (legacy `account-routes.ts`).** Invoices,
   Donations, GM Entries, and ancillary Dollar buyer/buying CRUD are
   authenticated-only — no `requireFinancialPermission` role guard and
   inconsistent audit. The newer `office-account-routes.ts` sub-modules are fully
   guarded + audited. **Not changed in this signoff stage** (no permission was
   weakened); flagged for business confirmation / a follow-up hardening task.
2. **Trial Balance / AB Report** need confirmation they are backend-driven (the
   baseline audit flagged Trial Balance as previously static).
3. **VAS documents** table source should be confirmed in the `drm` schema.
4. **Hardcoded / mock values found in legacy `account-routes.ts` (pre-existing,
   not introduced this stage — flagged, not changed):**
   - Dollar stats use `Number(stats.total_dollar_buy) * 280 // Rough mock rate`
     — a hardcoded USD→PKR fallback rate instead of a real rate source.
   - The AB report query injects hardcoded identifiers
     (`'pk1366559178xcih' as "abId"`, `'P2603262976188360_1' as "orderId"`)
     rather than real per-row values.
