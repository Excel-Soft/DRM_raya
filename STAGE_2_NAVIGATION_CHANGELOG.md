# Stage 2 — Navigation, Route Registry, Sidebar & Permission Alignment

This stage aligns the navigation surface (routes ↔ sidebar ↔ permissions) and
adds documentation + lightweight UX primitives. It makes **no screen redesign,
no business-logic change, and removes no business pages**. Access enforcement is
unchanged — the backend route guards and `useRouteProtection` remain the
authoritative security boundary.

## What changed

### 1. Central route registry (new, additive)
- `client/src/routes/route-registry.ts` — a typed `RouteEntry[]` inventory of all
  major routes (187 entries) with: `path`, `component`, `title`, `module`,
  `sidebarVisible`, `sidebarGroup`, `permissionKey`, `allowedRoles`, `isDynamic`,
  `isInternal`, `redirectTo`, `notes`. Includes helpers `findRouteByPath`,
  `getCanonicalPath`, and `getBreadcrumbsForPath`.
- **Non-authoritative**: mirrors runtime config for documentation/alignment; the
  runtime guards win on any disagreement.

### 2. Route duplicates / aliases resolved
`App.tsx` had **no duplicate path declarations**. Some components legitimately
serve multiple paths. The genuinely redundant aliases (none of which appear in
the sidebar) were canonicalized via `<Redirect>` so old links keep working:

| Alias (now redirects) | Canonical |
|-----------------------|-----------|
| `/sales/temp-contact` | `/customer/temporary-contact` |
| `/projects` | `/drm/delay-project` |
| `/dd-manager/project-report` | `/pms/project-report` |
| `/team-report/link-report` | `/posting-data/link-report` |
| `/pms/settings` *(pre-existing)* | `/drm/pms-setting` |

**Intentionally kept (NOT merged)** — documented as role-specific entry points to
the same role-aware component, because the top-bar role switcher and dashboards
target them directly:
- `/product-posting`, `/product-posting/manager`, `/product-posting/executive`
  → `ProductPostingDashboard`.

**Single-declaration, canonical (not actually duplicated, documented only)**:
- `/office/chart-of-accounts`, `/account/gm-entries`.

### 3. Sidebar ↔ route alignment (audit only — no items added/removed)
- Every sidebar URL resolves to a route. The User-Reports shortcuts
  `/reports/{loan,vas,gm,bv}` resolve through the `/reports/:type` catch-all, and
  "Gm Report" points at `/analytics/gm`.
- Routes not present in the sidebar are classified in the registry/matrix as
  `internal` (role dashboards, detail views), `dynamic` (`:id`/`:type`/`:category`),
  or `alias`. No sidebar entries were added, removed, or reordered.

### 4. Dynamic-route states (new reusable primitive + incremental wiring)
- `client/src/components/route-states.tsx` — `RouteLoading`, `RouteInvalidId`,
  `RouteNotFound`, `RouteUnauthorized`, `RouteInactive`, reusing the existing
  Card/Button design language.
- Wired (additive guards; business logic untouched) into:
  - `support-ticket-detail.tsx` — missing id → invalid, loading → spinner,
    not-found → not-found state.
  - `loan-report-edit.tsx` — missing id → invalid, query error → not-found.
  - `sales/create-invoice.tsx` already had loading / missing-param / not-found
    states (left as-is).
- Approach is **data-driven** (missing param ⇒ invalid; empty/errored query ⇒
  not found) to avoid ID-format false positives.

### 5. Breadcrumb / page-title (new reusable primitive + incremental wiring)
- `client/src/components/page-breadcrumb.tsx` — registry-driven `PageBreadcrumb`.
  Use `<PageBreadcrumb />` for an auto trail from the current location, or pass
  explicit `items`/`title` for record-specific pages.
- Applied to the two dynamic pages edited above. Other modules can adopt it
  incrementally with a single line; no layout was otherwise changed.

### 6. Documentation
- `ROUTE_PERMISSION_MATRIX.md` — generated from the registry: full route ↔ module
  ↔ sidebar ↔ permission-key ↔ allowed-roles table plus an alias summary.

## Files changed
- Added: `client/src/routes/route-registry.ts`
- Added: `client/src/components/route-states.tsx`
- Added: `client/src/components/page-breadcrumb.tsx`
- Added: `ROUTE_PERMISSION_MATRIX.md`
- Added: `STAGE_2_NAVIGATION_CHANGELOG.md`
- Modified: `client/src/App.tsx` (4 alias routes → `<Redirect>`)
- Modified: `client/src/pages/support-ticket-detail.tsx` (route states + breadcrumb)
- Modified: `client/src/pages/loan-report-edit.tsx` (route states + breadcrumb)

## Verification
- `npx tsc --noEmit`: **58** errors — unchanged from the pre-existing baseline;
  **zero new** errors in any changed/added file.
- `Start application` workflow boots cleanly on port 5000.

## Not done / out of scope (by design)
- No screen redesign, no role/permission rule changes, no new sidebar items.
- Breadcrumb/route-state primitives applied only to the dynamic pages touched;
  broader rollout is intentionally left as incremental follow-up.
- The registry is documentation/alignment only; `App.tsx` still declares routes
  directly (no risky router rewrite).
