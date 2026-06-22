# PATCH 6 — Stage 9 UI/UX Production-States Changelog

Date: 2026-06-22. Scope: UI/UX validation, mock guards, inactive buttons, production
states on **active screens**. Behaviour-preserving; no new business features, no
reintroduced mock, no hidden backend failures, no future-phase screen marked
complete. Companion audits: `PATCH6_ACTIVE_SCREEN_UI_AUDIT.md`,
`PATCH6_INACTIVE_BUTTON_AUDIT.md`, `PATCH6_PRODUCTION_MOCK_GUARD.md`.

## Code changes
1. **`client/src/pages/dd-manager-dashboard.tsx`** — Removed two fake-success
   `toast("Project returned successfully (Mock)")` calls for the raw
   `PRODUCT_POSTING` reject path (which has no backing API). Replaced with an honest
   destructive toast: *"Reject not available — Returning a project at this workflow
   stage isn't supported yet."* The reason-modal no longer closes as if the action
   succeeded. No API added; no workflow/permission change.

2. **`client/src/pages/it-manager-dashboard.tsx`** — The two `onClick={() => {}}`
   icon buttons ("Edit Domain", "Account Details") are now rendered disabled
   (`aria-disabled`, `cursor-not-allowed`, dimmed, descriptive `title`). The two
   wired icons in the same cell were left untouched.

3. **`client/src/pages/allowed-ip-list.tsx`** — The Delete action no longer fires
   immediately. Added an `AlertDialog` confirmation (reusing
   `components/ui/alert-dialog.tsx`) that names the IP/CIDR being removed; the delete
   mutation runs only on explicit confirm, with a "Deleting…" pending state.
   Existing Loading/Error/Empty states were retained.

4. **`client/src/lib/feature-flags.ts`** — Added `isDemoModeEnabled()` (default OFF;
   driven by `VITE_DEMO_MODE_ENABLED`). Reuses the existing flag module; no new config
   file. See `PATCH6_PRODUCTION_MOCK_GUARD.md`.

## Verified already-correct (no change)
- **`it-servers.tsx` Add Domain** — already validates required domain, hostname format,
  and expiry-before-activation, rendering `domainFormError`.
- **Unauthorized (401)** — handled globally in `lib/queryClient.ts` (redirect to
  `/auth`); per-page 401 states unnecessary.
- **Write failures** — `mutationRequest`/`apiRequestJson` throw on non-2xx, so the UI
  surfaces real backend errors instead of faking success.

## Documented (no change this stage)
- **OFF-001 / OFF-002** (`office-account-head.tsx`, `office-old-account-head.tsx`) —
  already redirected to `/office/chart-of-accounts`; unreachable. Files retained per
  repo preference.
- **`public-pool.tsx` / `customer-list.tsx`** — dev-only demo components (referenced
  only by `components/examples/*`); not on any live route.
- **`it-manager-dashboard.tsx` mock tables** — internal/sidebar-hidden; Open (wiring to
  real APIs is out of bounded scope).
- **Broad destructive-without-confirm pattern** (~20 pages) — only `allowed-ip-list`
  fixed (plan-named); the rest are listed in the inactive-button audit and deferred.

## Verification
- `npm run check` (tsc): **0 errors**.
- `npm run dev`: boots on port 5000.
- `npm test`: see Stage-9 run (no new regressions vs baseline).
- Unauthenticated API smoke: protected routes return 401.

## Not touched
No business workflow/approval/role/permission/formula changes; no Stage-8 docs or
permission matrices modified; `route-registry.ts` left as-is; no backup/scratch/demo
files deleted.
