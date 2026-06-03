---
name: RBAC / route / permission model
description: How frontend route guarding, sidebar visibility, and active-role flow fit together in WebExcels DRM
---

# WebExcels DRM — RBAC / route model

Access is enforced in three independent layers; the **backend is the security
boundary**, the two frontend layers are UX guards only.

1. Sidebar visibility — `hasAccess()` in `client/src/components/app-sidebar.tsx`:
   DB `menuPermissions.allowedRoleIds` win if present, else hardcoded
   `DEPT_NAME_TO_ROLES` fallback, else admin bypass, else fail-closed (hidden).
2. Client route guard — `ROUTE_PERMISSIONS` (prefix map) in
   `client/src/hooks/useRouteProtection.ts`: prefix match -> redirect to the
   role's default dashboard (`ROLE_DASHBOARDS`). Fail-closed; waits for
   `/api/auth/me` to resolve before evaluating.
3. Backend Express `authMiddleware` + per-route checks (authoritative).

**Why it matters / gotchas:**
- `App.tsx` routes are in a wouter `<Switch>` — FIRST match wins, so duplicate
  `path=` declarations later in the list are dead code. Dedup by keeping the
  first occurrence.
- ~76 routes have NO `ROUTE_PERMISSIONS` prefix => reachable by any
  authenticated user via direct URL (still hidden in sidebar, still backend-
  gated). Includes sensitive `/drm/users/*`, `/drm/permission`, `/office/*`,
  `/account/*`. Do not blanket-tighten without backend coordination — risk of
  locking out live roles.
- Role normalization is centralized: `normalizeRole` in BOTH
  `client/src/lib/role-utils.ts` and `server/utils/role-utils.ts`. Treats spaces
  AND hyphens as separators; collapses `d&d / dnd / d_d / d-d` -> `dd` (so
  `dnd_manager` == `dd_manager`). Keep the two copies in sync.
- Active role flows from `/api/auth/me` (`activeRoleId`); switched via
  `POST /api/auth/set-active-role` (own) or `/api/admin/impersonate` (admin),
  persisted in `sessionStorage`. Route guard + sidebar read the same active role.
