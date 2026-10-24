# Phase 16 — DRM Setting migration (Next.js)

**Branch:** `fix/upgrade_frontend_habib`  
**Status:** Implementation complete pending Habib review + authenticated browser QA  
**Scope:** Legacy sidebar group **DRM Setting** only (`app-sidebar.tsx`); not Users, Increment, Add Penalty, or Branches.

## 1. Sidebar inventory (source of truth)

| # | Legacy label | Legacy path | Next canonical path | View module | permKey |
|---|--------------|-------------|---------------------|-------------|---------|
| 1 | Super Admin | `/super-admin` | `/dashboard/super-admin` | `super-admin-view.tsx` | Admin |
| 2 | Admin | `/admin` | `/dashboard/admin` | `admin-dashboard-view.tsx` | Admin |
| 3 | Audit Logs | `/admin/audit-logs` | `/dashboard/audit-logs` | *(Phase 13)* | Admin |
| 4 | Attributes | `/drm/attributes` | `/dashboard/drm/attributes` | `attributes-view.tsx` | DRM Setting |
| 5 | Drm Permission | `/drm/permission` | `/dashboard/drm/permission` | `permission-view.tsx` | DRM Setting |
| 6 | Promotion | `/drm/promotion` | `/dashboard/drm/promotion` | `promotion-view.tsx` | DRM Setting |
| 7 | Delay Project | `/drm/delay-project` | `/dashboard/drm/delay-project` | `delay-project-view.tsx` | DRM Setting |
| 8 | Related Customer | `/drm/related-customer` | `/dashboard/drm/related-customer` | `related-customer-view.tsx` | DRM Setting |
| 9 | Pms Project Setting | `/drm/pms-setting` | `/dashboard/drm/pms-setting` | `pms-setting-view.tsx` | DRM Setting |
| 10 | Bot system | `/drm/bot-system` | `/dashboard/drm/bot-system` | `drm-feature-pages.tsx` | DRM Setting |
| 11 | Online Form | `/drm/online-form` | `/dashboard/drm/online-form` | `drm-feature-pages.tsx` | DRM Setting |
| 12 | Fb Post | `/drm/fb-post` | `/dashboard/drm/fb-post` | `drm-feature-pages.tsx` | DRM Setting |

**Internal / not in sidebar (unchanged on Vite):** `/drm/delay-projects-new`, `/drm/monthly-complete-project`, `/drm/overall-report`, `/drm/today-post`, etc.

## 2. API & authorization (unchanged Express)

| Submodule | Primary APIs | Notes |
|-----------|--------------|--------|
| Attributes | `GET/POST/DELETE /api/attributes/:category`, branches/departments/services trees | `attributes.*` action permissions on mutations |
| Permission | `GET/POST/PUT/DELETE /api/drm/permissions`, toggle | **Mutations:** `drm.permissions.manage` + admin role (`drm-routes.ts`) |
| Promotion | `/api/drm/promotions` (+ roles list) | Admin-gated in registry |
| Delay Project | `GET /api/hod/projects/delayed`, `PUT /api/pms/projects/:id` | Reschedule via PMS project update |
| Related Customer | Related-customer DRM APIs (legacy page) | Ported 1:1 |
| PMS Setting | PMS settings endpoints (legacy page) | Ported 1:1 |
| Bot / Online / FB | `/api/bot/send-message`, profile | Feature-flagged UI; inactive state when flag off |
| Super Admin | `/api/users`, `/api/settings/roles`, policies, IPs | Large admin surface — ported from legacy |
| Admin | `/api/admin/activities/*` | Activity reports — ported from legacy |

Registry `allowedRoles` for DRM sidebar routes: **ADMIN_ONLY** (`route-registry.ts`). Next guard: `ROUTE_PERMISSIONS["/drm"]` + `/admin` + `/super-admin` (`route-access.ts`).

## 3. Feature parity checklist

| Submodule | List/detail | CRUD | Validation | Search/filter | Dialogs/toasts | Role gates | Status |
|-----------|-------------|------|------------|---------------|----------------|------------|--------|
| Super Admin | ✓ | ✓ users/roles | legacy | search | ✓ | Admin menu + route | **Ported** — browser QA pending |
| Admin | ✓ | reports | legacy | ✓ | ✓ | Admin | **Ported** — browser QA pending |
| Audit Logs | ✓ | — | — | ✓ | ✓ | audit viewers | **Verified Phase 13** |
| Attributes | ✓ | ✓ + trees | backend + UI | category select | ✓ | attributes.* | **Ported** |
| Permission | ✓ | ✓ menu perms | Zod on backend | tabs | ✓ | admin + `drm.permissions.manage` | **Ported** — security review for Habib |
| Promotion | ✓ | ✓ + banner | legacy | pagination | ✓ | admin | **Ported** |
| Delay Project | ✓ | edit deadline | legacy | search | ✓ | admin | **Ported** |
| Related Customer | ✓ | ✓ | legacy | ✓ | ✓ | admin | **Ported** |
| PMS Setting | ✓ | ✓ | legacy | ✓ | ✓ | admin | **Ported** |
| Bot / Online / FB | chat UI | send stub | — | — | ✓ | flag + admin | **Ported** (hidden nav unless `NEXT_PUBLIC_*_ENABLED=true`) |

## 4. Navigation & redirects

- **Config:** `src/lib/navigation/drm-routes.ts`, `navigation-config.ts` (full DRM Setting children)
- **Legacy redirects:** `legacy-redirects.ts` (+ `/projects`, `/pms/settings` aliases)
- **Migrated badges:** `migrated-routes.ts` includes all `DRM_SETTING_SIDEBAR_PATHS`
- **Visibility:** `navigation-visibility.ts` — DRM dashboard prefix + bot/online/fb feature flags

## 5. Implementation notes

- Legacy Vite pages **not deleted**; Next ports live under `src/modules/drm/` with `@tanstack/react-query` via `QueryProvider` in `(app)/layout.tsx`.
- **UI (2026-10-24):** Attributes and embedded tree/department views use the Next design system (`PageHeader`, `Card`, `DataTable`, emerald/zinc tokens via `drm-ui.tsx`). Other DRM pages still use ported legacy shadcn until restyled in a follow-up pass.
- Attribute trees: `service-catalog-tree`, `qa-attribute-tree`, `buyer-detail-tree`, `departments-manager`, `service-form-dialog`.

## 6. Verification (2026-10-24)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm test` (unit + navigation + route-access) | Pass |
| `npm run build` | Pass — all `/dashboard/drm/*`, `/dashboard/super-admin`, `/dashboard/admin` routes emitted |
| Authenticated browser E2E | **Blocked** — no credentials in CI env; manual QA on :3000/:3001 recommended |
| Permission mutation policy | **Not changed** — backend `requirePermsAdmin` unchanged |

## 7. Deferred / out of scope

- **Users** group (`/drm/users/*`) — separate sidebar group, not Phase 16.
- **Branches** (`/drm/branches`) — top-level sidebar in legacy, not inside DRM Setting group.
- **Increment / Add Penalty** — separate groups.
- Deep E2E for every CRUD path — add when Playwright creds available.

## 8. Sub-phases (internal)

| ID | Submodule | Done |
|----|-----------|------|
| 16A | Routes + nav + redirects | ✓ |
| 16B | Attributes + trees | ✓ |
| 16C | Permission | ✓ (Habib security sign-off pending) |
| 16D | Promotion, Delay, Related, PMS | ✓ |
| 16E | Super Admin + Admin | ✓ |
| 16F | Bot / Online / FB + flags | ✓ |

**Stop line:** Do not start the next sidebar group until Habib reviews Phase 16 (especially Permission).
