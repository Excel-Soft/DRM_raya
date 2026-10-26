# Phase 13 — Business module migration + `/dashboard/*` URLs

**Project:** DRM WebExcels  
**Branch:** `fix/upgrade_frontend_habib`  
**Owner:** Habib  
**Status:** Ready for review (single module + routing slice)

## 1. Module selected: Training

| Item | Legacy | Next.js |
|------|--------|---------|
| **Route** | `/training` | `/dashboard/training` |
| **Page** | `frontend/src/pages/training-center.tsx` (`TrainingCenter`) | `src/app/(app)/dashboard/training/page.tsx` → `TrainingView` |
| **Sidebar** | Training → `/training` (`permKey: Training`) | Same label; href **`/dashboard/training`** |
| **API** | `GET /api/training/tree` | Same (via Next rewrite to Express) |
| **Registry roles** | `ALL_STAFF` (inherit broad staff list) | Guard via legacy prefix **`/training`** through `toLegacyGuardPath()` |

**Scope this phase:** Read-only catalog (categories + expandable subcategories). Video playback and `/training/:category` deep links remain on legacy Vite until a follow-up slice.

**Not chosen for migration in this phase:** Other unmigrated modules unchanged; legacy pages not deleted.

## 2. Legacy behavior traced

- **Data:** `TrainingTreeResponse` with `categories[]`, each with `subcategories[]` (id, title, status, optional thumbnail/date/counts).
- **Loading / empty / error:** React Query on legacy; Next uses `useApiResource` + `PageLoading` / `PageEmpty` / `PageError`.
- **Permissions:** Menu `Training` via `DEPT_NAME_TO_ROLES` + `hasMenuPermAccess`; page guard `ROUTE_PERMISSIONS["/training"]` aligned with legacy `route-access.ts` staff list (not `ALL_STAFF` string — same effective roles as pre-existing Next port).
- **Backend:** No Express or schema changes.

## 3. URL structure (user request)

After login, migrated app modules use a **`/dashboard/`** prefix (e.g. `http://localhost:3001/dashboard/notice-board`).

| Legacy URL (still valid via redirect) | Canonical Next URL |
|--------------------------------------|-------------------|
| `/notice-board` | `/dashboard/notice-board` |
| `/policies` | `/dashboard/policies` |
| `/training` | `/dashboard/training` |
| `/admin/audit-logs` | `/dashboard/audit-logs` |
| `/allowed-ip/drm-ip-list` | `/dashboard/allowed-ip/drm-ip-list` |
| `/` (authenticated app root) | Redirect → `/dashboard` |

**Guard mapping:** `src/lib/auth/guard-path.ts` — `toLegacyGuardPath()` maps `/dashboard/*` to legacy `ROUTE_PERMISSIONS` keys (audit logs → `/admin/audit-logs`).

**Login default:** `role-dashboards.ts` — `admin`, `super_hod`, `account_manager`, and unknown roles default to **`/dashboard`** (role-specific legacy dashboard paths unchanged where defined).

## 4. Implementation files

| Area | Files |
|------|--------|
| Training UI | `src/modules/training/training-view.tsx` |
| Routes | `src/app/(app)/dashboard/**` (training, notice-board, policies, audit-logs, allowed-ip) |
| Nav | `navigation-config.ts`, `navigation-visibility.ts`, `dashboard-routes.ts`, `migrated-routes.ts` |
| Auth | `guard-path.ts`, `route-access.ts` (DRM IP guard key **`/allowed-ip/drm-ip-list`** for legacy prefix match) |
| Redirects | `next.config.ts` — old paths → `/dashboard/…` |
| Removed duplicate pages | Old `(app)/notice-board`, `policies`, `admin/audit-logs`, `allowed-ip/...` (redirects preserve bookmarks) |

## 5. Navigation and access

- Migrated sidebar links point at **`/dashboard/…`** and keep **NEXT** migrated-path badges where applicable.
- Menu visibility: `hasMenuPermAccess` + `isRouteAccessAllowed` for notice, policies, training, allowed IP; audit uses `canShowAuditLogsNav`.
- **AuthGate** still enforces route access on the pathname shown in the browser (dashboard URLs).

## 6. Verification

| Check | Result |
|-------|--------|
| `npm run test` | **Pass** — 68 tests (unit 23, navigation 11, route-access 27, policy 7) |
| `npm run typecheck` | **Pass** (after clearing stale `.next` from removed routes) |
| `npm run lint` | **Pass** (0 errors; pre-existing warnings only) |
| `npm run build` | **Pass** — routes include `/dashboard/training` and other migrated paths |
| Authenticated browser (Training tree, themes, mobile) | **Not executed in agent env** — use admin/staff creds on `:3001` |
| Playwright `e2e/drm-ip-phase9.spec.ts` | Path updated to dashboard URL; **credential-gated** |

### Commands (Habib)

```bash
cd frontend-next
npm run test && npm run typecheck && npm run lint && npm run build
PORT=3001 BACKEND_URL=http://localhost:5001 npm run start:standalone
```

### After every feature implementation — restart both servers

Phase 13 changes (new routes, `next.config` redirects, standalone chunks) do **not** hot-reload reliably. Always:

1. **Backend (Express)** — stop anything on `:5001`, then:
   ```bash
   cd backend && npm run dev
   ```
2. **Next frontend** — after `npm run build` (runs `postbuild` → copies static into standalone):
   ```bash
   cd frontend-next
   PORT=3001 BACKEND_URL=http://127.0.0.1:5001 npm run start:standalone
   ```
3. **Browser** — hard refresh (Cmd+Shift+R). Stale HTML → chunk 404 / “Something went wrong”.

**Legacy Vite** (`frontend/`, e.g. `:5173`) is separate; restart with `npm run dev` there only if you are testing legacy pages.

## 7. Limitations / follow-ups

- Training **videos** and **category routes** (`/training/:category`) not migrated.
- Legacy Vite **`/training`** unchanged; Next redirects `/training` → `/dashboard/training`.
- `migration-routes.json` / route-matrix CSV still list old `(app)` paths — informational only until matrix script refresh.
- Do **not** start another business module until Habib reviews this phase.

## 8. Boundaries respected

- No DB schema changes.
- No legacy Vite page rewrites/deletes.
- No Express authorization changes.
- No commit / push / merge / deploy in this phase.
