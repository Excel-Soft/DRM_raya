# Stage 1A — P0 Auth / Session / Password / API-Error Security

Security hardening only. No business-workflow, UI, role/permission, GM/BV/PMS, or
product-posting logic was changed. No secrets are exposed.

## A — Server-validated auth/session state (already in place, verified)
- `client/src/App.tsx` authoritatively validates the session via `GET /api/auth/me`
  on mount/navigation, checks `res.ok`, and on failure clears all auth
  `sessionStorage`, sets an "expired session" message, clears the query cache, and
  redirects to `/auth`. Stale `sessionStorage` is not trusted on its own.
- `client/src/hooks/useRouteProtection.ts` is fail-closed and consumes the
  server-derived auth state. No change required.

## B — Single active-role source (already in place, verified)
- The backend authorizes from the **verified JWT** (`activeRoleId`), not from any
  client-supplied header. `GET /api/auth/me` returns `activeRoleId`; non-admin role
  switches re-issue a JWT via `POST /api/auth/set-active-role` after verifying the
  role is in the user's assigned roles. Editing client storage cannot escalate
  access. No risky refactor performed.

## C — Standardized direct fetches to attach auth + central 401 handling
Converted protected direct `fetch()` calls to the shared `apiRequest` helper (which
attaches the bearer token and routes 401s through `handleUnauthorized`):
- `client/src/pages/software-manager-dashboard.tsx` — overtime action PATCH,
  leave POST, leave approve/reject PATCH.
- `client/src/pages/lead-manager-dashboard.tsx` — assign/transfer lead PATCH,
  customers/add POST, check-duplicate GET.
- `client/src/pages/lead-executive-dashboard.tsx` — customers/add POST,
  followups POST, leads PATCH (x2), check-duplicate GET.
- `client/src/pages/user-reports.tsx` — `GET /api/auth/me` (x5) now via `apiRequest`.
- `client/src/pages/add-portfolio.tsx` — `/api/portfolio` is a multipart upload, so
  it keeps `fetch` (browser must set the multipart boundary) but now attaches the
  auth header via `getAuthHeader()` and `credentials: "include"`; no `Content-Type`
  is set manually.

## D — Signup security (already in place, verified)
- Public signup is disabled when `NODE_ENV=production`; the default role is the
  lowest-privilege `sales_executive` (never admin); responses are sanitized.

## E — Password reset hardening (`server/auth.routes.ts`)
- **Removed** the insecure `POST /api/auth/reset-password` (direct email +
  newPassword reset, no token). It was not used by the frontend.
- `POST /api/auth/forgot-password`:
  - Token is now `crypto.randomBytes(32)` (was `Math.random`).
  - Only the **SHA-256 hash** of the token is stored; the raw token is never persisted.
  - Generic, constant response regardless of whether the account exists
    (no account enumeration).
  - In-memory per-IP+email **rate limit** (5 / 15 min) — no new dependency.
  - The raw reset link/token is printed **only in non-production**, never logged in prod.
- `POST /api/auth/reset-password-with-token`:
  - Hashes the incoming token and compares against the stored hash.
  - One-time use (token consumed immediately).
  - Writes **only** `password_hash` (no plaintext).

## F — Remove plaintext password
- `shared/schema.ts`: `users.password` is now nullable and documented as a
  deprecated legacy column.
- DB migration applied to the live dev DB **and** persisted as a forward migration
  file `migrations/20260605_make_user_password_nullable.sql`
  (`ALTER TABLE drm.users ALTER COLUMN password DROP NOT NULL`). The drizzle baseline
  snapshot `0000_rapid_taskmaster.sql` still declares the column `NOT NULL`; it is the
  generated baseline and is intentionally left untouched — the forward migration is
  what brings a freshly-provisioned DB in line with the nullable schema.
- `server/users-routes.ts`: removed `password` from the user-list response; user
  create writes `NULL` to the legacy column (only `password_hash` is meaningful) and
  no longer returns `password`; user update writes only `password_hash`.
- `server/auth.routes.ts`: token-based reset writes only `password_hash`.
- `server/storage.ts`: in-memory stub coalesces the now-optional password to `null`
  (legacy/non-DB path; left otherwise untouched).

## G — Error / log hygiene
- `server/utils/api-error.ts`: added `sendSafeError(res, status, code, message)` that
  always emits the standard envelope (never a stack/SQL/secret).
- `server/auth.middleware.ts`: removed the forced `|| true` that logged user/role on
  **every** request; now gated behind `DEBUG_AUTH=true`.
- `server/auth.routes.ts`: `set-active-role` and reset-success console logs are gated
  behind `DEBUG_AUTH=true`.

## H — MOCK_AUTH production guard (already in place, verified)
- `server/routes.ts` throws on startup if `NODE_ENV=production` and `MOCK_AUTH=true`.

## J — Verification
- `npm run check`: 58 TypeScript errors — identical to the pre-existing baseline
  (untyped `useQuery` results and `server/repositories/*` + `server/reports-routes.ts`).
  No new errors introduced by these changes.
- Server restarted; 8 smoke checks run against the live server:
  1. `GET /api/auth/me` without token → 401. PASS
  2. `GET /api/auth/me` with token → 200 with `activeRoleId`, no password leak. PASS
  3. `GET /api/users` with token → 200, no `password`/`password_hash` field exposed. PASS
  4. `GET /api/users` without token → 401. PASS
  5. `POST /api/auth/reset-password` (removed) → unreachable (401 without token; the
     handler no longer exists). No password reset occurs. PASS
  6. `POST /api/auth/forgot-password` → generic success, no token/link in body. PASS
  7. `POST /api/auth/reset-password-with-token` (bad token) → 400, sanitized envelope. PASS
  8. `POST /api/auth/login` (wrong creds) → 401, sanitized envelope (no stack/SQL). PASS

## Notes / out of scope
- `server/create-test-user.ts` is a manual DEV-ONLY helper script (not in any request
  path) and still sets a dev password; left as-is per "only security hardening of the
  live app" scope.
- Existing rows may retain legacy plaintext in the deprecated `password` column; new
  writes never store plaintext. A separate data backfill/cleanup is out of scope.
- `client/src/pages/user-reports.tsx` still uses raw `fetch` for two non-`/api/auth/me`
  calls: the loan-create POST (`/api/loans`) and the report export download
  (`/api/reports/:type/export`). Both already attach the bearer token via
  `getAuthHeader()`; the export must read a binary `blob`, so it keeps `fetch` for the
  same reason `add-portfolio.tsx` does. Stage 1A subtask C scoped this file to the five
  `/api/auth/me` calls, which are converted. Converting these two to a central helper is
  a low-risk consistency follow-up, not a security gap.

## Unresolved / requires user action (SECURITY RISK)
- **`JWT_SECRET` is hard-coded in `.replit` under `[userenv.shared]`** (committed to the
  repo). This contradicts the project rule "secrets must live in Replit-managed env,
  never hard-coded in source," and the value is recoverable from git history. It was
  **not** introduced by this work and is left in place here because fixing it correctly
  requires (a) the user to set a freshly-rotated `JWT_SECRET` in the Replit Secrets
  store and (b) accepting that rotation invalidates every active session — a behavior
  change outside the "run as-is" constraint and the A–J scope. Recommended action: move
  `JWT_SECRET` to Secrets, rotate to a new random value, then remove it from `.replit`
  and restart. (`server/auth.service.ts` also has a `"dev-secret-key-change-in-production"`
  fallback, so the var must be set before the `.replit` value is removed.)
