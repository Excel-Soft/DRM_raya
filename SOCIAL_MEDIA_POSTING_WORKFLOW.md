# Social Media Posting — Workflow (Patch 6 Stage 6 verification)

This documents the **already-implemented and merged** Social Media Posting
feature (verified in Stage 6, not rewritten). Source:
`server/social-media-routes.ts` and `server/social-accounts-routes.ts`, mounted
in `server/routes.ts` via `registerSocialMediaRoutes` / `registerSocialAccountsRoutes`.

## Two parts

### 1. Social accounts (`/api/social-accounts`)
Directory of the accounts the business posts from.

- Columns: `owner_name`, `platform`, `account_name`, `url`, `customer_id`,
  `project_id`, `status`, `created_by`, soft-delete (`deleted_at`).
- **No credential columns** — passwords, tokens, API keys, or secrets are
  **not** stored. This satisfies the "no plaintext social credentials"
  constraint by design.
- Endpoints: `GET` (list, filterable by `status`), `POST` (create),
  `PATCH /:id` (edit incl. status toggle), `PATCH /:id/verify`, `DELETE /:id`
  (soft delete). All require an authenticated user; edits/deletes enforce an
  ownership/authorization check; mutations are audit-logged
  (`drm.social_account.*`).
- `status` is constrained to a fixed set (e.g. `active` / inactive states).
- Schema is created at runtime with `CREATE TABLE IF NOT EXISTS` +
  `CREATE INDEX IF NOT EXISTS` (additive, non-destructive).

### 2. Social posts (`/api/social-media` posts)
The post content and its approval / publishing lifecycle.

Two independent server-enforced state machines:

- **approval_status:** `DRAFT → PENDING → APPROVED | REJECTED`
  (`REJECTED → PENDING` to resubmit).
- **publishing_status:** `DRAFT → READY → SCHEDULED → PUBLISHED`
  (plus `FAILED`, `CANCELLED`).

Key rules (enforced in the routes, not just the UI):
- Submit (`DRAFT|REJECTED → PENDING`) resets publishing to `DRAFT`.
- Approve (`PENDING → APPROVED`) sets publishing to `READY`.
- Reject (`PENDING → REJECTED`) sets publishing back to `DRAFT`.
- Non-privileged authors can only edit posts in `DRAFT` / `REJECTED`.
- Every transition is recorded via `AuditLogService.recordTransition`; creates
  via `AuditLogService.record`.
- List supports filtering by `approval_status` / `publishing_status` and an
  export endpoint exists.
- Schema (`drm.social_media_posts`) is created at runtime with
  `CREATE TABLE / INDEX IF NOT EXISTS` (additive).

## Frontend
The Social Media pages persist via these APIs (create, list, submit, approve,
reject, publish), so the controls are real — there are no dead buttons.

## Constraint check
- No plaintext social credentials are stored (no credential columns exist).
- No duplicate posting engine was introduced in Stage 6; this feature was only
  verified.

## Patch 7 Stage 6 — additions (gap-closure, no rewrite)

The posting/accounts engine, lifecycle, validation, audit and notifications were
**not** rewritten. The only additions this stage:

### Dashboard summary endpoint (new)
- `GET /api/social-media/dashboard/summary` — read-only, **NOT paginated**.
  Returns honest aggregate counts taken straight from `drm.social_media_posts`
  (`deleted_at IS NULL`):
  - `total`
  - `approval` counts: `DRAFT` / `PENDING` / `APPROVED` / `REJECTED`
  - `publishing` counts: `DRAFT` / `SCHEDULED` / `READY` / `PUBLISHED` / `FAILED`
    / `CANCELLED`
  - `upcomingScheduled` (= `publishing_status='SCHEDULED' AND scheduled_at >= now()`)
- It **reuses `buildListQuery(req)`**, so it applies the *same RBAC scope* as
  `GET /posts` (FULL/HR see all; HOD/managerial see their department; everyone
  else sees only their own) and the *same filters* (platform, account,
  approvalStatus, publishingStatus, createdBy, scheduledFrom/To, search) — only
  pagination is dropped. Counts can never leak cross-scope rows and are never
  fabricated.
- Returns `401` when unauthenticated.

### Frontend (`client/src/pages/social-media.tsx`)
- A stat-cards row (Total / Pending Approval / Approved / Scheduled / Published /
  Upcoming) is fed **directly by the summary endpoint** — not derived from the
  paginated list — so the numbers are real totals, not page subtotals. The cards
  show a loading glyph while fetching and a `—` placeholder on error (no fake
  zeros).
- A **scheduled date-range filter** (`scheduledFrom` / `scheduledTo`) was added;
  the backend already supported these query params. The `to` bound is sent as
  end-of-day so the range is inclusive. The same range is applied to both the
  list and the summary so the cards and the table stay consistent.
- A **"Created By" filter UI was intentionally not added.** The backend
  `createdBy` query param exists, but there is no scoped users-source the page
  can safely populate from, and shipping an empty/unscoped dropdown would be a
  dead control. The param remains available for API consumers and is documented
  here instead.
- Mutations now also invalidate the summary query so the cards refresh after
  create / submit / approve / reject / schedule / publish / cancel / delete.

### Accounts alias (verified, unchanged)
- `/api/social-media/accounts` is registered **verbatim** from the canonical
  social-account handlers (`registerSocialAccountHandlers`). It is an alias, not a
  duplicate implementation — same handlers, same audit, same authorization.
