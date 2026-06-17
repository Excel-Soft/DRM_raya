# Patch 4 Stage 5 — Social Media Posting: Current State (pre-repair recon)

Recon of the Social Media Posting feature **before** the Stage 5 repair, captured
to scope ISS-03 (P1). This documents what existed, what was real, and what was
broken/mocked.

## Routes (frontend)

- `client/src/App.tsx` L272 — `<Route path="/social-media" component={SocialMedia} />`
  maps to `client/src/pages/social-media.tsx`.
- A separate, working page `client/src/pages/drm/all-social-accounts.tsx`
  (route `/drm/all-social-accounts`) manages **social accounts** (not posts) and
  is fully DB-backed via `/api/drm/social-accounts`.

## The posting page (broken / mock)

`client/src/pages/social-media.tsx` was a **mock, local-only** screen:

- All state (`posts`, `formData`) lived in React `useState`; nothing was sent to
  or read from any API. A page refresh discarded everything.
- "Add New Post" only wrote a URL string per platform into local component state
  for three hard-coded section labels (`Webexcels`, `Welc`, `Ceo`).
- Engagement stats (likes/comments/shares) were hard-coded `(0)`.
- There was **no** create/edit/schedule/submit/approve/reject/publish/cancel
  lifecycle, no persistence, no auth calls, no role/permission gating, and no
  status tracking. "Save" produced a fake success with no backend.

## APIs (backend) — before

- **Posts:** none. There was no `/api/social-media/*` surface and no posts table.
- **Accounts:** `server/social-accounts-routes.ts` exposed a real, auth-protected,
  audited CRUD surface at `/api/drm/social-accounts` backed by `drm.social_accounts`
  (list/create/update/verify/soft-delete, with scoping). This was working and was
  the obvious thing to **reuse** rather than duplicate.

## Tables (DB) — before

- `drm.social_accounts` — existed and in use (the accounts page).
- `drm.social_media_posts` — **did not exist**.

## Auth / permission context

- All `/api/*` routes are mounted behind `authMiddleware` + a URL-permission
  middleware in `server/routes.ts`. That middleware **default-ALLOWS** unmapped
  paths, so any new posting endpoints would be authenticated but **not**
  permission-filtered by the middleware — per-handler role guards are the real
  enforcement.
- Roles are normalized via `server/utils/role-utils.ts` (`normalizeRole`,
  `isManagerialRole`). View scoping elsewhere uses a department-based
  "allowed user ids" pattern (`today-post-routes`, `social-accounts-routes`).

## Constraints discovered

- `npm run db:push` is broken repo-wide (a pre-existing FK type mismatch), so any
  new table must be created with runtime idempotent DDL (`CREATE TABLE IF NOT
  EXISTS` + `CREATE INDEX IF NOT EXISTS`), mirroring `ensureSocialAccountsTable`.
- `opportunities`/legacy id columns are `varchar` while `customers.id` is `uuid`;
  joins must cast (`::text`) to avoid 500s. `linked_project_id` is therefore
  stored as `text` to match the existing project-id convention.
- No external social provider (Facebook/Instagram/LinkedIn/etc.) is configured and
  none may be added in this stage, so "publish" must be an honest **internal/manual**
  record — never a faked external success.

## Repair scope (what Stage 5 must add)

1. `drm.social_media_posts` (additive) via runtime ensure-DDL + `shared/schema.ts`.
2. A real, auth-protected `/api/social-media/posts` lifecycle (create/edit/list/
   view/submit/approve/reject/schedule/publish/cancel/soft-delete/export) with
   server-side status machines, role gating, audit and notifications.
3. An `/api/social-media/accounts` **alias** onto the existing social-account
   handlers (no duplication, no rewrite of the accounts page).
4. A full rebuild of `social-media.tsx` into a real API-backed workbench.
