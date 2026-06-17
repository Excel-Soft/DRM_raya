# Support Module Deactivation — Notes

Operational notes for the Support module deactivation introduced in Patch 4
Stage 6 (ISS-02 P2). For the full list of changed files see
`PATCH4_STAGE6_SUPPORT_DEACTIVATION_CHANGELOG.md`.

## Feature flag

- **Backend:** `SUPPORT_MODULE_ENABLED` (read via `isSupportModuleEnabled()` in
  `server/feature-flags.ts`).
- **Frontend:** `VITE_SUPPORT_MODULE_ENABLED` (read via `isSupportModuleEnabled()`
  in `client/src/lib/feature-flags.ts`). The `VITE_` prefix is required for Vite
  to expose the value to client code.
- Both default to **OFF**. A flag is ON only when its value is exactly `"true"`.
  Being absent (the current state) means the module is deactivated — no env value
  needs to be set to keep Support off.
- Secrets are not involved; these are non-sensitive boolean config values stored
  in Replit-managed env (never hard-coded in source).

## What is deactivated

The Support module includes **Support Tickets** and **Complaints** (the
Complaints page consumes `/api/support/tickets`, so it belongs to the same
module).

### Routes hidden (frontend)
When OFF, these render a "Support module unavailable" page (no support page
renders, direct URLs do not crash):
- `/support/tickets`
- `/support/tickets/:id`
- `/support/complaints`

### APIs blocked (backend)
When OFF, the whole prefix returns `404 { "error": "Not Found" }` before auth and
before any handler:
- `/api/support/*`

### Sidebar & shortcuts hidden
- "Support" sidebar section (all roles, including admin).
- Reception dashboard → "Support Tickets" quick link.
- DD-Executive dashboard → "Notice" Important row (links to `/support/tickets`).
- QA Manager / Verification Manager widgets → "Complaints" quick link.

## Permissions / DB

- **No rows were deleted or modified.** The historical `Support` menu permission
  and the `/api/support` URL permission seed row (`server/seed-settings.ts`)
  remain intact. The feature flag is the single source of truth for deactivation.
- **Optional (not required):** the sidebar also honours the DB `isActive` flag on
  the `Support` menu permission row. If management later wants a DB-level marker,
  it can be set reversibly (and re-enabled) without deleting anything:
  ```sql
  -- Deactivate at DB level (optional, reversible):
  UPDATE drm.menu_permissions SET is_active = false WHERE name = 'Support';
  -- Re-activate:
  UPDATE drm.menu_permissions SET is_active = true  WHERE name = 'Support';
  ```
  This was intentionally left unapplied so deactivation stays a pure config
  (feature-flag) change.

## Re-enable steps (config only)

1. `SUPPORT_MODULE_ENABLED=true` (server env).
2. `VITE_SUPPORT_MODULE_ENABLED=true` (client env).
3. Restart the app so Vite re-inlines the client flag.
4. (Only if the optional DB marker above was applied) set the `Support` menu
   permission `is_active = true`.

No code changes are needed to re-enable.

## Smoke tests

With the module OFF (default):
1. Login as **admin** → Support section is **hidden** in the sidebar.
2. Login as a **normal user** → Support section is **hidden**.
3. Navigate directly to `/support/tickets` → shows "Support module unavailable"
   (does not render the ticket list, does not crash).
4. Navigate directly to `/support/tickets/:id` → shows "Support module
   unavailable" (does not render ticket detail).
5. `GET /api/support/tickets` → `404 { "error": "Not Found" }`.
6. Set both flags to `true`, restart → Support reappears and works normally.
7. No unrelated sidebar modules disappear.
