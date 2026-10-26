# Phase 4 — Foundation hardening audit (Habib)

**Date:** 2026-10-23 (audit run on repository)  
**Branch:** `fix/upgrade_frontend_habib`  
**Scope:** Stabilize `frontend-next/` before further business module ports. **No Talha assignments.** **No production cutover.**

---

## Readiness tiers (do not conflate)

| Tier | Status | Meaning |
|------|--------|---------|
| **Local build** | **Ready** | `npm run build` + standalone artifact succeeds |
| **Auth foundation** | **Partial** | Login/me/logout wired; no browser E2E; role switch/impersonation not ported |
| **Module migration** | **Not ready** | Only notice-board (read-only) + audit-logs; no shadcn/RQ; no server route guards |
| **Deployment** | **Not ready** | Staging Node/Nginx/cookie/rollback not verified in repo |

**Foundation is not approved for broad module migration until Habib signs off after reviewing this document.**

---

## Gap matrix (evidence-based)

| Area | Item | Status | Evidence |
|------|------|--------|----------|
| **Auth** | Login → token in sessionStorage | Verified complete | `login-form.tsx`, `auth.routes.ts` POST `/login` |
| | `/api/auth/me` bootstrap | Verified complete | `auth-provider.tsx` `refresh()` |
| | 401 → clear session | Verified complete | `auth-provider.tsx`; Phase 4: expired message only if token existed |
| | Logout | Verified complete | `signOut` → POST `/logout` + `clearSession` |
| | False “session expired” on first visit | **Fixed Phase 4** | Removed `markSessionExpired` from `AuthGate` redirect |
| | Login failure UX | Partial | `ApiError` message on form; not E2E tested |
| | Page reload session | Partial | Code path exists; **not browser-verified** (no credentials) |
| | Role switch (`POST /api/auth/set-active-role`) | Missing in Next | Backend `auth.routes.ts` ~L250; legacy uses it; Next UI not wired |
| | Impersonation (`isImpersonating` on `/me`) | Missing in Next | Backend returns field; Next ignores |
| | Server-side route enforcement | Missing | No `middleware.ts` / `proxy.ts` |
| **API client** | Single browser client | Verified complete | `browser-client.ts` `apiFetch` |
| | Bearer + `x-acting-role` | Verified complete | `session.ts` `getAuthHeaders` |
| | `credentials: "include"` | Verified complete | Matches legacy; cookie fallback disabled server-side in Express `getAuthToken` |
| | 401/403 errors | Verified complete | `errors.ts` + tests |
| | Server client | Partial | `server-client.ts` exists; minimal use in pages |
| | Env / secrets | Verified complete | `env.ts` zod; `BACKEND_URL` server-only default localhost |
| | Rewrites | Partial | `next.config.ts`; smoke hits Express directly — **Next :3000 rewrite not re-run in this audit** |
| **Route policy** | Full prefix map | Verified complete | `route-access.ts` synced from legacy |
| | Audit logs prefix | Verified complete | Tests + backend `requireRole` |
| | Policy tests | Verified complete | `npm run test:route-access*` |
| **App shell** | Header + sidebar nav | Partial | Minimal links; not legacy parity |
| | Role-aware nav | Partial | `isRouteAccessAllowed` / `canShowAuditLogsNav` |
| | Responsive | Partial | Basic Tailwind; not audited on devices |
| | shadcn/Radix | Missing | `components/ui/README.md` — port deferred |
| **Shared UI** | Table/filter/pagination patterns | Partial | Duplicated in modules; `page-states.tsx` added Phase 4 |
| | Toasts / dialogs | Missing | Legacy uses `@/hooks/use-toast`; not in Next |
| | React Query | Missing | Legacy pattern; Next uses `useEffect` fetch |
| **Modules** | Notice board | Partial | Read-only pilot |
| | Audit logs | Partial | Read-only; filters/pagination |
| | `/approvals` | Blocked | API stub — excluded |
| | `/sales/active-clients` | Blocked | Sidebar orphan — excluded |
| **Testing** | Policy unit tests | Verified complete | node:test + tsx |
| | API error unit tests | Verified complete | Phase 4 `errors.test.ts` |
| | API smoke (no auth) | Verified complete | `test:smoke-api` |
| | Browser E2E | Blocked | No Playwright/Cypress; **no test credentials in repo** |
| | Legacy route-access tests | Verified complete | `frontend/` `test:route-access` |
| **Deploy** | Standalone build | Verified complete | `.next/standalone/server.js` |
| | Staging Node/Nginx | Blocked | `operations-prerequisites.md` — no repo evidence |
| **Docs** | PHASE2/3 status | Partial | Some FOUNDATION_STATUS lines stale pre–Phase 2 |

---

## Backend contract reference (not invented)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | `{ email, password }` → `{ token, user }` |
| `GET /api/auth/me` | JWT → user + `activeRoleId`, `roles`, `isImpersonating?` |
| `POST /api/auth/logout` | Clear cookie |
| `POST /api/auth/set-active-role` | `{ roleId }` → new token (not in Next UI) |

Authorization for business data remains on Express handlers (e.g. audit logs `requireRole`).

---

## Phase 4 code changes (hardening only)

| File | Reason |
|------|--------|
| `auth-provider.tsx` | Set expired message on 401 only when token existed |
| `auth-gate.tsx` | Stop false expired message on first unauthenticated visit |
| `errors.test.ts`, `constants.test.ts`, `session.test.ts` | Foundation unit tests without credentials |
| `page-states.tsx` | Shared loading/error/empty/forbidden primitives |
| `package.json` | `test:unit` in `npm test` |
| This document | Audit deliverable |

---

## Validation commands (run during audit)

See **§ Executed results** below — fill from actual run output in terminal.

---

## Prioritized foundation gaps (after Phase 4)

1. **P0 — Blocker:** Browser E2E login + protected navigation (needs test user or staging secret store — not in repo).
2. **P1:** Verify Next rewrite `localhost:3000/api/*` → Express in CI or documented manual checklist.
3. **P1:** Port role switch UI + token refresh (`set-active-role`) if multi-role users are required in Next pilot.
4. **P2:** React Query (or equivalent) for consistent loading/error/retry across modules.
5. **P2:** shadcn subset for tables/forms (reduce duplication vs legacy).
6. **P3:** Server-side route guard strategy (middleware) — product/security decision.
7. **Deploy:** Staging rehearsal per `operations-prerequisites.md`.

---

## Recommended next step for Habib

1. Review this audit and **explicitly approve or reject** foundation readiness for module migration.
2. If approving: pick **one** next module (e.g. complete Notice Board reads + documented writes, or Policies read-only) — still **Habib-only** until you open Talha coordination.
3. If not approving: address **P0/P1** items above before any new routes.

**Do not assign Talha or port additional modules until Habib confirms foundation readiness.**

---

## Executed results (audit run)

| Command | Result |
|---------|--------|
| `node frontend-next/scripts/build-route-matrix.mjs` | OK — **207** union routes; JSON/CSV/migration-routes regenerated |
| `cd frontend && npm run test:route-access` | **10 pass**, 0 fail |
| `cd frontend-next && npm run test:unit` | **10 pass**, 0 fail (errors, constants, session) |
| `npm run test:route-access` | **14 pass**, 0 fail |
| `npm run test:route-access-policy` | **7 pass**, 0 fail |
| `npm run test` (combined) | **31 pass** total (10+14+7), 0 fail |
| `npm run test:smoke-api` | **4 OK** (health 200; me/notice/audit 401) |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass — routes include `/admin/audit-logs` |
| Standalone | `.next/standalone/server.js` **present** |
| Browser E2E login | **Not executed** — no test credentials; no E2E framework |
| Next :3000 rewrite smoke | **Not re-executed** this audit (Express direct smoke only) |

**Environmental note:** Smoke API assumes backend at `BACKEND_URL` default `http://localhost:5001`; failure if backend down is environmental, not necessarily code failure.
