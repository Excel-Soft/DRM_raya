# Phase 8 — DRM IP List: Read-Only Next.js Migration

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Scope:** `frontend-next/` read-only · **Date:** 2026-10-23  
**Route:** `/allowed-ip/drm-ip-list`

---

## 1. Source evidence

### Legacy UI and registry

| Source | Finding |
|--------|---------|
| `frontend/src/pages/allowed-ip-list.tsx` | Type `AllowedIp`: `id`, `ip_cidr`, `description`, `is_active`, `createdAt`, `updatedAt`. List via `GET /api/settings/allowed-ips`. Table columns: IP/CIDR, description, active switch, created at, actions (write — not ported). |
| `frontend/src/routes/route-registry.ts` | Path `/allowed-ip/drm-ip-list`, `allowedRoles: ADMIN_ONLY` where `ADMIN_ONLY = ["admin", "super_admin", "administrator", "super_hod"]`. |
| `frontend/src/components/app-sidebar.tsx` | Group **Allowed IP** (`permKey: "Allowed IP"`); item **DRM IP List** → `/allowed-ip/drm-ip-list`. Menu visibility map **Allowed IP**: `["admin", "super_admin"]` only (narrower than registry — documented gap). |
| `frontend/src/lib/route-access.ts` | **No** `/allowed-ip` prefix today. `useRouteProtection` only applies `ROUTE_PERMISSIONS` prefixes; paths with **no matching prefix allow any authenticated user** at the URL guard (legacy gap). |

### Backend

| Source | Finding |
|--------|---------|
| `backend/src/server/routes/settings-routes.ts` | `registerSettingsRoutes`: `app.use("/api/settings", authMiddleware)` then `settingsRouter.get("/allowed-ips", …)` → `allowedIpsRepository.findAll()` → `res.json(allowedIps)`. **No `requireRole` on GET list.** |
| `backend/src/server/repositories/allowed-ips.repository.ts` | `findAll()` selects full Drizzle rows from `allowed_ips`. |
| `frontend/shared/schema.ts` | Table `allowed_ips`: `id`, `ip_cidr`, `description`, `is_active`, `createdAt`, `updatedAt`. |
| Write routes (not used in Phase 8) | POST/PATCH/DELETE validate IP/CIDR via `isValidIpOrCidr()` in settings-routes — reference for future CRUD only. |

### Next foundation reused

- `useApiResource` → `apiFetch` → `GET /api/settings/allowed-ips`
- `Card`, `PageHeader`, `DataTable`, `Badge`, `PageLoading`, `PageEmpty`, `PageError`, `PageForbidden`

---

## 2. Route authorization (Next)

Added **exact path prefix** (not broad `/allowed-ip`) to avoid accidental future routes:

```text
/allowed-ip/drm-ip-list → ADMIN_ONLY (registry-aligned)
```

Defined in `src/lib/auth/route-access.ts` as `DRM_IP_LIST_ROUTE` + `ADMIN_ONLY_ROUTE_ROLES`. Re-exported from `route-access-policy.ts`.

**Prefix precedence:** `/admin` rules do **not** grant DRM IP List (`service_manager` passes `/admin` but fails DRM IP path — unit test).

**Express:** Unchanged. **Security note for Habib approval:** any **authenticated** user can call `GET /api/settings/allowed-ips` today; Next client guard is **stricter** than the API. Do not treat the UI guard as API protection. Fixing backend role enforcement is **out of Phase 8 scope** (Express not modified).

---

## 3. Implementation summary

Read-only page: IP/CIDR, description, active/inactive badge, created timestamp. No `updatedAt` column (legacy table did not show it). No create/edit/toggle/delete.

Navigation: pilot shell + foundation home link when role allows (same pattern as other pilots).

---

## 4. Files changed

### New

- `src/app/(app)/allowed-ip/drm-ip-list/page.tsx`
- `src/modules/allowed-ip/drm-ip-list-view.tsx`
- `docs/PHASE8_STATUS.md`

### Modified

- `src/lib/auth/route-access.ts` — `ADMIN_ONLY_ROUTE_ROLES`, `DRM_IP_LIST_ROUTE`, route rule
- `src/lib/auth/route-access-policy.ts` — re-export constants
- `src/lib/auth/route-access.test.ts` — 9 tests for DRM IP route
- `src/components/layout/app-shell.tsx` — nav item
- `src/app/(app)/page.tsx` — home link
- `scripts/smoke-api.mjs` — unauthenticated check for allowed-ips

### Regenerated (validation)

- `docs/route-matrix/*`, `src/config/routes/migration-routes.json` (`generatedAt` only unless matrix logic changed)

**Not modified:** Express, DB, legacy `frontend/`, `/approvals`, `/sales/active-clients`.

---

## 5. Tests and command results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 13 unit + **23** route-access (+9 new) + 7 policy = **43** |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** (0 errors; existing PostCSS warning) |
| `npm run build` | **Pass** — includes `/allowed-ip/drm-ip-list` |
| `npm run build:standalone` | **Pass** — static + public copied |
| `node frontend-next/scripts/build-route-matrix.mjs` | **Pass** — 207 routes |
| Legacy `frontend` `route-access.test.ts` | **Pass** — 10 |
| `BACKEND_URL=http://localhost:5001 node scripts/smoke-api.mjs` | **Pass** — allowed-ips **401** without auth |

**Authenticated browser / E2E:** **Not run** (no credentials in agent environment). Unauthenticated 401 smoke does **not** prove admin list rendering or non-admin denial in browser.

---

## 6. Known gaps

| Gap | Notes |
|-----|--------|
| CRUD / toggle | Legacy only; Phase 8 explicitly deferred |
| Backend GET authorization | Auth-only; role gap vs registry ADMIN_ONLY |
| Legacy URL guard | No `/allowed-ip` in legacy `route-access.ts`; Next is stricter |
| Sidebar vs registry | Sidebar **Allowed IP** menu: admin/super_admin only; registry includes administrator/super_hod |
| `updatedAt` | In API/schema, omitted from read-only UI to match legacy columns |
| Migration tracker JSON | Still `migrationStatus: "legacy"` for this path until Habib updates tracker |
| Full acceptance | Requires Habib review + optional Phase 5-style E2E with admin credentials |

---

## 7. Acceptance verdict

**Read-only slice complete — pending Habib review before CRUD or next module.**

- UI route, client role guard, shared components, and GET integration match verified contracts.
- **Not** fully accepted for production or cutover: backend role mismatch, no authenticated E2E, legacy Vite remains authoritative for writes and deployment.

Stop here per Phase 8 scope. Do not implement write operations until explicitly approved.

---

*No commit, push, merge, or deploy performed.*
