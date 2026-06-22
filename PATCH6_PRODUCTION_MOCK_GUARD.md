# PATCH 6 — Stage 9 Production Mock Guard (Section F)

Date: 2026-06-22. Goal: ensure mock/demo UI is **never presented as real data** in
production, and provide a single, documented switch for any UI that must remain
demo-only.

## 1. The guard
Added to `client/src/lib/feature-flags.ts` (reused the existing flag module — no new
config file created):

```ts
export function isDemoModeEnabled(): boolean {
  return import.meta.env.VITE_DEMO_MODE_ENABLED === "true";
}
```

- **Default OFF.** A flag is enabled only when its value is exactly the string
  `"true"`; absence ⇒ disabled. So production (no env var set) hides demo UI.
- **Client flags are UI-only.** They decide what the browser renders. They are **not**
  an authorization decision. The **server remains the enforcement boundary**:
  unimplemented/future endpoints already return 404/403, and write helpers
  (`mutationRequest`/`apiRequestJson`) throw on non-2xx so the UI cannot fake success.

## 2. Mock/demo inventory and disposition
| Source | Mock content | Reachable in live app? | Disposition |
|---|---|---|---|
| `pages/office-account-head.tsx` (OFF-001) | Hardcoded `CATEGORIES_DATA` chart-of-accounts + non-persisting modals | **No** — `/office/account-head` redirects to `/office/chart-of-accounts` (`App.tsx`, Stage 7) | Unreachable; file retained per repo preference. No guard needed. |
| `pages/office-old-account-head.tsx` (OFF-002) | `console.log` search stub | **No** — `/office/old-account-head` redirects to `/office/chart-of-accounts`; not in live sidebar | Unreachable; no guard needed. |
| `components/public-pool.tsx` | Hardcoded `publicLeads`; `console.log` claim button | **No** — only used by `components/examples/PublicPool.tsx`; live route uses real pages | Dev-only demo; retained. Not mounted, so no runtime guard required. |
| `components/customer-list.tsx` | Hardcoded `mockCustomers`; `console.log` view button | **No** — only used by `components/examples/CustomerList.tsx` | Dev-only demo; retained. |
| `pages/it-manager-dashboard.tsx` | Hardcoded `domainDetailsData` / `threeMonthExpireData` domain tables | **Yes** but `isInternal:true` (sidebar-hidden; admin/it_manager only) | **Open.** Wiring to real APIs is a new feature (out of bounded Stage-9 scope). The inert/fake controls on it were neutralised (see inactive-button audit); `isDemoModeEnabled()` is available to gate the demo tables in a follow-up without code churn now. |

## 3. Why dead/demo components were not deleted
The repo preference (`replit.md`) is explicit: *"Do not delete the existing
backup/scratch files."* `office-account-head.tsx`, `public-pool.tsx`, and
`customer-list.tsx` are unreachable in the live app (redirected or example-only), so
they present no production risk; they are documented here rather than removed.

## 4. How to enable demo mode (when intentionally demoing)
Set the Replit-managed env var `VITE_DEMO_MODE_ENABLED=true` (never hard-code it in
source). Leave it unset in production. This only affects UI visibility; server
authorization and validation are unchanged.
