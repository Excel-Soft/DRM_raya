# Stage 1 — Security / Auth / RBAC / Action-Permission Hardening

Scope: P0 hardening of the imported WebExcels DRM app. **No UI redesign, no
business-workflow changes, no secret exposure, no destructive DB changes.**
Existing, already-correct guards (hardened signup, hashed expiring reset tokens,
`/api/auth/me`, `MOCK_AUTH` prod guard, HR/loan/leave/overtime role +
self-approval guards) were left intact; only genuine gaps were filled.

## Files changed

### Backend
- **`server/middleware/action-permission.ts`** (NEW) — `requireActionPermission(actionKey, { roles?, allowRole?, message? })`.
  Fails closed: `401` when no `req.user`, sanitized `403` envelope otherwise.
  Uses `normalizeRole` on both the caller role and the allow-list, and reuses the
  shared `sendError` / `forbidden` / `unauthorized` helpers.
- **`server/users-routes.ts`** — applied `requireUserAdmin` (`roles: ["admin"]`,
  which also covers `super_admin`/`administrator` via `normalizeRole`) to every
  write route, which previously had **no role guard**:
  `POST /`, `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id`,
  `POST|PATCH|DELETE /groups`, `POST|DELETE /:id/team-members`,
  `POST /:id/impersonate`.
- **`server/drm-routes.ts`** (mounted before the global auth middleware, so auth
  is applied locally):
  - Added `requirePermsAdmin = [authMiddleware, requireActionPermission(...)]`
    and applied it (spread as individual middlewares) to the permission-mutating
    routes that were previously **unauthenticated**:
    `POST /permissions`, `POST /permissions/:id/sub-urls`,
    `PUT /permissions/:id/toggle`, `PUT /permissions/:id`,
    `DELETE /permissions/:id`.
  - Added `authMiddleware` to `GET /permissions` (sidebar sends a Bearer token).
  - Added `authMiddleware` to `GET /delay-projects` (was unauthenticated on this
    early-mounted router — caught in code review).
  - `GET /permissions/debug` confirmed already restricted (404 in production,
    admin-only in dev).

### Frontend (no-auth direct fetches → authenticated)
Added `getAuthHeader()` + `credentials: "include"` to bare `fetch` calls so they
send the JWT and participate in central 401 handling:
- `client/src/pages/business-customers.tsx`
- `client/src/pages/cheque-system.tsx`
- `client/src/pages/dollar-system.tsx`
- `client/src/pages/invoice-report.tsx`
- `client/src/pages/ledger-report.tsx`
- `client/src/pages/office-expenses.tsx`
- `client/src/components/chart-data-widget.tsx`
- `client/src/components/InvoiceCreateForm.tsx`

## P0 issues fixed
1. **User-management write routes had no RBAC** — any authenticated user could
   create/edit/delete/suspend users, manage groups/team-members, or impersonate.
   Now admin-only.
2. **DRM permission-config mutation routes were fully unauthenticated** — anyone
   could create/edit/toggle/delete menu permissions. Now admin-only behind auth.
3. **`GET /api/drm/permissions` was unauthenticated** — now requires a valid
   session token.
4. **Frontend made unauthenticated API calls** — several pages/components fetched
   without the Authorization header, bypassing central 401 handling. Now
   authenticated.
5. **Reusable fail-closed action-permission middleware** — central, sanitized,
   normalized-role enforcement primitive for future routes.

## Verified already-correct (documented, not modified)
- **A** Frontend server-validated routing (`App.tsx` `/api/auth/me` gate +
  clear/redirect/session-expired message; `useRouteProtection` fail-closed).
- **C** Hardened signup. **D** Hashed, expiring reset tokens. **E** Password
  never returned in user endpoints. **G** Sidebar fail-closed
  (`permsLoading`/`permsError` → hide; admin explicit; final fallback hide).
- **I** Error envelopes. **J** `MOCK_AUTH` production guard. **K** Debug endpoint.

## Known limitations / unresolved
- **`url_permissions` fails OPEN on "no rule"** (no matching rule → allow). Flipping
  this to hard-deny would lock out all non-admin users and break the app, so it is
  **documented, not changed**. Revisit with a seeded rule set in a later stage.
- **`GET /api/drm/permissions` returns 500** in this environment because the
  `drm.menu_permissions` table does not exist in the freshly created Replit
  database (pre-existing data/migration gap, unrelated to the auth change — the
  handler never reads `req.user`). The sidebar already **fails closed** on this
  error, so there is no security regression. Resolving it requires creating/seeding
  the table, which is out of scope (no business DB changes).

## Verification

### Commands
```bash
npm run check   # tsc — baseline 57 errors, unchanged after these changes
npm test        # vitest — 14 tests pass
```

### Smoke tests (running app, port 5000)
| Request | Expected | Result |
| --- | --- | --- |
| `GET /api/drm/delay-projects` (no token) | 401 | 401 ✅ |
| `GET /api/drm/delay-projects` (valid token) | 200 | 200 ✅ |
| `GET /api/drm/permissions` (no token) | 401 | 401 ✅ |
| `POST /api/drm/permissions` (no token) | 401 | 401 ✅ |
| `DELETE /api/drm/permissions/:id` (no token) | 401 | 401 ✅ |
| `POST /api/users` (no token) | 401 | 401 ✅ |
| `GET /api/drm/permissions/debug` (no token) | 401 | 401 ✅ |
| `POST /api/drm/permissions` (non-admin token) | 403 | 403 ✅ (sanitized envelope) |
| `DELETE /api/users/:id` (non-admin token) | 403 | 403 ✅ |
| `GET /api/drm/permissions` (valid token) | 200 | 500 — pre-existing missing table (see Known limitations) |
