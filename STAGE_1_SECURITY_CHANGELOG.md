# Stage 1 — P0 Security Hardening Changelog

WebExcels DRM. Scope: implement the P0 security fixes A–J only. No UI redesign,
no new modules, no module deletions, no destructive DB operations, no secret
exposure. Business workflows, approval logic, roles/permissions, and DB business
structure are otherwise unchanged.

## Summary of P0 fixes

### A — Private-route authentication (fail-closed)
**File:** `client/src/App.tsx`, `client/src/pages/auth.tsx`
- The app now authoritatively validates the session against `GET /api/auth/me`
  before rendering any private page. Stale `sessionStorage` values are no longer
  trusted on their own.
- New `authStatus` gate (`loading` → `authed` / `unauthed`):
  - While `loading`, a neutral loading screen is shown — private content no
    longer flashes before auth resolves.
  - On `/api/auth/me` failure, stale client state (`token`, `userId`,
    `userName`, `userRole`, `userRoles`) is cleared, the query cache is reset,
    an expired-session message is queued, and the user is redirected to `/auth`.
- `auth.tsx` reads the queued `authMessage` from `sessionStorage` and surfaces
  it as an inline error (e.g. "Your session has expired. Please sign in again.").

### B — Route protection hook (authoritative + fail-closed)
**File:** `client/src/hooks/useRouteProtection.ts`
- `useRouteProtection` now takes the server-validated auth state
  (`activeRoleId`, `userRoles`, `ready`, `isAuthenticated`) instead of reading
  `sessionStorage` directly.
- It does not evaluate (and never fails open) until the server check has
  resolved (`ready`). When unauthenticated, it defers to App-level redirect.
- Role checks evaluate the full role set (active + assigned) against
  `ROUTE_PERMISSIONS`; unauthorized access redirects to the role's default
  dashboard (fail-closed).

### C — Sidebar permissions (fail-closed)
**File:** `client/src/components/app-sidebar.tsx`
- The permissions query (`/api/drm/permissions`) now throws on a non-OK
  response so the query reports an error state instead of silently returning
  `[]` (which previously read as "no restrictions").
- Menu filtering replaced the previous fail-OPEN behavior
  (`permsLoading || menuPermissions.length === 0 → show all`) with fail-CLOSED:
  - Items without a `permKey` and the Dashboard remain visible to all logged-in
    users.
  - Real `admin`/`super_admin` keep full nav (explicit exception).
  - While permissions load, permissioned items are hidden.
  - If the permissions fetch fails, only minimal nav is shown.
  - Otherwise visibility is decided by `hasAccess()` (DB roles + hardcoded map).

### D — Signup security
**File:** `server/auth.routes.ts`
- Public self-service signup is disabled in production (`403`).
- The default role for self-service signups is no longer `admin`; it is now the
  lowest-privilege real role (`sales_executive`) via `SIGNUP_DEFAULT_ROLE`, so
  an account can later be elevated by an administrator.
- Errors return a sanitized message (no internals).

### E — Login error sanitization
**File:** `server/auth.routes.ts`
- The login catch block no longer returns `message` / `stack` / `details` to the
  client. Full error details are logged server-side; the client receives a
  generic `500 { error: "Internal server error" }`. Invalid credentials still
  return `401 { error: "Invalid credentials" }`.

### F — Approval authorization checks
**Files:** `server/leave-routes.ts`, `server/loan-routes.ts`,
`server/overtime-routes.ts`
- Replaced the `// TODO: Add role check` placeholders with real authorization,
  using `server/utils/role-utils` helpers and a local `callerRole(req)` that
  reads `activeRoleId` → `roleId` → `role` from the auth payload. Unauthorized
  callers get `403`.
  - Leave: `approve`, `reject` → `isManagerialRole`.
  - Loan: `managerApprove` → `isManagerialRole`; `hodApprove` → `isHodAllowed`;
    `reject`, `complete`, `pay-installment` → `isManagerialRole`.
  - Overtime: `approve`, `reject` → `isManagerialRole`.

### G — SQL injection (parameterization)
**File:** `server/routes/product-posting-workflow-routes.ts`
- The `assign-task` handler interpolated `invoiceId` directly into a SQL string.
  It now uses a parameterized query (`pool.query(... WHERE id = $1, [invoiceId])`).
- Swept the file for similar string-interpolated SQL; no other instances found.

### H — DRM debug endpoint lockdown
**File:** `server/drm-routes.ts`
- `GET /api/drm/permissions/debug` (exposes schema + a sample row) is now:
  - Behind `authMiddleware` (the router is mounted before the global auth
    middleware, so auth is applied locally).
  - Returns `404` in production.
  - Returns `403` unless the caller's normalized role is `admin`
    (covers `admin`/`super_admin`).

### I — Todo error leak
**File:** `server/todo-routes.ts`
- The create-task catch block no longer returns PG `message` / `detail` / `code`
  to the client. Details are logged server-side; the client receives a generic
  `500 { error: "Failed to create tasks" }`. Zod validation still returns `400`.

### J — MOCK_AUTH production guard
**File:** `server/routes.ts`
- `registerRoutes` now throws on startup when
  `NODE_ENV === "production" && MOCK_AUTH === "true"`, refusing to start with a
  fatal error rather than silently bypassing real authentication in production.

## Files changed
- `client/src/App.tsx`
- `client/src/components/app-sidebar.tsx`
- `client/src/hooks/useRouteProtection.ts`
- `client/src/pages/auth.tsx`
- `server/auth.routes.ts`
- `server/drm-routes.ts`
- `server/leave-routes.ts`
- `server/loan-routes.ts`
- `server/overtime-routes.ts`
- `server/routes.ts`
- `server/routes/product-posting-workflow-routes.ts`
- `server/todo-routes.ts`

## Verification

### Commands
- `npm run check` — TypeScript type check. Result: 64 error lines across the
  same pre-existing baseline files (`reports-routes.ts`, `debug-routes.ts`,
  `migrations/*`, `repositories/*`, `software-manager-dashboard.tsx`). **Zero**
  new errors introduced in any file changed by this stage.
- `npm run build` — succeeded (Vite client build + esbuild server bundle).
- `npm run dev` — app boots and serves on port 5000.

### Smoke results (dev)
- `GET /api/auth/me` without a token → `401` (fail-closed).
- `GET /api/drm/permissions/debug` without auth → `401` (auth required;
  returns `403` for non-admins and `404` in production).
- `POST /api/auth/login` with bad credentials → `401 { error: "Invalid
  credentials" }` — no stack/details leaked.

## Unresolved / notes
- **CRITICAL (out of A–J scope) — unauthenticated DRM permission CRUD.**
  `drmRoutes` is mounted at `app.use("/api/drm", ...)` *before* the global
  `app.use("/api", authMiddleware)`. Fix H added local `authMiddleware` to
  `/api/drm/permissions/debug` only. The permission-management endpoints
  `GET/POST/PUT/DELETE /api/drm/permissions*` (create, update, toggle, delete,
  sub-urls) remain **unauthenticated and unauthorized**, so an anonymous caller
  can read and modify the app-wide permission configuration. This was a
  pre-existing condition (not introduced by Stage 1) and is **not** one of the
  defined A–J fixes, so it was intentionally left untouched per the
  "implement ONLY A–J / STOP after Stage 1" scope. **Strongly recommended as the
  first item of the next stage:** put `authMiddleware` + an admin/super_admin
  authorization check in front of all `/api/drm/permissions*` routes (or move
  the mount after the global auth middleware).
- Pre-existing TypeScript errors (the 64-line baseline) are out of scope for
  Stage 1 and were intentionally left untouched.
- The role model has no dedicated low-privilege "pending"/"employee" role, so
  self-service signups (dev only) default to `sales_executive`; elevate via an
  administrator as needed.
