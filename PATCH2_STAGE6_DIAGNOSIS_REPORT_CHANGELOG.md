# Patch 2 — Stage 6: Diagnosis Report

## Goal
Fix `/reports/diagnose` so it is a real, honest **Diagnosis Report** and no longer
borrows Business Volume (BV) / Gross Margin (GM) data.

### Before (the bug)
- The page fetched `/api/reports/bv` (Business Volume) and rendered BV/GM figures
  under a "GM View" heading.
- When the API failed it silently fell back to mock/placeholder rows.
- There was no real diagnosis data source at all.

### After
- A dedicated, honest endpoint backed by its own table. **No** call to
  `/api/reports/bv`, **no** BV/GM numbers, **no** "GM View" heading, **no** mock
  fallback. Empty data shows an honest empty state; failures show an error + retry.

## Backend

### New data source — `drm.diagnosis_reports`
A dedicated table (NOT a reuse of `service_complaints` or BV data — diagnosis is its
own business concept; reusing an unrelated table would be an anti-pattern).

Columns: `id` (uuid pk), `customer_id`, `company_name`, `person_name`,
`diagnosis_type`, `diagnosis_status` (default `OPEN`), `diagnosis_date`,
`assigned_to`, `branch`, `department`, `notes`, `created_by`, `created_at`,
`updated_at`, `deleted_at`. Indexes on `assigned_to`, `diagnosis_date`,
`diagnosis_status`.

- `shared/schema.ts`: added `diagnosisReports` table + `insertDiagnosisReportSchema`
  + `DiagnosisReport` / `InsertDiagnosisReport` types (after the service-renewal
  schema).
- `server/db/ensure.ts`: added `ensureDiagnosisSchema(client)` (idempotent
  `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`), wired into the boot
  sequence after `ensureSalarySchema(client)`. (`db:push` is broken repo-wide, so
  schema is applied at runtime — consistent with existing stages.)

### New routes — `server/diagnosis-report-routes.ts`
Registered in `server/routes.ts` via `registerDiagnosisReportRoutes(app)` **before**
`registerReportsRoutes(app)` so `/api/reports/diagnose` wins over the
`/reports/:type` catch-all.

- `GET /api/reports/diagnose` — scoped, filtered, paginated list + status summary.
- `GET /api/reports/diagnose/export` — CSV honoring the same scope + filters; gated
  by `canExport` (admin / super_hod / account_manager / hod). Date column formatted
  `YYYY-MM-DD`.
- `POST /api/reports/diagnose` — create a record (`created_by` = caller; own-only
  callers may only assign to themselves). Backs QA and future data entry.
- `PATCH /api/reports/diagnose/:id` — edit within the caller's scope; out-of-scope
  rows return 404 (no existence leak).

### Authorization (from the signed JWT only)
Derived from `req.user.roleId` / `req.user.roles` (normalized) — never from the
client-supplied `x-acting-role` header. Row scope:
- `admin` / `super_admin` (→ admin) / `super_hod` / `account_manager` → **all** rows.
- `hod` + managerial roles → **team** (own department: assigned/created/department).
- everyone else → **own** (assigned-to or created-by self).

### Honest failures (400 not 500)
All uuid filters (`customerId`, `userId`) and `status` are validated before they
touch a typed column, and an inverted date range is rejected — each returns a 400
with a clear message instead of a Postgres 22P02 500.

### Response shape
```
{
  filters:    { scope: "all" | "team" | "own" },
  rows:       [{ id, diagnosisDate, companyName, customerName, personName,
                 diagnosisType, status, assignedToName, branch, department,
                 notes, createdByName }],
  summary:    { total, byStatus: { OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED } },
  pagination: { page, limit, total, totalPages }
}
```

## Frontend — `client/src/pages/reports-diagnose.tsx`
Rewritten end to end:
- Title **"Diagnosis Report"**, section heading **"Diagnosis View"**.
- Filters: person (dropdown via `/api/account/users-list`), date range, status,
  diagnosis type, branch, department.
- Table columns: #, Date, Company/Customer, Person, Diagnosis Type, Status,
  Assigned To, Branch, Notes, Created By.
- Loading, empty, error + retry, and client-side date-range validation states.
- CSV export that honors the active filters.
- Uses the shared `apiRequestJson<T>`, `buildReportQueryParams`, and
  `validateDateRange` helpers. **No** BV/GM data, **no** mock fallback.

## Assumptions
- Diagnosis is a distinct business concept, so a dedicated `drm.diagnosis_reports`
  table is correct rather than overloading an existing table.
- Status vocabulary: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`
  (`OPEN` default).
- Export permission follows the established report matrix (admin / super_hod /
  account_manager / hod).
- No dedicated diagnosis *creation* UI was in scope; `POST` exists for QA and future
  entry.

## Verification
- `npx tsc --noEmit`: **57** errors — unchanged baseline, **zero** in the new/edited
  files.
- Live smoke tests against the running server (JWT minted with the app's own secret):
  1. admin `GET` empty list → `scope: "all"`, zeroed summary.
  2. admin `POST` create → `201 { success, id }`.
  3. admin `GET` → row with joined `assignedToName` / `createdByName` / company.
  4. admin `PATCH` status → `RESOLVED` → `{ success: true }`.
  5. `?status=RESOLVED` → summary `RESOLVED: 1`; `?status=OPEN` → 0 rows.
  6. `?customerId=not-a-uuid` → **400**; inverted date range → **400**.
  7. admin `GET /export` → CSV with correct headers + `YYYY-MM-DD` date.
  8. executive `GET` → `scope: "own"`, sees only their assigned row.
  9. executive `GET /export` → **403**.
  10. no token → **401**.
