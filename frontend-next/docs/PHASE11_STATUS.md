# Phase 11 — App Shell, Sidebar, Topbar, RBAC & Theme

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Date:** 2026-10-24 (updated after shell polish)

---

## 1. Initial findings (pre-implementation)

| Area | Finding |
|------|---------|
| **Shell** | Single `app-shell.tsx` — flat nav duplicated in header + sidebar, no mobile drawer, no theme toggle |
| **Legacy sidebar** | `frontend/src/components/app-sidebar.tsx` — grouped menus, `permKey` → DB + `DEPT_NAME_TO_ROLES` fallback |
| **Next route guard** | `route-access.ts` prefix rules; audit nav via `canShowAuditLogsNav` |
| **Theme** | `prefers-color-scheme` only; Tailwind v4 `dark:` ignored manual `html.dark` until `@custom-variant` added |
| **Loading UX** | Text-only “Loading…” in `PageLoading` / auth gate |
| **Migrated `(app)` routes** | `/`, `/notice-board`, `/policies`, `/admin/audit-logs`, `/allowed-ip/drm-ip-list` |

---

## 2. What was implemented

### Navigation & shell

- **`src/lib/navigation/*`** — Grouped inventory (legacy-aligned), role **menu visibility** (not auth), Next vs Legacy badges, optional `NEXT_PUBLIC_LEGACY_APP_ORIGIN`.
- **`app-shell.tsx`**, **`app-topbar.tsx`**, **`app-sidebar-nav.tsx`**, **`mobile-nav-drawer.tsx`**, **`nav-link-item.tsx`**.
- **`react-icons/hi2`** — Sidebar module icons, topbar (menu, user, sign out), **chevron down/up** on expandable groups (replacing `+` / `−`), collapse control.

### Theme

- **`@custom-variant dark`** in `globals.css` so toggle applies to all `dark:` utilities (Tailwind v4).
- **`theme-provider.tsx`**, **`theme-toggle.tsx`**, inline **`THEME_INIT_SCRIPT`**, `localStorage` key `drm-next-theme`.

### Typography

- **Poppins** (Google Font, 400–700) as app `--font-sans` / body font.

### Toasts & feedback

- **`sonner`** — `AppToaster`, `src/lib/toast.ts`.
- Toasts: theme change, sign out, login/session errors, auth provider errors, policies create/delete (alongside existing `FormBanner`).

### Skeleton loaders

- **`src/components/ui/skeleton.tsx`** — `Skeleton`, `TableSkeleton`, `ModulePageSkeleton`, `AuthSessionSkeleton`.
- **`PageLoading`** — skeleton module layout (screen-reader label retained).
- **`DataTable`** — `TableSkeleton` while loading.
- **`AuthGate`** — `AuthSessionSkeleton` during session verify / redirect wait.
- Used by: notice board, audit logs, DRM IP list, policies (via shared page states / table).

### Standalone ops (Phase 10 carry-over)

- **`postbuild`** → `prepare-standalone.mjs`; restart standalone after every build to avoid chunk/CSS 500/404.

---

## 3. Legacy vs Next behavior

| Topic | Behavior |
|-------|----------|
| **Migrated routes** | Next `<Link>`, **Next** badge |
| **Unmigrated routes** | **Legacy** badge; external link if `NEXT_PUBLIC_LEGACY_APP_ORIGIN` set |
| **Inventory** | Legacy modules retained in sidebar (not removed) |

---

## 4. Permission discrepancies (unchanged)

- Next nav uses **static `MENU_PERM_ROLES` + `route-access.ts`**; legacy may differ via **DB `menu_permissions`**.
- **Notice / Policies** nav follows **route-access** (may be wider than legacy `DEPT_NAME_TO_ROLES` for Policies).
- **Audit logs** nav = `canShowAuditLogsNav` only.

---

## 5. Files changed / added (cumulative)

| Area | Paths |
|------|--------|
| Layout | `src/components/layout/*` |
| Navigation | `src/lib/navigation/*` |
| Theme | `src/lib/theme/*`, `src/providers/theme-provider.tsx`, `globals.css`, `app/layout.tsx` |
| Feedback | `src/lib/toast.ts`, `src/components/ui/toaster.tsx` |
| Loading | `src/components/ui/skeleton.tsx`, `page-states.tsx`, `data-table.tsx`, `auth-gate.tsx` |
| Modules | `policies-view.tsx`, `login-form.tsx`, `auth-provider.tsx` (toast only) |
| Tests | `navigation/*.test.ts`, `skeleton.test.ts`, `theme-storage.test.ts` |
| Deps | `react-icons`, `sonner` |

---

## 6. Verification

```bash
cd frontend-next
npm test
npm run typecheck
npm run lint
npm run build
PORT=3001 BACKEND_URL=http://127.0.0.1:5001 npm run start:standalone
```

| Check | Result (last run) |
|-------|-------------------|
| Unit + navigation + route-access | Pass |
| Typecheck / build | Pass |
| Lint | 0 errors (minor warnings acceptable) |

**Browser:** Hard refresh after standalone restart. **`?_rsc=…` in Network** = normal Next.js RSC prefetch, not a broken URL.

**E2E / responsive sign-off:** Not run with `E2E_*` creds in repo session.

---

## 7. Remaining follow-ups

- Set **`NEXT_PUBLIC_LEGACY_APP_ORIGIN`** for clickable legacy sidebar targets.
- Optional: **`menu_permissions` API** for nav parity with Vite.
- Login button loading state could use inline skeleton (deferred).

---

## 8. Stop point

Shell + loading + theme + toast foundation complete for Habib review. **No additional business module migration** in Phase 11.
