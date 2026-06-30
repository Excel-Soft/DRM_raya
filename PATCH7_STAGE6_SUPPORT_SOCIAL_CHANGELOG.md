# Patch 7 Stage 6 — Support Deactivation + Social Media Posting (Changelog)

Scope: **gap-closure, not rebuild.** Recon confirmed that Support deactivation
(SUP-001), Social Media Posting persistence + lifecycle (SOC-001), and the
external-provider stance (SOC-EXT-001) were already implemented and merged by
prior patches. This stage closed the remaining genuine gaps, made the support
flags explicit, verified end-to-end, and documented the result.

## What was already in place (verified, not rewritten)
- **SUP-001:** `isSupportModuleEnabled()` on both server (`server/feature-flags.ts`,
  `SUPPORT_MODULE_ENABLED`) and client (`client/src/lib/feature-flags.ts`,
  `VITE_SUPPORT_MODULE_ENABLED`); `client/src/App.tsx` gates `/support/*` to an
  inactive page; the sidebar hides Support; `server/routes.ts` short-circuits
  `/api/support/*` with `404` before auth when disabled.
- **SOC-001:** `drm.social_media_posts` + `drm.social_accounts` created via additive
  runtime DDL (`CREATE TABLE/INDEX IF NOT EXISTS`); full posts lifecycle API
  (list/get/create/patch/delete + submit-approval/approve/reject/schedule/publish/
  cancel + export); accounts full CRUD canonical at `/api/drm/social-accounts` and
  aliased verbatim at `/api/social-media/accounts`; validation (invalid/past
  `scheduledAt` → 400; reject & cancel require a reason; publish requires APPROVED
  unless FULL override + explicit `confirmManual`); audit via
  `AuditLogService.record` / `recordTransition`; notifications to approver/creator/
  owner across transitions.
- **SOC-EXT-001:** publish is **internal/manual only**, honestly labeled, with no
  external provider calls; no credential/secret columns on accounts.

## Files changed this stage
- `server/social-media-routes.ts` — **added** `GET /api/social-media/dashboard/summary`
  (read-only aggregate counts; reuses `buildListQuery` for identical RBAC scope +
  filters; no DDL, no side effects). Nothing else in this file was modified.
- `client/src/pages/social-media.tsx` — **added** a stat-cards row fed by the
  summary endpoint (real totals, loading/error states), a scheduled date-range
  filter (`scheduledFrom`/`scheduledTo`, inclusive end-of-day `to`), and summary
  cache invalidation on mutations. No existing controls were removed or rewritten.
- `SOCIAL_MEDIA_POSTING_WORKFLOW.md`, `SUPPORT_MODULE_DEACTIVATION_NOTES.md` —
  updated with the Patch 7 Stage 6 additions.
- New docs: this changelog, `SOCIAL_MEDIA_EXTERNAL_PROVIDER_DECISION.md`,
  `SOCIAL_MEDIA_QA_MATRIX.md`.

## APIs added / modified
- **Added:** `GET /api/social-media/dashboard/summary`
  - Auth required (`401` otherwise).
  - Response shape:
    ```json
    {
      "total": 0,
      "approval":  { "DRAFT":0, "PENDING":0, "APPROVED":0, "REJECTED":0 },
      "publishing":{ "DRAFT":0, "SCHEDULED":0, "READY":0, "PUBLISHED":0, "FAILED":0, "CANCELLED":0 },
      "upcomingScheduled": 0
    }
    ```
  - RBAC-scoped and filterable exactly like `GET /api/social-media/posts`
    (minus pagination).
- **No other endpoints were added or modified.** No duplicate endpoints were
  introduced.

## DB changes
- **None.** No schema changes, no migrations, no runtime DDL were needed this
  stage (the tables already exist). `db:push` remains unused (known-broken on a
  pre-existing unrelated FK mismatch).

## Environment changes
- Set in Replit-managed **shared** env (non-secret boolean config):
  - `SUPPORT_MODULE_ENABLED=false`
  - `VITE_SUPPORT_MODULE_ENABLED=false`
- These were previously unset (which already meant "disabled"); they are now
  explicit so the deactivated state is self-documenting. Behaviour unchanged.

## Support behavior (after this stage)
- Module is **OFF**. `/api/support/*` → `404` (before auth). `/support/*` client
  routes render the inactive page. Support is hidden in the sidebar for all roles.
- Re-enable = set both flags to `"true"` and restart (no code changes).

## Social Media behavior (after this stage)
- Persistence, approval/publishing lifecycle, validation, audit, and notifications
  are unchanged and confirmed working.
- The page now shows **honest, scoped dashboard counts from the API** (not derived
  from a paginated list) and supports filtering posts by a scheduled date range.

## External provider decision
- See `SOCIAL_MEDIA_EXTERNAL_PROVIDER_DECISION.md`. Decision: **no external
  publishing provider** (no Meta/X/LinkedIn/etc. API, no WhatsApp/SMS/email).
  Publishing is recorded as internal/manual and labeled as such in both the API
  response (`publishMode: "MANUAL_INTERNAL"`, `publishNote`) and the UI. No code
  claims a post was sent to any external platform.

## Tests run
- `npm run check` (tsc) → **pass** (clean, exit 0).
- Minted-JWT smoke suite (admin + low-privilege roles, against `localhost:5000`)
  → **23/23 passed**. See `SOCIAL_MEDIA_QA_MATRIX.md` for the full matrix. Smoke
  artifacts were removed after the run; test posts were soft-deleted in cleanup.

## Unresolved issues
- None for this stage's scope. The backend `createdBy` filter is intentionally not
  surfaced in the UI (no safe scoped users-source) — documented, not a defect.
