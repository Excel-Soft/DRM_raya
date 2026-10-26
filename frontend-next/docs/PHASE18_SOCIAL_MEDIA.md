# Phase 18 — Social Media Posting (Next.js)

**Branch:** `fix/upgrade_frontend_habib`  
**Status:** Initial migration (parity port + nav/auth)  
**Scope:** Sidebar **Social Media Posting** → **Add Post / Statistics** (single page).

## 1. Routes

| Legacy | Next canonical |
|--------|----------------|
| `/social-media` | `/dashboard/social-media` |

- `src/lib/navigation/social-media-routes.ts`
- App page: `src/app/(app)/dashboard/social-media/page.tsx`
- View: `src/modules/social-media/social-media-view.tsx` (ported from `frontend/src/pages/social-media.tsx`)

## 2. APIs (unchanged Express)

- `GET/POST/PATCH/DELETE /api/social-media/posts*`
- `GET /api/social-media/accounts`
- `GET /api/social-media/dashboard/summary`
- `GET /api/social-media/posts/export`

**Auth:** Menu perm **Social Media Posting** (`admin`, `hod`, `super_hod`, `marketing_manager`). Next guard: `/social-media` prefix in `route-access.ts` (via `toLegacyGuardPath` for `/dashboard/social-media`).

## 3. UI notes

- Emerald/zinc shell: `PageHeader`, `DrmSection` (overview stats + posts), `DataTable`, themed filters and create/edit dialogs.
- Legacy shadcn kept for dialog primitives and delete confirm (`alert-dialog`).

## 4. Verification

| Check | Command |
|-------|---------|
| Navigation tests | `npm run test:navigation` |
| Route access | `npm run test:route-access` |
| Typecheck | `npm run typecheck` |
| Manual QA | `:3000/dashboard/social-media` as marketing_manager or admin |

Legacy Vite route **not deleted**.
