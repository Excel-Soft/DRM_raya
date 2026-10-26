# Phase 7 — Pilot Acceptance and Migration Readiness

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Scope:** Validation and planning only (no module implementation) · **Date:** 2026-10-23  
**Verified against:** Live repo inspection + commands run in this session (not prior phase summaries alone)

---

## 1. Current state verification

### Next.js routes that actually exist (5 app pages + infrastructure)

| URL | Component / module | Notes |
|-----|-------------------|--------|
| `/auth` | `src/app/(public)/auth/page.tsx` | Public layout; not under `(app)/AuthGate` |
| `/` | `src/app/(app)/page.tsx` | Foundation home with pilot links |
| `/notice-board` | `NoticeBoardPilot` | Read-only pilot |
| `/admin/audit-logs` | `AuditLogsView` | Read-only pilot |
| `/api-health` | `ApiHealthPanel` | Foundation diagnostic; **not** behind `AuthGate` (documented gap in unit tests) |

**207-route inventory:** `migration-routes.json` lists hypothetical `nextPath` for every union route; **202 routes have no implemented Next page** (only the five above plus error/loading/not-found).

### Auth stack

| Layer | Location | Behavior (unchanged) |
|-------|----------|----------------------|
| Session bootstrap | `AuthProvider` → `fetchAuthMe()` / Express `GET /api/auth/me` | Bearer + cookies via `apiFetch` |
| Client gate | `AuthGate` | Hides protected UI until me resolves; redirects unauthenticated → `/auth`; forbidden prefix → default dashboard or `ForbiddenShell` |
| Route policy | `src/lib/auth/route-access.ts` | Prefix map aligned with legacy `frontend/src/lib/route-access.ts` (spot-checked audit + notice-board) |
| Audit policy | `route-access-policy.ts` | Viewers: `admin`, `super_admin`, `super_hod` |
| Express audit | `backend/src/server/routes/audit-log-routes.ts` | `router.get("/", requireRole(...ROLES), …)` |
| Express notices | `backend/src/server/routes/notice-routes.ts` | `router.get("/", authMiddleware, …)` (any authenticated user) |

### Shared UI (Phase 6)

16 components under `src/components/ui/` (Button, Input, DataTable, PaginationBar, page states, etc.) plus `useApiResource` in `src/lib/hooks/use-api-resource.ts`. Notice Board uses the hook; Audit Logs uses direct `apiFetch` + local state (filters/page).

### Playwright

- **Config:** `playwright.config.ts` — default `PLAYWRIGHT_BASE_URL` = `http://localhost:3001` (standalone).
- **Specs:** `e2e/auth.spec.ts`, `e2e/auth-phase5.spec.ts`, helpers in `e2e/helpers/auth.ts`.
- **Credentials:** `E2E_EMAIL`, `E2E_PASSWORD`; optional `E2E_EMAIL_RESTRICTED`, `E2E_PASSWORD_RESTRICTED`. **Not set in the agent test run** (no credentials in repo or this document).

---

## 2. Regression validation (actual results)

Commands from `frontend-next/` unless noted.

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 13 unit + 14 Next route-access + 7 policy = **34** tests |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** — 0 errors; 1 pre-existing warning (`postcss.config.mjs`) |
| `npm run build` | **Pass** — static routes: `/`, `/auth`, `/notice-board`, `/admin/audit-logs`, `/api-health` |
| `npm run build:standalone` | **Pass** — copies `.next/static` → `.next/standalone/.next/static`, `public` → `.next/standalone/public` |
| `node frontend-next/scripts/build-route-matrix.mjs` (repo root) | **Pass** — **207** routes; wrote JSON/CSV/`migration-routes.json` (`generatedAt` updated this session) |
| Legacy `frontend` route-access | **Pass** — 10 tests in `src/lib/route-access.test.ts` |
| `BACKEND_URL=http://localhost:5001 node scripts/smoke-api.mjs` | **Pass** — health **200**; `/api/auth/me`, `/api/notice-board`, `/api/audit-logs` **401** without auth |
| `npm run test:e2e` | **5 passed, 9 skipped, 0 failed** (no `E2E_*` in environment) |

### Standalone CSS and static assets

| Check | Result |
|-------|--------|
| CSS file on disk after `build:standalone` | `3ea37748e560020f.css` (~36,481 bytes) under `.next/standalone/.next/static/css/` |
| `public/` in standalone | Present (`next.svg`, `globe.svg`, etc.) |
| `GET /auth` on `:3001` | **200** |
| `GET /_next/static/css/<hash>.css` | **200** after **restarting** standalone server post-build |

**Operational finding:** A **stale** `node .next/standalone/server.js` on `:3001` served HTML referencing an **old** CSS hash (`ef47b39f9d2429be.css` → **HTTP 500**), which caused one Playwright test (login card border-radius) to fail until the process was restarted. This matches Phase 4.3 root cause class (build/static mismatch), not a new code defect. **Procedure:** always `npm run build:standalone` then restart standalone before E2E or Habib review.

### API rewrite (Next → Express)

With Express on `:5001` and standalone Next on `:3001`:

- `GET http://localhost:3001/api/notice-board` → **401** (unauthenticated), confirming rewrite reaches Express.

**Authenticated E2E:** **Not executed** in this session (no approved credentials in the test environment). Do not treat pilots as acceptance-tested end-to-end until Phase 5 tests 1–7 run with credentials supplied outside the repo.

---

## 3. Pilot acceptance matrix

Read-only scope preserved for both pilots (no POST/PATCH/DELETE added in Next).

### Notice Board

| Dimension | Evidence |
|-----------|----------|
| **Route / UI** | `/notice-board` → `notice-board-pilot.tsx` |
| **API** | `GET /api/notice-board` — `notice-routes.ts` (`authMiddleware`) |
| **Client roles** | Prefix `/notice-board` in `route-access.ts` (11 roles; registry subset is narrower — see discrepancies) |
| **Backend auth** | Any authenticated user |
| **Loading** | `PageLoading` / hook `pending` |
| **Empty** | `DataTable` → `PageEmpty` |
| **Error** | `PageError` + retry (`refetch`) |
| **Forbidden** | `PageForbidden` on 403 (unlikely for this API; handled) |
| **Filters / pagination** | None (full list) |
| **Tests** | Unit route-access (account_manager allow, developer deny); E2E #4 **skipped** without credentials; unauthenticated redirect **passed** |
| **Gaps vs legacy** | Legacy `frontend/src/pages/notice-board.tsx` (~679 lines) includes CRUD, assign, search, dialogs — **not ported**. Next is **read-only list/table only**. |

### Audit Logs

| Dimension | Evidence |
|-----------|----------|
| **Route / UI** | `/admin/audit-logs` → `audit-logs-view.tsx` |
| **API** | `GET /api/audit-logs?page&pageSize&filters…` — `audit-log-routes.ts` (`requireRole` admin/super_admin/super_hod) |
| **Client roles** | Stricter prefix `/admin/audit-logs` (viewers only); `/admin` prefix wider — dual-prefix logic tested in unit tests |
| **Backend auth** | Role gate on Express (authoritative) |
| **Loading / empty / error** | `DataTable` delegates to page states; retry on error |
| **Forbidden** | `PageForbidden` on `ApiError` 403; `AuthGate` may redirect non-viewers before paint |
| **Filters** | actor, module, entityType, entityId, action, dateFrom, dateTo — apply resets page to 1 |
| **Pagination** | Server-side `pageSize=50`, Express `total`; `PaginationBar` |
| **Tests** | 10+ unit tests on audit route access; E2E #5–6 **skipped** without credentials |
| **Gaps vs legacy** | Legacy `frontend/src/pages/admin/audit-logs.tsx` uses React Query; behavior parity intended for read path — **not browser-verified with real admin/non-admin sessions in this session** |

---

## 4. Migration tracker reconciliation

### Inventory facts

- **`migration-routes.json`:** `routeCount` = **207**; every row `migrationStatus` = **`legacy`** (generator default — **does not reflect Next pilot progress**).
- **Implemented Next pages:** **5** (see §1). Matrix `nextPath` for `/auth` is **`src/app/(app)/auth/page.tsx`** but actual file is **`src/app/(public)/auth/page.tsx`** — tracker inaccuracy.
- **Exclusions preserved** (`docs/route-matrix/known-exceptions.json`):
  - `/approvals` — `pilotExcluded`, known-broken-legacy (no unified API).
  - `/sales/active-clients` — sidebar orphan, no App route; do not invent page.

### Maturity model (Habib review — not auto-written to JSON)

| Route | Inventory | In progress | UI ported | API integrated | Auth verified | Acceptance tested | Fully accepted |
|-------|:-----------:|:-----------:|:---------:|:--------------:|:-------------:|:-----------------:|:--------------:|
| `/auth` | ✓ | ✓ | ✓ | ✓ | ✓ (unit + partial E2E) | Partial (no cred E2E) | ✗ |
| `/` (foundation home) | ✓ | ✓ | Partial (links only) | N/A | ✓ | ✗ | ✗ |
| `/notice-board` | ✓ | ✓ | ✓ (read-only) | ✓ GET | ✓ (unit) | **Blocked** (auth E2E) | ✗ |
| `/admin/audit-logs` | ✓ | ✓ | ✓ (read-only) | ✓ GET | ✓ (unit + policy) | **Blocked** (auth E2E + role matrix) | ✗ |
| `/api-health` | ✓ | ✓ | ✓ | ✓ health | Partial (public page) | ✗ | ✗ |
| Remaining **202** routes | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Tracker discrepancies to fix in a future tracker update (not done in Phase 7)

1. All routes still marked `legacy` despite pilot `nextPath` files existing for two business modules.
2. `/auth` `nextPath` wrong group `(app)` vs `(public)`.
3. Notice Board **registry** `allowedRoles` (4 roles) vs **route-access** (11 roles) — Next follows `route-access.ts` (aligned with legacy Vite `route-access.ts`).
4. Regenerating route matrix updates `generatedAt` only unless legacy/App changes — avoid committing noise unless intentional.

---

## 5. Recommended next module (implementation **not** started)

**Recommendation: DRM IP List — `/allowed-ip/drm-ip-list`**

| Item | Detail |
|------|--------|
| **Why this module** | Single settings surface, ~366-line legacy page, clear REST API, fits Phase 6 `DataTable` + form/confirm patterns; admin-focused; excludes blocked routes (`/approvals`, `/sales/active-clients`). |
| **Legacy source** | `frontend/src/pages/allowed-ip-list.tsx` |
| **Registry** | `frontend/src/routes/route-registry.ts` — `AllowedIpList`, module Settings, `ADMIN_ONLY`, sidebar “DRM IP List” |
| **Express API** | `backend/src/server/routes/settings-routes.ts` — mounted at `/api/settings` with **`authMiddleware`** (global for settings router): `GET/POST /allowed-ips`, `GET/PATCH/DELETE /allowed-ips/:id` |
| **Permissions** | Legacy UI: admin-only via registry/sidebar. **Next gap:** no `/allowed-ip` prefix in `frontend-next/src/lib/auth/route-access.ts` yet — must add aligned prefix rules before migration. Backend relies on auth middleware only for these routes (same as legacy); confirm role expectations with Habib. |
| **Suggested UI scope (first slice)** | **Read-only list** (parity with pilot approach): columns IP/CIDR, label, active, timestamps; then phase 2 add create/edit/toggle/delete using `Field`, `ConfirmDialog`, `FormBanner` (no new toast library required). |
| **Reusable components** | `DataTable`, `PageHeader`, `Card`, `Badge`, `Button`, `Input`, `ConfirmDialog`, optional `useApiResource` for list |
| **Test plan** | Extend route-access unit tests for `/allowed-ip/drm-ip-list`; Playwright: unauthenticated redirect; with credentials: list loads, 401/403 if non-admin; CRUD tests when write slice approved; manual IP validation edge cases |
| **Risks** | IP/CIDR validation must match Express `isValidIpOrCidr`; mistaken role mapping could expose settings API to wrong roles (verify Express + client prefix together); write ops need audit awareness (ActivityLog on backend) |

**Alternative considered:** Notice Board **write** parity (POST/PATCH/DELETE on existing pilot) — larger scope (~679-line legacy), managerial `canManage` rules — better as a **second** tranche after one greenfield admin page proves form patterns.

---

## 6. Remaining blockers

| Blocker | Impact |
|---------|--------|
| **Authenticated E2E** | Phase 5 tests 1–7 skipped without env credentials — pilot “Acceptance tested” column incomplete |
| **Standalone restart discipline** | Stale `:3001` server → CSS 500 / flaky styling E2E |
| **Production cutover** | Legacy Vite remains authoritative; no staging sign-off in this phase |
| **Migration JSON accuracy** | All `legacy` status; wrong auth `nextPath`; pilots not reflected |
| **Tracker / Talha** | No work assigned to Talha per instruction |

---

## 7. Verdict

**Ready for module selection — blocked on authenticated pilot sign-off and deployment evidence.**

Foundation regressions (unit tests, typecheck, lint, build, standalone artifact copy, API smoke with Express up, unauthenticated E2E) **pass** when standalone is restarted after build. Business pilots are **UI/API integrated for read-only paths** with **authorization verified at unit/policy level**, but **not** fully acceptance-tested in browser with real roles until Habib runs Phase 5 E2E with approved credentials.

**Next step after Habib approval:** implement **`/allowed-ip/drm-ip-list`** read-only slice (or explicitly choose Notice Board write parity instead) — **no implementation in Phase 7**.

---

*No commit, push, merge, deploy, or Express/legacy modifications in Phase 7. Route matrix files may show updated `generatedAt` from the validation run — commit only if Habib wants that bundled.*
