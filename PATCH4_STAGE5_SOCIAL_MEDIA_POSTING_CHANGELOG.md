# Patch 4 Stage 5 — Social Media Posting Workflow Repair (Changelog)

Repairs ISS-03 (P1): the Social Media Posting page was a mock, local-only screen
with no persistence, no API, no auth, no roles, and no posting lifecycle. This
stage replaces it with a real, persisted, auth-protected posting workbench.

Guardrails honored: reuses `drm.social_accounts`; adds `drm.social_media_posts`
(additive); **no** external provider API; **no** plaintext secrets; **no** fake
publish success; **no** mock/local-only data.

---

## Files changed

### Added
- `server/social-media-routes.ts` — the full posts lifecycle API, the accounts
  alias wiring, server-side status machines, role gating, audit and notifications,
  and `ensureSocialMediaPostsTable()` (runtime idempotent DDL — `db:push` is
  broken repo-wide).
- `PATCH4_SOCIAL_POSTING_CURRENT_STATE.md` — pre-repair recon.
- `PATCH4_STAGE5_SOCIAL_MEDIA_POSTING_CHANGELOG.md` — this file.

### Modified
- `shared/schema.ts` — added the `socialMediaPosts` table definition (additive;
  `linked_project_id` is `text` to match the existing project-id convention and
  avoid varchar/uuid 500s).
- `server/social-accounts-routes.ts` — refactored so the account handlers can be
  mounted on any base path: exported `ensureSocialAccountsTable` and a new
  `registerSocialAccountHandlers(app, base)`; the canonical
  `registerSocialAccountsRoutes` now mounts those handlers on
  `/api/drm/social-accounts` (behavior unchanged — no rewrite of the accounts page).
- `server/routes.ts` — registers `registerSocialMediaRoutes(app)` after
  `registerSocialAccountsRoutes`, behind the existing auth + URL-permission
  middleware.
- `client/src/pages/social-media.tsx` — rebuilt from a mock/local-only screen into
  a real API-backed workbench (list/filters/search/pagination, create/edit dialog,
  role/status-gated row actions, status badges, failure/rejection/cancel reasons,
  loading/empty/error states, CSV export). Uses `apiRequestJson` (throws on non-2xx
  so failures surface honestly); success toasts only fire after the API succeeds;
  queries are invalidated after every mutation.

---

## Database — `drm.social_media_posts` (additive)

Created at boot by `ensureSocialMediaPostsTable()` (which first ensures the
`drm.social_accounts` FK target). Columns: `id` (uuid pk), `platform`,
`social_account_id` (FK → social_accounts, ON DELETE SET NULL), `title`, `content`,
`media_url`, `media_name`, `linked_customer_id` (FK → customers, SET NULL),
`linked_project_id` (text), `scheduled_at`, `published_at`, `approval_status`
(default `DRAFT`), `publishing_status` (default `DRAFT`), `failure_reason`,
`rejection_reason`, `cancel_reason`, `external_ref`, `created_by`/`approved_by`/
`published_by` (FK → users, SET NULL), `created_at`, `updated_at`, `deleted_at`
(soft delete). Indexes on `created_by`, `social_account_id`, `approval_status`,
`publishing_status`, `scheduled_at`, `deleted_at`.

---

## API (all under `/api/social-media`, auth-required)

Accounts alias (reuses the canonical social-account handlers verbatim):
- `GET/POST/PATCH/DELETE /accounts*` → same behavior as `/api/drm/social-accounts`.

Posts:
- `GET /posts` — paginated, filtered, scoped list → `{ data, total, page, pageSize }`.
  Filters: `platform`, `socialAccountId` (a.k.a. `account`), `approvalStatus`,
  `publishingStatus`, `createdBy`, `scheduledFrom`/`scheduledTo`, `search`,
  `page`/`pageSize`.
- `GET /posts/export` — CSV honoring the same filters (registered **before** `/:id`).
- `GET /posts/:id` — single post (scoped).
- `POST /posts` — create a `DRAFT` (any authenticated user, owned by self).
- `PATCH /posts/:id` — edit (DRAFT/REJECTED only, unless FULL).
- `POST /posts/:id/submit-approval` — DRAFT/REJECTED → PENDING.
- `POST /posts/:id/approve` — PENDING → APPROVED (+ publishing READY).
- `POST /posts/:id/reject` — PENDING → REJECTED (reason required).
- `POST /posts/:id/schedule` — APPROVED + READY/SCHEDULED → SCHEDULED (future date).
- `POST /posts/:id/publish` — manual/internal publish → PUBLISHED.
- `POST /posts/:id/cancel` — non-published → CANCELLED (reason required).
- `DELETE /posts/:id` — soft delete (owner-scope or FULL).

State machines are enforced server-side and return **409** on an illegal
transition, **400** on invalid input, **403** on a permission failure, **404** for
missing/soft-deleted rows.

---

## Publish behavior (honest)

No external provider is configured, and none was added. `publish` requires explicit
confirmation (`confirmManual: true`) and records an **internal, manually-confirmed**
publication: it sets `publishing_status = PUBLISHED`, `published_by`, `published_at`,
clears any `failure_reason`/`external_ref`, and the response is labeled
`publishMode: "MANUAL_INTERNAL"` with a `publishNote` stating it was recorded
internally and **not** posted to any external platform. It never fabricates
external success. A post must be `APPROVED` to publish unless the caller is FULL
(admin/super_hod) using the documented override.

---

## Permissions

- **FULL** (`admin`, `super_hod`): everything, including publish without approval
  and editing in any status; may approve own posts; global scope.
- **Posting/social managers** (`product_posting_manager`, `dd_manager`,
  `marketing_manager`, `seo_smm_manager`): create, and **manage** (edit / schedule /
  submit / publish-when-APPROVED / cancel / soft-delete) posts within their
  **department**. They are **not** approvers — they cannot approve or reject.
- **APPROVERS** = FULL + **HOD** only. A HOD may approve/reject posts created by a
  member of **their own department** (not their own post), but a HOD does **not**
  get management rights over department posts — a HOD manages only the posts they
  personally own.
- **Everyone else** (executives, etc.): create/edit/submit/cancel/delete their
  **own** drafts; view their own posts.
- Two distinct scope checks back this: a **view** scope (reuses the department-based
  "allowed user ids": FULL = all, HOD/managerial = department, otherwise self) used
  by list/get/approve/reject, and a tighter **management** scope (FULL = all,
  posting-manager = department, otherwise self) used by edit/schedule/submit/cancel/
  delete. Approve, reject, get-by-id and the management actions all re-verify scope
  on the target row, so an approver or manager cannot act on a post outside their
  department by guessing its id. Self-approval is blocked for non-FULL roles. The
  URL-permission middleware default-allows unmapped paths, so these per-handler
  guards are the real enforcement.

Every mutation is audited (`AuditLogService.record` / `recordTransition`, module
`social_media`, entityType `drm_social_media_post`) and notifies the relevant
parties (approvers on submit; creator on approve/reject/schedule/publish/cancel).

---

## Tests / verification

- `npm run check` (tsc): **0 errors**.
- `npm test` (vitest): **154 passed** (no regressions).
- Runtime API smoke (minted JWTs against the live server, **26 assertions** incl.
  the required cases and the department-scope cases): unauth → 401; create DRAFT →
  201; submit → PENDING; **cross-department HOD approve → 403** while **same-department
  HOD approve → 200**; **posting manager approve → 403** (not an approver);
  self-approval (non-FULL) → 403; **cross-department manager edit → 403** while
  **same-department manager edit → 200**; **HOD edit a department post (not own) →
  403** (HOD has no management scope); **cross-department view by id → 403** while
  same-department / admin view → 200; publish-without-confirm → 400; manual publish →
  PUBLISHED + `MANUAL_INTERNAL` label; publish-before-approve (non-FULL) → 409;
  **cross-department cancel → 403** while same-department manager cancel → 200;
  cross-department reject → 403; reject-without-reason → 400; reject-with-reason →
  REJECTED; FULL approve-own → 200; FULL publish-unapproved → 200; soft-delete hides
  from get (404). **All 26 passed.**
- Frontend: tsc clean and the dev server HMR-compiled the rebuilt page without
  errors.

---

## Unresolved / notes

- Publishing is internal/manual by design (no provider integration in scope). When
  a provider is later connected, `external_ref`/`failure_reason` and a `FAILED`
  publishing state already exist to carry real results.
- `npm run db:push` remains broken repo-wide (pre-existing FK mismatch), so the new
  table is created via runtime ensure-DDL, consistent with sibling tables.
- The pre-existing `tsc` baseline is clean for this work (0 errors); no unrelated
  errors were introduced.
