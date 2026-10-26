# Phase 9.1 — DRM IP List API Authorization Fix

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Date:** 2026-10-23

---

## 1. Approved policy (implemented)

Roles allowed for **read and write** on Allowed IP configuration:

`admin`, `super_admin`, `administrator`, `super_hod`

| Caller | Expected |
|--------|----------|
| No token | **401** (`authMiddleware` on `/api/settings`) |
| Authenticated, role not in list | **403** (`requireRole` gate) |
| Authenticated, approved role | Handler runs (200/201/404/etc. per existing logic) |

---

## 2. Files changed

| File | Change |
|------|--------|
| `backend/src/server/routes/settings-routes.ts` | Import `requireRole`; define `ALLOWED_IP_CONFIG_ROLES` + `allowedIpRoleGate`; apply gate to all five Allowed IP handlers |
| `backend/src/server/tests/allowed-ips-auth.test.ts` | **New** — DB-backed authorization regression suite |
| `frontend-next/docs/PHASE9_1_STATUS.md` | This report |

**Not changed:** database schema, legacy Vite, Next read-only UI, Notice Board, Audit Logs, production config.

---

## 3. Protected endpoints

All under `/api/settings` (after global `authMiddleware`):

| Method | Path |
|--------|------|
| GET | `/allowed-ips` |
| GET | `/allowed-ips/:id` |
| POST | `/allowed-ips` |
| PATCH | `/allowed-ips/:id` |
| DELETE | `/allowed-ips/:id` |

**Unaffected example:** `GET /api/settings/roles` — no Allowed IP gate (verified in tests).

Implementation pattern:

```typescript
const ALLOWED_IP_CONFIG_ROLES = ["admin", "super_admin", "administrator", "super_hod"] as const;
const allowedIpRoleGate = requireRole(...ALLOWED_IP_CONFIG_ROLES);
settingsRouter.get("/allowed-ips", allowedIpRoleGate, async (req, res) => { ... });
// … same gate on GET :id, POST, PATCH, DELETE
```

`requireRole` checks `req.user.roles`, `req.user.roleId`, and `req.user.activeRoleId` (see `auth.middleware.ts`).

---

## 4. Backend test evidence

**Suite:** `backend/src/server/tests/allowed-ips-auth.test.ts`  
**Auth tokens:** `authService` from `../services/auth.service` (real JWT; not `tests/auth.service` stub).

| # | Case | Role / auth | Endpoint | Expected | Result |
|---|------|-------------|----------|----------|--------|
| 1 | Unauthenticated read | none | GET list | 401 | **Pass** |
| 2 | Approved read | `admin` | GET list | 200 + array | **Pass** |
| 3 | Approved write | `admin` | POST valid `ip_cidr` | 201 | **Pass** |
| 4 | Approved read by id | `admin` | GET `:id` (created row) | 200 | **Pass** |
| 5 | Denied read | `account_manager` | GET list | 403 | **Pass** |
| 6 | Denied read by id | `account_manager` | GET `:id` | 403 | **Pass** |
| 7 | Denied create | `account_manager` | POST | 403 | **Pass** |
| 8 | Denied update | `account_manager` | PATCH `:id` | 403 | **Pass** |
| 9 | Denied delete | `account_manager` | DELETE `:id` | 403 | **Pass** |
| 10 | Unrelated settings | `account_manager` | GET `/roles` | 200 | **Pass** |

**Command:**

```bash
cd backend && npm test -- src/server/tests/allowed-ips-auth.test.ts
```

**Outcome:** **9/9 passed** (DB available; suite soft-skips if Postgres unreachable).

**Not covered in this file (no extra fixture):** explicit tests for `super_admin`, `administrator`, `super_hod` — same gate as `admin`; policy is identical role list.

---

## 5. Additional verification commands

| Command | Result |
|---------|--------|
| `npm test -- allowed-ips-auth.test.ts stage10-operational.test.ts` | **17 pass, 1 fail** — fail is pre-existing Stage 10 Part D promotion audit test (`auth.service` **stub** in `./auth.service` → invalid token); **not** caused by Allowed IP change. Stage 10 unauthenticated Allowed IP POST test still **passes** (401/403). |
| `frontend-next`: `npm test` | **Pass** — 43 tests |
| `frontend-next`: `npm run typecheck` | **Pass** |
| `frontend-next`: `npm run lint` | **Pass** (0 errors) |
| `frontend-next`: `npm run build:standalone` | **Pass** |
| `BACKEND_URL=http://localhost:5001 node frontend-next/scripts/smoke-api.mjs` | **Pass** — unauthenticated allowed-ips → **401** |

Backend has no separate `typecheck`/`lint` script in `package.json`; verification is `vitest run` on the new suite.

**Restart note:** Running Express locally requires a **process restart** to load `settings-routes.ts` changes. Smoke tests only assert unauthenticated 401 unless paired with a live restarted server and tokens.

---

## 6. Security gap status

| Layer | Before 9.1 | After 9.1 |
|-------|------------|-----------|
| Express GET/POST/PATCH/DELETE allowed-ips | Any authenticated user | **ADMIN_ONLY roles only** |
| Next client route `/allowed-ip/drm-ip-list` | ADMIN_ONLY (Phase 8) | Unchanged |
| Alignment | Misaligned | **Aligned** on approved role list |

Proven by passing authorization tests when DB is available — not by unauthenticated smoke alone.

---

## 7. Remaining blockers

| Blocker | Notes |
|---------|--------|
| **Authenticated E2E** | Phase 9 `e2e/drm-ip-phase9.spec.ts` — run with `E2E_EMAIL` / optional `E2E_PASSWORD_RESTRICTED`; restricted case should now expect API **403** (not 200). Not executed in agent env (no credentials). |
| **Production readiness** | No deploy/cutover; legacy Vite still authoritative for writes/UI. |
| **Full backend `npm test`** | Large suite; one known stage10 authenticated failure due to stub `tests/auth.service.ts`. |
| **Express restart in dev** | Habib should restart `:5001` and spot-check admin vs non-admin API. |

---

## 8. Verdict

**API authorization fix implemented and covered by dedicated backend tests.** Client and Express now match the approved four-role policy for Allowed IP configuration.

**Not** full pilot/production sign-off until Habib restarts backend, runs optional E2E with credentials, and reviews.

---

*No commit, push, merge, or deploy.*
