# Phase 4.1 — Authentication and Next.js rewrite verification

**Date:** 2026-10-23  
**Branch:** `fix/upgrade_frontend_habib`  
**Owner:** Habib (implementation only; no Talha assignments; no new business module ports in this pass)  
**Scope:** Runtime verification of `frontend-next/` auth + `/api` rewrites against local Express. No Express/schema/deploy changes. No credentials in repo or in this document.

---

## Executive summary

| Area | Result |
|------|--------|
| Next.js rewrites (dev `:3000` → Express `:5001`) | **Verified** — status codes and JSON bodies match direct Express |
| Standalone rewrites (`:3001`, `BACKEND_URL` set) | **Verified** — same smoke endpoints |
| Auth journey (browser) | **Not executed** — no approved test account; no E2E framework installed |
| Auth journey (code + unit tests) | **Verified** — login/me/logout/401/403/gates align with Express contract |
| Role switch / impersonation in Next | **Gap documented** — backend + legacy only; not required for first read-only pilots |
| Regression suite | **Pass** (see below); one **environmental** blocker before first backend start |

**Recommendation:** **Continue foundation work.** Do **not** approve porting an additional business module until browser-verified login + protected navigation (or staging sign-off with credentials outside the repo). Rewrites and build pipeline are ready; human/E2E auth proof is the remaining P0.

---

## Environment (this run)

| Item | Value |
|------|--------|
| Next dev | `http://localhost:3000` (`npm run dev` in `frontend-next/`) |
| Next standalone smoke | `http://localhost:3001` (`node .next/standalone/server.js`, `PORT=3001`, `BACKEND_URL=http://localhost:5001`) |
| Express | `PORT=5001` (`npm run dev` in `backend/`) |
| Rewrite target | `next.config.ts` default / `.env.example`: `BACKEND_URL=http://localhost:5001` |
| Legacy Vite proxy reference | `frontend/vite.config.ts` → `http://localhost:5001` |

**Environmental (not code):** First backend start failed with `ERR_MODULE_NOT_FOUND` for `@anthropic-ai/sdk` until `npm install` was run in `backend/`. After install, server started; startup logged `ensureDbOnce timed out` but `GET /api/health/db` returned `ok: true`, `db: up`.

**Not modified:** Express routes, DB schema, production/staging deploy, legacy Vite frontend.

---

## Task 1 — Next.js rewrites

### Configuration inspected

- `frontend-next/next.config.ts`: rewrites `/api/:path*` and `/uploads/:path*` → `${BACKEND_URL}/api/:path*` (default `http://localhost:5001`).
- `frontend-next/src/config/env.ts`: `getBackendUrl()` mirrors same default; zod-validated `BACKEND_URL`.
- `frontend-next/.env.example`: documents `BACKEND_URL` only (no secrets).

### Commands and results

**A. Side-by-side probe (direct Express vs Next dev rewrite)**

```bash
# Node one-off (2026-10-23): fetch same paths on :5001 and :3000
```

| Path | Express `:5001` | Next `:3000` | Safe response metadata | Expected? |
|------|-----------------|--------------|-------------------------|-----------|
| `GET /api/health/db` | 200 | 200 | `{ ok: true, db: "up" }` | Yes — public health |
| `GET /api/auth/me` | 401 | 401 | `{ error: "No token provided" }` | Yes — `authMiddleware` |
| `GET /api/notice-board` | 401 | 401 | `{ error: "No token provided" }` | Yes — route uses `authMiddleware` |
| `GET /api/audit-logs` | 401 | 401 | `{ error: "No token provided" }` | Yes — JWT gate before `requireRole` |
| `GET /api/health/auth` | 401 | 401 | `{ ok: false, authenticated: false, reason: "missing-token" }` | Yes — public auth probe |

**B. Distinguish Next routing error vs Express auth**

| Request | Status | `Content-Type` | Interpretation |
|---------|--------|----------------|----------------|
| `GET http://localhost:3000/auth` | 200 | `text/html` | Next app route (not API rewrite) |
| `GET http://localhost:3000/api/auth/me` | 401 | `application/json; charset=utf-8` | Express JSON error via rewrite (not Next HTML 404) |

**C. Direct smoke script (Express only — baseline)**

```bash
cd frontend-next && BACKEND_URL=http://localhost:5001 npm run test:smoke-api
```

```
OK GET /api/health/db (public) → 200
OK GET /api/auth/me (no auth) → 401
OK GET /api/notice-board (no auth) → 401
OK GET /api/audit-logs (no auth) → 401
```

**D. Standalone artifact rewrite smoke**

After `npm run build`, copied static assets per Next standalone convention, then:

```bash
cd frontend-next/.next/standalone
PORT=3001 BACKEND_URL=http://localhost:5001 node server.js
curl -s http://localhost:3001/api/health/db   # 200, ok/db/up
curl -s http://localhost:3001/api/auth/me     # 401, No token provided
```

**Conclusion:** Rewrites forward to Express correctly in **dev** and **standalone** when `BACKEND_URL` matches the running API port (`5001`).

---

## Task 2 — Authentication journey

### Code inspected

| Piece | Location | Role |
|-------|----------|------|
| Session storage + headers | `src/lib/auth/session.ts` | Bearer from `sessionStorage`; optional `x-acting-role` from `userRole` key |
| Browser client | `src/lib/api/browser-client.ts` | Same-origin `/api/*`, `credentials: "include"`, merges `getAuthHeaders()` |
| Auth API | `src/lib/auth/auth-api.ts` | `login`, `fetchAuthMe`, `logout` |
| Provider | `src/providers/auth-provider.tsx` | Mount → `GET /api/auth/me`; 401 → `clearSession` + unauthenticated |
| Gate | `src/components/auth/auth-gate.tsx` | No protected flash; redirect `/auth`; prefix `isRouteAccessAllowed` |
| Login UI | `src/components/auth/login-form.tsx` | `POST /api/auth/login` → persist token + `applyLogin` → role dashboard |
| Express login/me/logout | `backend/src/server/routes/auth.routes.ts` | JWT in body; `setAuthCookie` on login; `/me` requires JWT |
| Token resolution | `backend/src/server/middleware/auth.middleware.ts` | **Bearer only** — cookie fallback disabled (`cookieToken = undefined`) |

### Verified from code + unit tests (not browser)

| Behavior | Status | Evidence |
|----------|--------|----------|
| Login request/response | Aligned | `login()` POST JSON; Express returns `{ token, user }`; form calls `persistLoginSession` + `applyLogin` |
| Session restore on reload | Path exists; **not browser-run** | `AuthProvider` `useEffect` → `fetchAuthMe()` with Bearer from `sessionStorage` |
| Bearer token | Required for API | Express `getAuthToken`; Next `getAuthHeaders()` |
| Cookie on login | Set by Express; **not used for API auth** | `setAuthCookie` on login; middleware ignores cookie for JWT |
| 401 unauthenticated | Handled | `auth-provider.tsx` clears session; `logout` swallows 401 |
| 403 forbidden | Handled | `errors.ts` `throwIfResNotOk` → `ApiError` 403 message |
| Logout | Handled | `POST /api/auth/logout` + `clearSession()` |
| Protected routes | Client gate only | `AuthGate` → `/auth` if unauthenticated; **no** `middleware.ts` on Next |
| Audit logs route access | Client + backend | `route-access.ts` `AUDIT_LOG_VIEWER_ROLES`; Express `requireRole(admin, super_admin, super_hod)` |
| `x-acting-role` | Sent by Next client if `userRole` in sessionStorage | **Not** read by production `authMiddleware`; JWT `activeRoleId` is authority (header only under `MOCK_AUTH` in `routes.ts`) |

### 401 vs 403 (unauthenticated vs wrong role)

- **401 without token:** Observed on `/api/auth/me`, `/api/notice-board`, `/api/audit-logs` (see Task 1).
- **403 with valid token but wrong role:** **Not observed live** (no test credentials). Expected from Express `requireRole` → `{ error: "Insufficient permissions" }` per `auth.middleware.ts`. Client tests cover 403 parsing in `errors.test.ts`.

### Browser E2E

| Item | Status |
|------|--------|
| Playwright/Cypress in `frontend-next/package.json` | **Not installed** (optional peer reference in lockfile only) |
| Test account | **Not available** in repo or this session |
| E2E login / reload / logout | **Not executed** — cannot claim pass |

**Smallest E2E setup (if Habib approves later):**

```bash
cd frontend-next
npm install -D @playwright/test
npx playwright install chromium
# Add specs under e2e/; credentials via env (e.g. E2E_EMAIL / E2E_PASSWORD) — never commit
```

Manual checklist (operations-prerequisites.md): sign in at `/auth`, confirm network `GET /api/auth/me` 200, open `/notice-board` and `/admin/audit-logs` with an audit-eligible role.

---

## Task 3 — Role switching and impersonation

### Existing backend contract (unchanged)

| Endpoint | Behavior |
|----------|----------|
| `POST /api/auth/set-active-role` | Authenticated user; `{ roleId }` must be in user’s `roles`; returns **new JWT** with updated `activeRoleId` (`auth.routes.ts`) |
| `POST /api/admin/impersonate` | Admin-only; `{ roleKey }` → impersonation JWT with `impersonatorId` (`rbac-routes.ts`) |
| `POST /api/admin/impersonate/stop` | Ends impersonation session (logging + client discards token) |
| `POST /api/users/:id/impersonate` | Alternate admin “login as user” (`users-routes.ts`) |
| `GET /api/auth/me` | Returns `isImpersonating` when `impersonatorId` on JWT |

### Legacy frontend (`frontend/`)

- `top-bar.tsx`: non-admin → `POST /api/auth/set-active-role`; admin role picker → `POST /api/admin/impersonate`; updates token + sessionStorage (including `userRole` for `x-acting-role`).
- Sidebar shows impersonation state via JWT/`/me`.

### Next.js (`frontend-next/`)

- **No UI** for `set-active-role` or impersonation.
- Types allow `isImpersonating` on `AuthMeResponse` but UI does not surface it.
- `getAuthHeaders()` still sends `x-acting-role` if `userRole` is set (same as legacy storage keys after login).

### Required for first module migration?

| Pilot | Role switch needed? | Impersonation needed? |
|-------|---------------------|------------------------|
| `/notice-board` (read-only) | **No** for single-role users | **No** |
| `/admin/audit-logs` (read-only) | **No** if user already has viewer role in JWT | **No** |
| Multi-role users switching hats without re-login | **Yes** — gap vs legacy | N/A |
| Admin testing as another role | N/A | **Yes** — gap vs legacy |

**Action:** Record gap only; **do not** implement impersonation or role-switch UI in Phase 4.1. Revisit when a migrated module explicitly requires multi-role or admin impersonation parity.

---

## Task 4 — Regression checks

Run from repository root unless noted. **2026-10-23** on `fix/upgrade_frontend_habib`.

| Check | Command | Result |
|-------|---------|--------|
| Route matrix generator | `node frontend-next/scripts/build-route-matrix.mjs` | **Pass** — wrote `route-matrix.json`, `route-matrix.csv`, `migration-routes.json` |
| Matrix ↔ migration consistency | `route-matrix.json` routes: **207**; `migration-routes.json` routes: **207**; same `generatedAt` | **Pass** |
| Legacy route-access tests | `cd frontend && npm run test:route-access` | **Pass** — 10/10 |
| Next unit + route-access tests | `cd frontend-next && npm run test` | **Pass** — 31 tests total |
| Typecheck | `cd frontend-next && npm run typecheck` | **Pass** |
| Lint | `cd frontend-next && npm run lint` | **Pass** |
| Production build | `cd frontend-next && npm run build` | **Pass** (~95s) |
| Standalone artifact | `test -f frontend-next/.next/standalone/server.js` | **Pass** |
| Rewrite smoke (dev) | Task 1 table | **Pass** |
| Rewrite smoke (standalone) | Task 1D | **Pass** |
| Rewrite smoke (script) | `npm run test:smoke-api` | **Pass** (Express direct; complements Next probes) |

### Failures separated

| Failure | Type | Notes |
|---------|------|-------|
| Backend `npm run dev` before `npm install` | **Environment** | Missing `@anthropic-ai/sdk` |
| Browser E2E auth | **Blocked** | No framework + no credentials |
| Staging Node/Nginx/cookie cross-origin | **Out of scope** | See `operations-prerequisites.md` |

**Note:** Route matrix regeneration updated tracked artifacts under `frontend-next/docs/route-matrix/` and `migration-routes.json` in the working tree. Per Phase 4.1 instructions, changes were **not committed**.

---

## P0 / P1 blockers

| Priority | Blocker | Owner |
|----------|---------|-------|
| **P0** | Browser-verified login, session reload, logout, and protected navigation | Habib (+ credentials via secure channel) |
| **P0** | No Next `middleware.ts` / server route guard — reliance on client `AuthGate` only | Foundation |
| **P1** | Role switch UI + token refresh (`set-active-role`) for multi-role users | Defer until required by module |
| **P1** | Admin impersonation parity with legacy top-bar | Defer |
| **P1** | Staging rehearsal: standalone Next + Nginx + cookie/TLS | Ops (not in repo) |
| **P1** | `migration-tracker` still marks `/notice-board` and `/admin/audit-logs` as `legacy` despite Next pages existing | Tracker hygiene |

---

## Recommendation

1. **Do not approve** migrating **another** business module yet.
2. **Do** treat **rewrite + build + policy tests** as **ready** for continued foundation hardening on `frontend-next/`.
3. **Next Habib steps:** (a) run manual or Playwright auth smoke with approved test user; (b) update migration status for existing pilots after sign-off; (c) only then consider **one** additional module — still **not** assigned to Talha in this plan.

---

## References

- `frontend-next/next.config.ts`, `.env.example`, `scripts/smoke-api.mjs`
- `frontend-next/docs/PHASE4_FOUNDATION_AUDIT.md`
- `frontend-next/docs/operations-prerequisites.md`
- `backend/src/server/routes/auth.routes.ts`, `middleware/auth.middleware.ts`, `routes/audit-log-routes.ts`, `routes/notice-routes.ts`, `routes/rbac-routes.ts`
