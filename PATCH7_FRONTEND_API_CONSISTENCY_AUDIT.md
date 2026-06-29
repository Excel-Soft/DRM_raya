# PATCH 7 — Frontend API Consistency Audit (API-001)

_Last updated: 2026-06-29 (Patch 7 Stage 1)._

Goal: every protected client→server call must (a) attach the JWT Bearer token,
(b) surface backend errors honestly (no silent failures), and (c) handle 401/403
consistently. This audit records the shared helper layer, the gaps closed in this
patch, and the remaining inventory with justifications.

## 1. The shared helper layer (`client/src/lib/queryClient.ts`)

| Helper | Purpose |
| --- | --- |
| `apiRequest(method, url, data?)` | Adds `getAuthHeader()` (Bearer token from storage) + JSON `Content-Type`, `credentials: "include"`. On `401` triggers `handleUnauthorized()` (clears token + redirect). Returns the raw `Response`. |
| `apiRequestJson(method, url, data?)` | `apiRequest` + parses JSON and **throws on non-2xx** via `throwIfResNotOk`, so React Query `isError`/mutation `onError` fire. |
| `mutationRequest(method, url, data?)` | Same throw-on-error contract for mutations. |
| `getQueryFn({ on401 })` | Default query function; attaches auth, configurable 401 behavior. |
| `extractApiError(body, status)` | Normalizes both the legacy `{ error: "msg" }` and the envelope `{ error: { code, message } }` / `{ message }` shapes into a clean string. |
| `throwIfResNotOk(res)` | **Patch 7:** now parses the error envelope and throws a friendly message; for **403** emits an explicit "You don't have permission to perform this action." when the backend supplies none. 401 logout behavior is unchanged. |

## 2. Gaps closed in Patch 7

`client/src/pages/dd-executive-dashboard.tsx` made four **protected** calls with
**no Authorization header** (cookie-only `fetch`), which is a real auth bug since
the app authenticates via Bearer token:

| Call | Before | After |
| --- | --- | --- |
| `GET /api/dd-executive/summary` | `fetch(..., {credentials:"include"})` | `apiRequestJson("GET", ...)` |
| `GET /api/dd-executive/daily-report` | raw `fetch` | `apiRequestJson("GET", ...)` |
| `GET /api/dd-executive/monthly-complete` | raw `fetch` | `apiRequestJson("GET", ...)` |
| `POST /api/pms/tasks` (create task) | raw `fetch`, hand-rolled error parse | `apiRequestJson("POST", ...)` |

All four now attach the Bearer token and surface backend errors via the shared
envelope-aware path.

`throwIfResNotOk` was upgraded so every caller (including all existing raw
fetches that route through `apiRequestJson`/`mutationRequest`) renders a friendly
403/4xx message instead of a raw `"<status>: <json blob>"` string.

## 3. Remaining raw `fetch("/api/...")` inventory

~30 client files still call `fetch` directly (full list below). These were **not**
swept in Stage 1 because the vast majority already attach `getAuthHeader()`
manually and are functionally correct; a blind 1-for-1 refactor of every call
carries more regression risk than security value. They are scheduled for
mechanical migration to `apiRequest*` in a later stage.

**Files with raw `fetch` (auth header attached manually unless noted):**
`App.tsx`, `components/app-sidebar.tsx`, `components/chart-data-widget.tsx`,
`components/customer-monthly.tsx`, `components/InvoiceCreateForm.tsx`,
`components/lead-import-dialog.tsx`, `components/target-achieve.tsx`,
`pages/ab-report.tsx`, `pages/account-gm-entries.tsx`, `pages/add-portfolio.tsx`,
`pages/auth.tsx` (login — intentionally tokenless), `pages/business-customers.tsx`,
`pages/CheckDuplicationPage.tsx`, `pages/cheque-system.tsx`,
`pages/create-target.tsx`, `pages/dollar-system.tsx`, `pages/gm-pool-add-gm.tsx`,
`pages/hod-dashboard.tsx`, `pages/invoice-report.tsx`, `pages/ledger-report.tsx`,
`pages/marketing-manager-dashboard.tsx`, `pages/quotation.tsx`,
`pages/refund-report.tsx`, `pages/sales-targets.tsx`, `pages/service-overtime.tsx`,
`pages/service-pool.tsx`, `pages/temp-contact.tsx`, `pages/tracing.tsx`,
`pages/tracing-view.tsx`, `pages/user-reports.tsx`, `pages/user-report.tsx`.

> `pages/dollar-system.tsx.backup` is a scratch/backup file (kept per user
> preference) and is not shipped.

### Migration guidance for the remaining files
- Replace `const res = await fetch(url, { headers: { ...getAuthHeader() }})` +
  manual `res.json()`/error handling with `apiRequestJson(method, url, body)`.
- For queries, prefer `getQueryFn` or an `apiRequestJson` `queryFn`.
- `pages/auth.tsx` login should stay tokenless (it mints the token).

## 4. Result
- 401 → centralized logout/redirect (unchanged).
- 403 → friendly, non-logout error message (new).
- All migrated calls send the Bearer token; backend errors are surfaced honestly.
