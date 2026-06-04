---
name: DRM/DD operations modules (Stage 7)
description: Where DRM/DD operational features live and the engines that must be reused, not rebuilt.
---

# DRM/DD operations

DRM operational pages live in `client/src/pages/drm/`. Their backends are
per-module route files in `server/` (e.g. `promotion-routes.ts`,
`today-post-routes.ts`, `commission-verification-routes.ts`,
`social-accounts-routes.ts`, `late-coming-routes.ts`), each registered in
`server/routes.ts` **after** the auth + URL-permission middleware so DRM APIs are
never public.

## Reuse, do not duplicate
- Penalty engine `/api/penalties/*` is the single shared engine — used by BOTH
  `drm/add-penalty.tsx` and `service-add-penalty.tsx`. Do not build a parallel one.
- Increment `/api/drm/increment/*` and Performance `/api/drm/performance/*` are
  already real/DB-backed. Verify, don't rebuild.
- Monthly Complete Project reuses `/api/dd-executive/monthly-complete` (period
  param only — no team/customer/type filters on the backend).
- Delay Project canonical page = `drm/delay-project.tsx` (source
  `/api/hod/projects/delayed`); `drm/delay-projects-new.tsx` is a deprecated alias
  that re-exports the canonical page.

## Conventions
- New tables created via raw idempotent DDL in an `ensure*Table()` AWAITED at
  registration (un-awaited DDL races first requests). `shared/schema.ts` is NOT
  touched for these — raw `pool.query` only.
- Scoping mirrors penalty-routes: full-access (admin/super_hod) & HR see all;
  HOD/managerial see their department (+self); everyone else sees own.

## Pitfall
**Every mutating endpoint needs an explicit role gate, not just per-row scope.**
A create handler that only checks "can I view this target user" still lets any
authenticated user create records for themselves. Financial/workflow creates
(e.g. commission verifications) must gate on role (`canCreate` = full-access /
HOD / managerial) before insert.
