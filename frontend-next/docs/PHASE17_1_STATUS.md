# Phase 17.1 — Users module completion & verification

**Branch:** `fix/upgrade_frontend_habib`  
**Date:** 2026-10-24  
**Status:** Ready for Habib review (authenticated browser QA not run in this session)

## 1. Files changed

| Area | Files |
|------|--------|
| Routes / nav | `users-routes.ts`, `legacy-redirects.ts`, `migrated-routes.ts`, `navigation-config.ts`, `navigation-visibility.ts` |
| App routes | `app/(app)/dashboard/drm/users/{layout,add,list,groups}/page.tsx` |
| Views | `add-user-view.tsx`, `user-list-view.tsx`, `user-groups-view.tsx` |
| Shared | `add-user-schema.ts`, `users-api.ts`, `components/ui/legacy/{form,scroll-area}.tsx` |
| Tests | `add-user-schema.test.ts`, `users-api.test.ts`, `users-routes.test.ts`, `route-access.test.ts`, `navigation-visibility.test.ts` |
| Tooling | `scripts/port-users-legacy.mjs`, `package.json` (deps + test:unit) |
| Shell | `app-shell.tsx` (wide layout for users paths) |

Legacy Vite pages under `frontend/src/pages/{add-user,user-list,user-groups}.tsx` — **unchanged**.

## 2. Implemented workflows (parity with legacy)

### Add User (`/dashboard/drm/users/add`)
- Full Zod schema (personal, employment, salary, gender, address).
- Dynamic roles from `GET /api/settings/roles` merged with static `ROLE_TYPES`.
- Under Works grouped from `GET /api/users` (same grouping logic as legacy).
- `POST /api/users` with auto-generated password and primary/multi-role payload (`buildCreateUserPayload` / `createUserRequest`).
- HTTP + `success: false` errors surfaced via toast; duplicate submit guarded (`isSubmitting` + `isPending`).
- Success → invalidate `/api/users` → redirect to `USERS_LIST`.

### User List (`/dashboard/drm/users/list`)
- Search + role filter → `GET /api/users?search=&role=`.
- Full table columns; edit dialog loads `GET /api/users/:id` and saves `PATCH /api/users/:id`.
- Status toggle `PATCH /api/users/:id/status`; delete `DELETE /api/users/:id` with confirm dialog.
- Team members: `GET/POST/DELETE` `/api/users/:id/team-members` (legacy parity).
- Navigate to Add User via canonical `USERS_ADD`.

### User Groups (`/dashboard/drm/users/groups`)
- `GET /api/users/groups`, `GET /api/users` for member picker.
- Create `POST /api/users/groups`; edit `PATCH /api/users/groups/:id` (name, description, memberIds); delete with confirm.
- Member search + checkbox assignment in create/edit dialogs.

## 3. Legacy behavior still missing

| Item | Reason |
|------|--------|
| None identified in code diff | Line counts and API usage match legacy ports (~865/1139/492 lines). |
| Full DataTable refactor for list/groups | UI-only; table UX still legacy shadcn `Table` inside `DrmSection` — behavior unchanged. |
| Playwright / manual CRUD E2E | No credentials in agent session — see §6. |

## 4. Tests run (exact results)

| Command | Result |
|---------|--------|
| `npm test` (unit + navigation + dashboard-auth + route-access + route-access-policy) | **Pass** (all suites green after 17.1 changes) |
| `npm run typecheck` | **Pass** |
| `npm run build` | **Pass** (Next 16.4.2 webpack build + standalone postbuild) |

**New unit coverage:**
- `add-user-schema.test.ts` — email, roles, mobile validation
- `users-api.test.ts` — create payload shape + password generation
- `users-routes.test.ts` — redirects + migrated paths
- `route-access.test.ts` — admin allowed / sales_executive denied on `/dashboard/drm/users/*`
- `navigation-visibility.test.ts` — Users menu for admin only

## 5. Authorization & routing

- **Backend:** unchanged Express `ADMIN_ONLY` on `/drm/users/*` (authoritative).
- **Client guard:** `ROUTE_PERMISSIONS["/drm"]` → `ADMIN_ONLY_ROUTE_ROLES`; canonical paths map via `toLegacyGuardPath` to `/drm/users/...`.
- **Menu:** `permKey: "Users"` + `MENU_PERM_ROLES.Users` (admin, super_admin, administrator, super_hod); visibility tested.
- **Redirects:** `/drm/users/{add,list,groups}` → `/dashboard/drm/users/...` (no query-string routes on these pages).
- **Super Admin:** separate module (`/dashboard/super-admin`) — not conflated with employee Users module.

## 6. Authenticated browser QA

**Blocked in this session** — no `E2E_EMAIL` / `E2E_PASSWORD` provided. Recommended manual checklist on `:3000`:

1. Add User — submit valid employee, land on list, new row visible.
2. List — search, role filter, edit save, status toggle, team member add/remove, delete confirm.
3. Groups — create with members, edit members, delete group.

## 7. UI consistency (17.1)

- All three pages: **`PageHeader`** (eyebrow “Users”, emerald primary actions).
- List: **`DrmSection`** for filters + table panel.
- Add User: Next **`Button`** primary/secondary on submit row; legacy **`Form`** fields preserved.
- Dialogs: mostly legacy shadcn; cancel/delete use Next button variants where touched.

## 8. Remaining blockers

- Habib **authenticated sign-off** on the three workflows above.
- Optional follow-up: migrate list/groups tables to shared **`DataTable`** without changing API contracts.

**Stop line:** Phase 17.1 complete for review — do not start Branches / Increment until Users sign-off.
