# Patch 4 — Stage 6: Support Module Deactivation (ISS-02 P2)

**Issue:** ISS-02 P2 — "Support Module not required at this time."
**Goal:** Deactivate the Support module for the current phase behind a reversible
feature flag. No support code or database tables were deleted; re-enabling is a
config-only change.

## Feature flag

| Side     | Variable                       | Default | Helper                                  |
|----------|--------------------------------|---------|-----------------------------------------|
| Backend  | `SUPPORT_MODULE_ENABLED`       | `false` | `isSupportModuleEnabled()` (`server/feature-flags.ts`) |
| Frontend | `VITE_SUPPORT_MODULE_ENABLED`  | `false` | `isSupportModuleEnabled()` (`client/src/lib/feature-flags.ts`) |

A flag is ON **only** when its value is exactly the string `"true"`. When the
variable is absent (the current/default state), the module is OFF. Vite only
exposes env vars prefixed with `VITE_` to client code, so the frontend uses a
mirrored variable name; the backend variable is the real API enforcement.

## Files changed

### New
- `server/feature-flags.ts` — backend `isSupportModuleEnabled()` helper.
- `client/src/lib/feature-flags.ts` — frontend `isSupportModuleEnabled()` helper.
- `client/src/pages/support-inactive.tsx` — "Module unavailable" page shown in
  place of Support routes when the module is off.

### Modified
- `server/routes.ts` — mounted a `/api/support` deactivation gate at the very top
  of `registerRoutes`, before the global auth / IP / permission middleware, so the
  whole prefix returns `404 { "error": "Not Found" }` regardless of authentication
  when the module is disabled.
- `server/support-routes.ts` — added a clarifying comment documenting that the
  deactivation gate lives in `server/routes.ts` (no behavioural change here; the
  ticket handlers only run when the module is enabled).
- `client/src/App.tsx` — the three `/support/*` routes render the inactive page
  when the module is off (no support pages render, no crash).
- `client/src/components/app-sidebar.tsx` — the "Support" sidebar section is
  hidden when the module is off.
- `client/src/pages/reception-dashboard.tsx` — "Support Tickets" quick link
  hidden when off.
- `client/src/pages/dd-executive-dashboard.tsx` — the "Notice" Important row
  (which links to `/support/tickets`) hidden when off.
- `client/src/components/qa-manager-widget.tsx` — "Complaints" quick link
  (`/support/complaints`) hidden when off.
- `client/src/components/verification-manager-widget.tsx` — "Complaints" quick
  link (`/support/complaints`) hidden when off.

## Routes hidden / blocked (frontend, when OFF)
- `/support/tickets` → Module Inactive page
- `/support/tickets/:id` → Module Inactive page
- `/support/complaints` → Module Inactive page

(`Complaints` is part of the Support module — it reads `/api/support/tickets` —
so it is deactivated together with Support.)

## APIs blocked (backend, when OFF)
- `GET/POST/PUT/PATCH/DELETE /api/support/*` → `404 { "error": "Not Found" }`,
  returned before authentication and before any ticket handler executes.

## Sidebar / shortcut changes (when OFF)
- "Support" top-level sidebar section: hidden for all users (admins included).
- Reception dashboard "Support Tickets" shortcut: hidden.
- DD-Executive dashboard "Notice" Important row (links to support tickets): hidden.
- QA Manager / Verification Manager widget "Complaints" shortcuts: hidden.

## Permissions
No permission rows were deleted or altered. The `Support` menu permission and the
`/api/support` URL permission seed rows remain intact (historical). Visibility and
access are controlled entirely by the feature flag, so deactivation is fully
reversible. See `SUPPORT_MODULE_DEACTIVATION_NOTES.md` for the optional DB note.

## Re-enable (config only)
1. Set `SUPPORT_MODULE_ENABLED=true` (server env).
2. Set `VITE_SUPPORT_MODULE_ENABLED=true` (client env).
3. Restart the app (Vite inlines client env at build/start).

## Tests run
- `npm run check` (tsc) — no new type errors introduced by this stage.
- `npm run dev` — app boots and serves on port 5000.
- Manual smoke tests — see `SUPPORT_MODULE_DEACTIVATION_NOTES.md`.
