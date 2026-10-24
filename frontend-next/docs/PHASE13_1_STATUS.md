# Phase 13.1 — Training acceptance & `/dashboard/*` regression

**Project:** DRM WebExcels  
**Branch:** `fix/upgrade_frontend_habib`  
**Owner:** Habib  
**Status:** Acceptance complete — **recommend ready for next module** after Habib’s authenticated browser sign-off

## 1. Canonical routes and redirects

### App Router (canonical pages)

| Canonical URL | Page module | Legacy duplicate route removed |
|---------------|-------------|--------------------------------|
| `/dashboard` | `dashboard/page.tsx` | — |
| `/dashboard/training` | `TrainingView` | — |
| `/dashboard/notice-board` | `NoticeBoardPilot` | yes |
| `/dashboard/policies` | `PoliciesView` | yes |
| `/dashboard/audit-logs` | `AuditLogsView` | yes |
| `/dashboard/allowed-ip/drm-ip-list` | `DrmIpListView` | yes |

### Authenticated root

| Path | Behavior | Verified |
|------|----------|----------|
| `/` | Server `redirect()` → `/dashboard` (`(app)/page.tsx`) | Build emits static `/`; client/session gate unchanged |
| `/dashboard` | Dashboard landing (links to migrated modules) | **200** on running `:3001` standalone (no redirect loop) |

### Legacy → dashboard redirects (`legacy-redirects.ts` → `next.config.ts`)

HTTP checks against **running** standalone on `http://127.0.0.1:3001` (pre-rebuild process; rules unchanged in config):

| Legacy request | Response | `Location` |
|----------------|----------|------------|
| `/training` | **307** | `/dashboard/training` |
| `/training?foo=bar` | **307** | `/dashboard/training?foo=bar` (query preserved) |
| `/notice-board` | **307** | `/dashboard/notice-board` |
| `/policies` | **307** | `/dashboard/policies` |
| `/admin/audit-logs` | **307** | `/dashboard/audit-logs` |
| `/allowed-ip/drm-ip-list` | **307** | `/dashboard/allowed-ip/drm-ip-list` |

Unit tests: `legacy-redirects.test.ts` — destinations ∈ `NEXT_MIGRATED_DASHBOARD_PATHS`, no source/destination loops.

### Unauthenticated / login flow (code review)

| Step | Implementation |
|------|----------------|
| Protected URL without session | `AuthGate` → `router.replace("/auth")` (`PUBLIC_PATHS` = `/auth` only) |
| After login | `login-form.tsx` → `getDefaultDashboardPath(activeRoleId)` (e.g. admin → `/dashboard`; role-specific legacy dashboards unchanged) |
| Already authenticated on `/auth` | Redirect to `/` → `/dashboard` |

Authenticated browser walkthrough **not run** in agent env (no credentials).

## 2. Route authorization mapping

`AuthGate` calls `isRouteAccessAllowed(pathname, …)` which uses `toLegacyGuardPath(pathname)` before `ROUTE_PERMISSIONS` prefix checks.

| Canonical path | `toLegacyGuardPath()` | Auth key / notes |
|----------------|----------------------|------------------|
| `/dashboard` | `/` | No restrictive prefix |
| `/dashboard/notice-board` | `/notice-board` | Existing list |
| `/dashboard/policies` | `/policies` | Existing list |
| `/dashboard/training` | `/training` | Existing staff list |
| `/dashboard/audit-logs` | `/admin/audit-logs` | Audit viewer roles |
| `/dashboard/allowed-ip/drm-ip-list` | **`/allowed-ip/drm-ip-list`** | **`ROUTE_PERMISSIONS["/allowed-ip/drm-ip-list"]`** (ADMIN_ONLY) — **not** the dashboard string |

Tests added/updated:

- `dashboard-auth-mapping.test.ts` — full canonical ↔ legacy matrix + query strip + DRM IP deny/allow
- `guard-path.test.ts`, `route-access.test.ts`, `navigation-role-parity.test.ts` — unchanged behavior, dashboard paths

No permissions broadened.

## 3. Training functionality

| Requirement | Result |
|-------------|--------|
| API | `GET /api/training/tree` via `useApiResource` + `apiFetch` (rewrite to Express) |
| Response shape | `{ categories: [{ id, title, status, subcategories: [{ id, title, status, videoCount, … }] }] }` — matches backend `training-routes.ts` `/tree` |
| Loading / empty / error | `PageLoading`, `PageEmpty`, `PageError` + retry |
| Forbidden (API 403) | **Fixed in 13.1** — `PageForbidden` (was missing) |
| Write actions | None in UI (read-only scope) |
| Video / `/training/:category` | Not migrated (by design) |
| Menu + page guard | `permKey: Training` + `/training` legacy guard; parity tests pass for `sales_executive` |

Backend probe without JWT: `GET /api/training/tree` → **401** `No token provided` (expected; JWT required via global `/api` middleware).

**Browser:** Training tree render, expand/collapse, light/dark, mobile — **blocked** (no `E2E_EMAIL` / staff login in agent env).

## 4. Shared navigation

- Sidebar hrefs in `navigation-config.ts` use **`/dashboard/*`** for Training, Notice, Policies, Audit Logs, DRM IP List.
- `migrated-routes.ts` / NEXT badges align with canonical paths.
- No removed duplicate App Router pages required for rendering.
- Legacy Vite app and pages **unchanged**.

Cross-link navigation in browser **not executed** (authenticated blocked).

## 5. Verification commands and outcomes

```bash
cd frontend-next
npm run test      # 78 tests — pass
npm run typecheck # pass
npm run lint      # pass (0 errors; existing warnings)
npm run build     # pass — all dashboard routes static
```

| Suite | Count |
|-------|------:|
| test:unit | 23 |
| test:navigation (+ legacy-redirects) | 13 |
| test:dashboard-auth | 8 |
| test:route-access | 27 |
| test:route-access-policy | 7 |
| **Total** | **78** |

After `npm run build`, **restart** standalone on `:3001` so new chunks match HTML (see `PHASE13_STATUS.md` restart note).

## 6. Regressions fixed in 13.1

1. **Training API 403** — no UI feedback → added `PageForbidden` in `training-view.tsx`.
2. **Redirect drift** — redirect list centralized in `legacy-redirects.ts` (single source for `next.config.ts` + tests).

No other confirmed regressions from automated checks.

## 7. Remaining browser acceptance blockers

- Logged-in Training catalog with real JWT and data
- Sidebar navigation between migrated `/dashboard/*` routes
- Restricted role (e.g. user denied `/dashboard/notice-board` but allowed Training) if creds available
- Light/dark and responsive layout on Training

## 8. Recommendation

| Question | Answer |
|----------|--------|
| **Redirect / auth mapping / tests / build** | **Ready** — no open automated failures |
| **Next business module** | **Proceed after Habib** confirms authenticated Training + one cross-nav path in browser (or explicitly waives browser sign-off) |

## 9. Boundaries

No DB, backend contract, legacy Vite, shell redesign, deploy, commit, push, or merge in this phase.
