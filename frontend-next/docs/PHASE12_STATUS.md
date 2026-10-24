# Phase 12 — Sidebar Role Parity & Responsive Acceptance

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Date:** 2026-10-24

---

## 1. Sources compared

| Layer | Legacy (Vite) | Next.js |
|--------|----------------|---------|
| Menu tree | `frontend/src/components/app-sidebar.tsx` | `src/lib/navigation/navigation-config.ts` |
| Menu visibility | `GET /api/drm/permissions` → `menu_permissions`, fallback `DEPT_NAME_TO_ROLES` + deny rules | Static `MENU_PERM_ROLES` (same map as legacy fallback) + `navigation-visibility.ts` |
| Page guard | `route-access.ts` + `useRouteProtection` | `AuthGate` + `route-access.ts` |
| Registry mirror | `route-registry.ts` `allowedRoles` / `permissionKey` | Documented; not loaded at runtime |
| Backend auth | Express middleware per route | Unchanged |

**Limitation:** Live `menu_permissions` rows were **not** queried in this phase. Next nav parity targets legacy **fallback** behavior when DB roles are empty. Production may differ when DRM Permission UI assigns roles in the database.

---

## 2. Role × migrated module matrix

Legend: **Menu** = sidebar link visible · **Route** = `isRouteAccessAllowed` · **API** = Express (unchanged)

### `admin` / `super_admin`

| Module | Menu (fallback) | Route | Notes |
|--------|-----------------|-------|--------|
| Notice Board | Yes (bypass / DEPT) | Yes | |
| DRM Policies | Yes | Yes | |
| Audit Logs | Yes (`canShowAuditLogsNav`) | Yes | |
| DRM IP List | Yes | Yes | |

### `super_hod`

| Module | Menu (fallback) | Route | Notes |
|--------|-----------------|-------|--------|
| Notice Board | **No** | **Yes** | Registry + `route-access` wider than `DEPT_NAME_TO_ROLES["Notice Board"]` |
| DRM Policies | **No** | **Yes** | Same pattern |
| Audit Logs | Yes | Yes | |
| DRM IP List | **No** | **Yes** | Registry `ADMIN_ONLY` includes `super_hod`; DEPT `Allowed IP` = admin/super_admin only |

### `account_manager`

| Module | Menu (fallback) | Route | Notes |
|--------|-----------------|-------|--------|
| Notice Board | **No** | **Yes** | Registry lists account_manager; DEPT fallback does not |
| DRM Policies | **No** | **Yes** | Same |
| Audit Logs | No | No | |
| DRM IP List | No | No | |

### `reception_manager`

| Module | Menu (fallback) | Route | Notes |
|--------|-----------------|-------|--------|
| Notice Board | Yes | Yes | Aligned |
| DRM Policies | Yes | Yes | Aligned |

**Backend** remains authoritative for API writes (e.g. policies managerial roles). Menu/route gaps above affect **navigation and client guard only**.

---

## 3. Discrepancies fixed in Phase 12

| Issue | Before | After |
|--------|--------|--------|
| Migrated links used **route-access only** for menu | `account_manager` saw Notice/Policies in sidebar while legacy DEPT fallback would not | Menu requires **`hasMenuPermAccess(permKey)`** AND `isRouteAccessAllowed` for `/notice-board`, `/policies`, `/allowed-ip/*` |
| `MENU_PERM_ROLES` Notice/Policies/Allowed IP | Expanded beyond legacy DEPT | **Synced** to legacy `DEPT_NAME_TO_ROLES` lines 379–386 in `app-sidebar.tsx` |
| Regression tests | Partial | Added **`navigation-role-parity.test.ts`** |

**Intentionally not changed:** `route-access.ts` prefixes (page access still matches Phase 2–10 guards). **Not weakened** Express or backend.

---

## 4. Unresolved product decisions (document only)

1. **Registry vs DEPT fallback** — e.g. `super_hod` / `account_manager` on Notice/Policies in `route-registry.ts` but not in sidebar DEPT map. Next **menu** follows DEPT fallback; **direct URL** still allowed when route-access passes.
2. **`super_hod` + DRM IP** — Route/registry allow; legacy DEPT menu does not. Menu hidden; URL + `AuthGate` still allow (Express gated Phase 9.1).
3. **Live `menu_permissions`** — Legacy may show more/less per DB; Next cannot mirror without API integration (Phase 11 follow-up).

---

## 5. Shell verification

| Check | Method | Result |
|--------|--------|--------|
| Viewports 375 / 768 / 1280 | Playwright `e2e/shell-phase12.spec.ts` on `/auth` | **1/1 pass** |
| No horizontal overflow (auth) | scrollWidth ≤ clientWidth in spec | **Pass** |
| Authenticated sidebar drawer, theme toggle, Policies page both themes | Requires login on `:3001` | **Not run** — no `E2E_EMAIL` / `E2E_PASSWORD` in session |
| `NEXT_PUBLIC_LEGACY_APP_ORIGIN` | Not set in dev | Legacy links show badge only (documented) |

**Manual acceptance (Habib):** Log in → toggle theme → reload → open Notice/Policies → mobile menu open/close.

---

## 6. Test & build outcomes

```bash
cd frontend-next
npm test          # 65 tests (incl. 5 role-parity)
npm run typecheck
npm run lint      # 0 errors
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e -- e2e/shell-phase12.spec.ts
```

| Suite | Result |
|--------|--------|
| Unit + skeleton + theme | 19 pass |
| Navigation + **role parity** | 14 pass |
| Route access | 32 pass |
| Playwright shell smoke | 1 pass |
| Other E2E (auth, drm-ip) | **Not re-run** this phase |

---

## 7. Files changed

| File | Change |
|------|--------|
| `src/lib/navigation/menu-perm-roles.ts` | DEPT sync Notice/Policies/Allowed IP |
| `src/lib/navigation/navigation-visibility.ts` | permKey + route for migrated hrefs |
| `src/lib/navigation/navigation-role-parity.test.ts` | New |
| `src/lib/navigation/navigation-visibility.test.ts` | Updated expectations |
| `package.json` | `test:navigation` includes parity suite |
| `e2e/shell-phase12.spec.ts` | Viewport smoke |

---

## 8. Stop point

Role comparison complete, safe menu parity corrections applied, regressions green. **No new business module migration.** Await Habib review before Phase 13 module selection.
