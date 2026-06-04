# Stage 7 — DRM/DD Operations Completion

Converted DRM/DD placeholder screens into real, backend-backed features or
canonical redirects, module by module. No Stage 1–6 work was undone. No duplicate
engines were created (penalty/increment/performance already existed and were
verified, not rebuilt). No fake data: the database is empty, so every page renders
real-or-empty. All new DRM APIs mount **after** the auth + URL-permission
middleware in `server/routes.ts`, so they are never public.

## Modules implemented

| Module | Type | Result |
| --- | --- | --- |
| A. Promotion | New backend + FE wiring | Real |
| B. Today Post | New backend + FE wiring | Real |
| C. Commission Verification | New backend + FE wiring | Real |
| D. All Social Accounts | New backend + FE wiring | Real |
| E. Increment | Verify only (already real) | Verified |
| F. Performance | Verify only (already real) | Verified |
| G. Penalty | Verify only (already real, shared engine) | Verified |
| H. Late Coming | New backend (attendance-derived + manual) + FE wiring | Real |
| I. Monthly Complete Project | FE wiring to existing backend | Real |
| J. Delay Project | Canonicalized variants (redirect) | Real |

## Files changed

### Backend (new)
- `server/promotion-routes.ts` — `registerPromotionRoutes` + `ensurePromotionTable`
- `server/today-post-routes.ts` — `registerTodayPostRoutes` + `ensureTodayPostsTable`
- `server/commission-verification-routes.ts` — `registerCommissionVerificationRoutes` + `ensureCommissionVerificationTable`
- `server/social-accounts-routes.ts` — `registerSocialAccountsRoutes` + `ensureSocialAccountsTable`
- `server/late-coming-routes.ts` — `registerLateComingRoutes` + `ensureLateComingTable`

### Backend (edited)
- `server/routes.ts` — imported and registered the 5 new registrars (each
  `await`ed because it runs idempotent table DDL before serving).

### Frontend (edited)
- `client/src/pages/drm/promotion.tsx` — removed `initialData` mock; wired
  list/create/edit/active-toggle/approve/reject/delete.
- `client/src/pages/drm/today-post.tsx` — removed `MOCK_ENTITIES` + fabricated
  metrics; wired list/create (modal)/complete.
- `client/src/pages/drm/commission-verification.tsx` — removed hardcoded rows;
  wired list (tabs → status filter), approve/reject, exports + total over fetched
  rows, real pagination.
- `client/src/pages/drm/all-social-accounts.tsx` — removed `mockData`; wired
  list/add/add-channel/edit/verify/active-toggle/delete.
- `client/src/pages/drm/late-coming.tsx` — removed mock table; wired
  attendance-derived list + filters + "Add Late Minut" POST.
- `client/src/pages/drm/monthly-complete-project.tsx` — removed
  `MOCK_COMPLETED_PROJECTS`; wired to existing `/api/dd-executive/monthly-complete`.
- `client/src/pages/drm/delay-projects-new.tsx` — replaced hardcoded-mock variant
  with a re-export of the canonical `delay-project.tsx`.

## APIs added / modified

### Added (all under `/api/drm`, protected)
- **Promotion**: `GET /promotions`, `POST /promotions`, `PATCH /promotions/:id`,
  `PATCH /promotions/:id/approve`, `PATCH /promotions/:id/reject`,
  `DELETE /promotions/:id` (soft delete).
- **Today Post**: `GET /today-posts`, `POST /today-posts`,
  `PATCH /today-posts/:id`, `PATCH /today-posts/:id/complete`.
- **Commission Verification**: `GET /commission-verifications`,
  `POST /commission-verifications`,
  `PATCH /commission-verifications/:id/approve`,
  `PATCH /commission-verifications/:id/reject`.
- **Social Accounts**: `GET /social-accounts`, `POST /social-accounts`,
  `PATCH /social-accounts/:id`, `PATCH /social-accounts/:id/verify`,
  `DELETE /social-accounts/:id` (soft delete).
- **Late Coming**: `GET /late-coming` (attendance-derived report UNION manual
  entries, paginated + filters), `POST /late-coming` (manual entry).

All list endpoints return `{ data, total, page, pageSize }` and support
`page`, `pageSize`, `search`, plus per-module filters. Scoping mirrors the penalty
engine: full-access (admin/super_hod) & HR see all; HOD/managerial see their
department (+self); everyone else sees own; cross-scope mutation → 403.

### Reused (no new engine built)
- Penalty engine `/api/penalties/*` — shared by `drm/add-penalty.tsx` and
  `service-add-penalty.tsx`.
- Increment `/api/drm/increment/*`, Performance `/api/drm/performance/*`.
- Monthly Complete Project consumes existing `/api/dd-executive/monthly-complete`.
- Delay Project consumes existing `/api/hod/projects/delayed`.

## DB changes (schema `drm`, idempotent raw DDL — no drizzle-kit push)
- `drm.promotions`
- `drm.today_posts`
- `drm.commission_verifications`
- `drm.social_accounts`
- `drm.late_coming_entries`

Each created via `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` in an
`ensure*Table()` awaited at route registration. No existing tables/columns were
altered. `shared/schema.ts` was not modified (consistent with the Stage-5 pattern).

## Mock data removed
- `promotion.tsx` `initialData` (4 sample promos with Unsplash URLs)
- `today-post.tsx` `MOCK_ENTITIES` + fabricated `(0)` metrics rows
- `commission-verification.tsx` hardcoded total + static rows
- `all-social-accounts.tsx` `mockData`
- `late-coming.tsx` hardcoded empty/mock table
- `monthly-complete-project.tsx` `MOCK_COMPLETED_PROJECTS`
- `delay-projects-new.tsx` `delayProjectsData`

## Canonical redirects
- **Delay Project**: canonical page = `client/src/pages/drm/delay-project.tsx`
  (routes `/drm/delay-project` and `/projects`), single data source
  `GET /api/hod/projects/delayed`. The deprecated alias route
  `/drm/delay-projects-new` now re-exports the canonical page
  (`delay-projects-new.tsx` → `export { default } from "./delay-project"`).

## Integration status
- Promotion / Today Post / Commission Verification / Social Accounts / Late Coming:
  fully DB-backed (CRUD + workflow actions), real-or-empty.
- Increment / Performance / Penalty: verified DB-backed and mock-free; penalty
  engine confirmed shared across DRM + Service.
- Monthly Complete Project: bound to the existing DD-Executive endpoint (period
  param only; columns the endpoint doesn't provide render "—").
- Late Coming late-minute math: attendance-derived rows show late days; per-day
  minute derivation from attendance is not computed (shown as "—"), while manual
  entries carry explicit minutes.

## Test results
- `npx tsc --noEmit`: no NEW errors in any changed Stage 7 file (pre-existing
  baseline errors in `debug-routes.ts` / `reports-routes.ts` are unrelated and
  unchanged).
- `npm run build`: succeeds (client + server bundles emitted).
- Boot: `Start application` restarts cleanly on port 5000; all five `ensure*Table`
  DDLs ran without error; the 5 new tables exist in schema `drm`.
- Endpoint protection: unauthenticated `GET` on all 5 new endpoints returns
  **401** (registered + protected, not public, not 404).

## Known limitations
- Database is empty → all pages render empty states until real data is entered.
- No logged-in HTTP/visual smoke test was possible (no dev admin password
  available); verification was via build, boot, DDL/table checks, and auth-guard
  probes.
- Promotion banner upload stores the image as a data URL in `banner_url` (no file
  storage backend); large media is not optimized.
- Today Post URLs are validated as http(s) links; there is no scraping of live
  social metrics (the fabricated like/comment/share counts were removed, not
  replaced with a live feed).
- Monthly Complete Project is limited to the existing endpoint's period filter;
  team/customer/type filters were not invented on the backend.
- Late Coming per-day minute derivation from attendance is intentionally left as
  "—" rather than guessed.
