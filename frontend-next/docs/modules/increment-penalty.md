# Increment / Add Penalty — migration notes

Two standalone DRM/DD department pages, not part of any larger sidebar group. Both were
showing as Legacy in the Next "Reports" sidebar group (where they'd been filed for
convenience, even though legacy's real `permKey: "Reports"` group — `app-sidebar.tsx` lines
254-276 — does not include them).

**Status: both built on Next.**

| Legacy path | Label | Next path |
|---|---|---|
| `/drm/increment` | Increment | `/dashboard/increment` |
| `/drm/add-penalty` | Add Penalty | `/dashboard/add-penalty` |

## Why these paths, not `/dashboard/drm/*`

Next's `route-access.ts` has a `"/drm"` prefix rule (`ADMIN_ONLY_ROUTE_ROLES`) used by the real
DRM Setting module (`drm-routes.ts` — Attributes, Permission, Promotion, etc., all genuinely
admin-only). Increment and Add Penalty are tagged `module: "DRM/DD"` in legacy's
`route-registry.ts`, a different, broader-access department grouping — not the same thing.

Checked legacy's actual client-side gate (`frontend/src/hooks/useRouteProtection.ts`, the real
source `route-access.ts` was modeled on) and confirmed it has **no entry at all** for
`/drm/increment` or `/drm/add-penalty` — `route-registry.ts`'s `allowedRoles` field for these two
pages is unused metadata, not wired into any route guard. Legacy's actual behavior: these two
pages are client-side ungated (any authenticated user can navigate there); only sidebar-link
visibility (by `permKey`) and the backend API's own 403s gate real access.

Placing them at `/dashboard/increment` and `/dashboard/add-penalty` (instead of nesting under
`/dashboard/drm/*`) means `toLegacyGuardPath` maps them to `/increment` and `/add-penalty`, which
match no `ROUTE_PERMISSIONS` key — correctly reproducing legacy's real "ungated client-side,
backend is the authority" behavior. Nesting under `/drm/*` would have wrongly inherited the
admin-only DRM Setting gate and locked out HODs/managers who should have access.

## Backend is the real authority — ported as-is

Both pages are driven entirely by backend-computed permission flags, so no client-side role
logic needed porting at all:

- **Increment** (`backend/src/server/routes/increment-routes.ts`): every report row carries its
  own `actionState: { canDecide, reason }` — the "Decide" button's disabled state and tooltip
  come straight from the API response. Row visibility is scoped server-side too (`admin` /
  `super_hod` → all; `hod` / managerial → own department + self; everyone else → self only).
- **Add Penalty** (`backend/src/server/routes/penalty-routes.ts` +
  `backend/src/server/middleware/penalty-permission.ts`): `/api/penalties/meta` returns
  `permissions: { canCreate, canDecide, canVoid, canViewReports, isFullAccess, role }` — every
  action button (Add, Edit, Approve/Reject, Delete, Void) is gated directly on these flags.

Confirmed server-side: neither service file has any "under development" stub left (grepped both
for that legacy UI message) — `increment.service.ts` (~913 lines) and `penalty.service.ts`
(~493 lines) are fully built, and every endpoint the pages call exists with matching shapes.

## UI conventions used (same as every other ported DRM/Reports page)

- Legacy's Popover+Command searchable combobox for the grouped user/employee picker was replaced
  with the already-established `Select` + `SelectGroup` + `SelectLabel` pattern (same convention
  as every other migrated grouped-user picker in this app, e.g. `user-reports-view.tsx`,
  `diagnose-view.tsx`) — no searchable-combobox equivalent exists in this app's component set, and
  this substitution has been the standing precedent throughout the migration.
  The raw `<table>` markup was ported to `DataTable` (matches `edit-attendance-view.tsx` and every
  other complex-action table already migrated); custom pagination buttons were replaced with the
  shared `PaginationBar`.
- Shadcn `Dialog`/`AlertDialog` usages were replaced with `DrmFormModal` (detail/decision/form/
  approval/void modals) and `ConfirmDialog` (the simple "Delete penalty?" confirmation) from
  `@/modules/drm/drm-ui` and `@/components/ui/confirm-dialog` respectively — both already the
  house modal primitives for DRM-family pages.
- Status/eligibility badges use the modern `Badge` component with a `className` color override
  (same precedent as `user-reports-view.tsx`'s Verified/Pending badges), since the modern Badge's
  4 built-in variants don't cover the 4-5 distinct tones legacy's status/eligibility maps need.

## Files touched this pass

- `src/lib/navigation/increment-routes.ts` / `.test.ts` (new)
- `src/lib/navigation/penalty-routes.ts` / `.test.ts` (new)
- `src/lib/navigation/migrated-routes.ts` / `legacy-redirects.ts` (added imports + spreads)
- `src/lib/navigation/navigation-config.ts` (`rep-increment`/`rep-add-penalty` now import the
  canonical constants instead of bare legacy strings)
- `src/modules/increment/increment-ui.tsx`, `increment-view.tsx` (new)
- `src/modules/penalty/penalty-ui.tsx`, `penalty-view.tsx` (new)
- `src/app/(app)/dashboard/increment/page.tsx`, `src/app/(app)/dashboard/add-penalty/page.tsx` (new)
- `package.json` (`test:navigation` includes both new route test files)

## Verification

`npm run typecheck` clean, full `npm test` passing (53/53, 0 failures), production build compiles
`/dashboard/increment` and `/dashboard/add-penalty` as static pages with zero errors. Backend
endpoints live-tested with an admin JWT: `/api/drm/increment/users`, `/api/drm/increment/report`,
`/api/penalties/meta`, `/api/penalties` all returned real, correctly-shaped data. Legacy redirects
spot-checked after a dev-server restart: `/drm/increment` → `/dashboard/increment` (307),
`/drm/add-penalty` → `/dashboard/add-penalty` (307), both resolving to 200 with no error-boundary
text in the rendered HTML. Browser click-through still blocked — no Playwright/chromium tool in
this environment.
