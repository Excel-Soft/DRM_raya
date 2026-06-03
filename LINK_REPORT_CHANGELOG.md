# LINK REPORT (Team Report submodule) — Changelog

Implements the **LINK REPORT** page as an exact, real, DB-backed replication of
the provided screenshot. Additive only — no existing business workflows, roles,
permissions, APIs, or DB business structure were changed.

## What was added

### Database (additive, applied to the live `drm` schema)
- `migrations/20260603_add_link_report_tables.sql`
- New table **`drm.link_reports`** — manual / future link submissions. Includes a
  serial `display_id` for a numeric ID, `submitted_by_user_id`, `company_name`,
  `link_url`, `source_module`, `source_record_id`, `submitted_at`, soft-delete
  `deleted_at`, and timestamps. Indexed on `submitted_by_user_id`, `submitted_at`,
  `deleted_at`.
- New table **`drm.link_report_commission_verifications`** — records a commission
  verification for a user + date range: `user_id`, `verified_by_user_id`,
  `start_date`, `end_date`, `link_report_ids` (jsonb), `total_links`,
  `reward numeric default 0`, `status default 'VERIFIED'`. Indexed on user,
  verifier, start/end dates.

### Schema typings
- `shared/schema.ts` — added Drizzle table definitions and types
  (`linkReports`, `linkReportCommissionVerifications`, plus select/insert types).
  Typing only; no changes to existing tables.

### Backend
- `server/services/link-report.service.ts` — all DB access for the report.
- `server/team-report-link-report-routes.ts` — Express routes, mounted in
  `server/routes.ts` **after** auth + IP + URL-permission middleware (same place
  as the increment/penalty routers), so every endpoint requires an authenticated
  user.

### Frontend
- `client/src/pages/posting-data-link-report.tsx` — rebuilt to use the real API
  (mock fallback removed). Adds the summary row (Total, Reward, Verify Commission)
  to match the screenshot.
- `client/src/App.tsx` — fixed the `/posting-data/link-report` route (it pointed
  at the generic `PostingData` page) to render `PostingDataLinkReport`, and added
  an alias route `/team-report/link-report`.

## Data source (how "real" data is produced)
Per the spec, workflow submission logic was **not** modified. The report reads
real data by normalizing a UNION of three existing/added sources, filtered by the
selected user and inclusive date range:
1. `drm.link_reports` (manual rows; future submissions)
2. `drm.product_posting_evidence_links` → joined `projects` → `customers`
3. `drm.software_evidence_links` → joined `projects` → `customers`

Each row is normalized to `{ id, displayId, company, links, date, sourceModule,
sourceRecordId }`. Company name is `customers.company_name` (falls back to the
project name, then `Unknown`).

### Display ID
- `link_reports` rows use their serial `display_id`.
- Evidence-link rows have UUID primary keys with no numeric id, so a **stable**
  numeric display id is derived from `md5(uuid)` (same UUID always maps to the
  same number). Raw UUIDs are never shown.

## API
Base path `/api/team-report/link-report` with a compatibility alias
`/api/posting-data/link-report` (matches the page URL). All require auth.
- `GET  /users` — active users for the dropdown (access-scoped).
- `GET  /?userId=&startDate=&endDate=` — normalized report rows + summary
  (`total`, `reward`, `commissionVerified`) + `canVerify`. Validates that dates
  are present (`YYYY-MM-DD`) and `startDate <= endDate`.
- `POST /verify-commission` — records a verification (reward defaults to 0).
  Submitted `linkReportIds` must all belong to the rows for that filter. Idempotent
  per user + date range.
- `POST /` — optional: create a manual link report row.

## Access control (backend-enforced)
- **admin / super_hod** (super_admin normalizes to admin): all users.
- **hod / managerial roles**: own department (+ self).
- **everyone else (executive)**: self only, and **cannot** verify commission.
- Verify Commission is allowed for full-access, HOD, and managerial roles; the
  frontend hides the button when `canVerify` is false and disables it once the
  range is already verified.

## Verification performed
- Migration applied to the live DB; both tables and all indexes confirmed.
- `npm run check`: no new TypeScript errors introduced (pre-existing unrelated
  errors in `server/repositories/*` remain untouched).
- Smoke tests against the running app (admin login):
  - `GET /users` returns the scoped user list; unauthenticated request → 401.
  - `GET /` returns `{ rows, summary, canVerify }`; rejects missing dates and
    reversed ranges with 400.
  - `POST /verify-commission` succeeds and a subsequent `GET` reports
    `commissionVerified: true`. (Test verification row was cleaned up afterward.)
  - Alias path `/api/posting-data/link-report/users` → 200.

## Notes
- No existing files were deleted. Backup/scratch files untouched.
- No secrets added; uses the Replit-provided PostgreSQL database.
