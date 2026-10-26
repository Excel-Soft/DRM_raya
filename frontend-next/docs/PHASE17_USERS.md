# Phase 17 — Users sidebar migration (Next.js)

**Branch:** `fix/upgrade_frontend_habib`  
**Status:** Phase 17.1 complete — see `PHASE17_1_STATUS.md`  
**Scope:** Legacy sidebar group **Users** only (3 items). Not Branches, Increment, or Add Penalty.

## 1. Sidebar inventory

| # | Legacy label | Legacy path | Next canonical path | View module |
|---|--------------|-------------|---------------------|-------------|
| 1 | Add User | `/drm/users/add` | `/dashboard/drm/users/add` | `add-user-view.tsx` |
| 2 | List | `/drm/users/list` | `/dashboard/drm/users/list` | `user-list-view.tsx` |
| 3 | Groups | `/drm/users/groups` | `/dashboard/drm/users/groups` | `user-groups-view.tsx` |

## 2. APIs (unchanged Express)

| Page | Primary APIs |
|------|----------------|
| Add User | `POST /api/users` (+ lookups: users list, departments/branches as in legacy form) |
| List | `GET/PATCH/DELETE /api/users`, filters, bulk actions (legacy parity) |
| Groups | `GET/POST/PATCH/DELETE /api/users/groups`, member assignment |

**Auth:** Registry `ADMIN_ONLY` for `/drm/users/*`. Next guard: `/drm` prefix in `route-access.ts` + menu perm **Users**.

## 3. Navigation

- `src/lib/navigation/users-routes.ts` — canonical paths + legacy redirects
- `legacy-redirects.ts`, `migrated-routes.ts`, `navigation-config.ts`, `navigation-visibility.ts`
- App routes: `src/app/(app)/dashboard/drm/users/{add,list,groups}/page.tsx`

## 4. Implementation notes

- Pages ported via `scripts/port-users-legacy.mjs` from `frontend/src/pages/{add-user,user-list,user-groups}.tsx`.
- Legacy shadcn under `@/components/ui/legacy/*`; `react-hook-form` added for Add User.
- **UI:** Full Next design-system pass (PageHeader, DataTable) deferred — functional parity first.
- Legacy Vite pages **not deleted**.

## 5. Verification

| Check | Status |
|-------|--------|
| `npm run test:navigation` | Run after pull |
| `npm run typecheck` | Run after pull |
| Authenticated browser QA | Manual on `:3000` |

## 6. Distinction from Super Admin

- **Super Admin** (Phase 16): admin accounts, roles, policies, IPs — `/dashboard/super-admin`.
- **Users** (Phase 17): HR-style employee onboarding, directory list, user groups — `/dashboard/drm/users/*`.

## 7. Next sidebar candidates (not Phase 17)

- Branches (`/drm/branches`)
- Increment / Add Penalty (top-level)
- Support, Account, PMS groups (large)
