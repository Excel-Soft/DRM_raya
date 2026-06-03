# Project Report Feature — Changelog

D&D Manager → **Project Report**. Converts the previous mock page
(`pms-project-report.tsx`) into a real, DB-backed report. Additive only: no new
DB tables, no changes to existing business workflows, approval logic, roles,
permissions, or APIs beyond the additions listed here.

## Files changed

### Backend (new)
- `server/services/project-report.service.ts` — `listProjectReport()`. Raw,
  parameterized SQL. One row per project (`drm.projects` as the base table).
  `LEFT JOIN`s to `customers`, `users` (owner), `project_financials`, and the
  product/software workflow tables; `LATERAL` subqueries for project details,
  document count, payments, and task aggregates (P15 count, remaining =
  count of tasks not in Done/Completed, earliest start date); `LATERAL`
  company-name matches (case-insensitive, latest) for
  `product_posting_invoices`, `gm_entries`, `bv_entries`, and `invoices`.
  Date filter on `COALESCE(c.created_at, p.created_at)` within `[startDate,
  endDate]`; optional `companyName` and `search` filters; the page and the
  total count run as two queries against a shared CTE (so an out-of-range page
  still reports the correct total); offset/limit pagination. Returns mapped
  rows (22 fields + `rowNumber`).
- `server/project-report-routes.ts` — `handleProjectReport` shared handler
  (validates dates `YYYY-MM-DD`, `start <= end`, `page >= 1`, `limit` in
  {10, 25, 50, 100}; access gate `canViewProjectReport` = managerial roles
  only, executives → 403). `registerProjectReportRoutes` mounts
  `GET /api/dd-manager/project-report` and `GET /api/reports/projects`.
  Response shape: `{ filters, rows, pagination }`.

### Backend (modified)
- `server/pms-routes.ts` — the existing `GET /api/pms/project-report` handler
  body now delegates to `handleProjectReport` (import added). No route added or
  removed; the existing alias simply serves real data.
- `server/routes.ts` — imported and mounted `registerProjectReportRoutes(app)`.
  **Important:** mounted *before* `registerReportsRoutes(app)` so the exact
  path `/api/reports/projects` is matched before the reports router's
  parameterized `/reports/:type` route (which otherwise returned
  `{"error":"Invalid report type"}`). Mounted after the auth / IP /
  URL-permission middleware so all routes require an authenticated user.

### Frontend (modified)
- `client/src/pages/pms-project-report.tsx` — fully rebuilt. Removed the
  `REPORT_MOCK` constant. Real `useQuery` against
  `/api/dd-manager/project-report`. Filter card (Company name, Start date,
  End date, green **View** button, client-side validation). "Show entries"
  dropdown + Search box + pagination footer ("Showing X to Y of Z",
  Previous / numbered pages / Next). Horizontal scroll. Exact 22 columns
  (see below). Dates rendered `DD-MM-YYYY`; `-` / `0` fallbacks for missing
  values.
- `client/src/pages/reports-projects.tsx` — re-export of
  `pms-project-report` (single source of truth).
- `client/src/App.tsx` — added route `/dd-manager/project-report`.
- `client/src/pages/dd-manager-dashboard.tsx` — both "Project Report" entry
  points now navigate to `/pms/project-report` (previously pointed at
  `/analytics/user-activity`).
- `client/src/components/app-sidebar.tsx` — added "Project Report" under the
  PMS menu.

### Deliverable
- `PROJECT_REPORT_CHANGELOG.md` — this file.

## APIs added / modified
- **Added:** `GET /api/dd-manager/project-report` (primary).
- **Added:** `GET /api/reports/projects` (compatibility alias; same handler).
- **Modified:** `GET /api/pms/project-report` — now delegates to the shared
  handler and returns real data (route signature unchanged).

Query params (all three): `startDate` (req, `YYYY-MM-DD`), `endDate` (req,
`YYYY-MM-DD`), `companyName` (opt), `search` (opt), `page` (opt, default 1),
`limit` (opt, one of 10/25/50/100, default 10).

Response: `{ filters, rows, pagination: { page, limit, total, totalPages } }`.

## Route fixes
- `/api/reports/projects` was being shadowed by the reports router's
  `/reports/:type` parameterized route (returned `Invalid report type`). Fixed
  by mounting `registerProjectReportRoutes(app)` *before*
  `registerReportsRoutes(app)` in `server/routes.ts`.
- Dashboard "Project Report" buttons previously routed to
  `/analytics/user-activity`; corrected to `/pms/project-report`.

## How to test in the UI
1. Run the app (`npm run dev`, port 5000) and sign in as a managerial user
   (e.g. the dev admin).
2. Open **PMS → Project Report** from the sidebar, or **D&D Manager
   dashboard → Project Report**, or go to `/pms/project-report` /
   `/dd-manager/project-report`.
3. Set a Start date and End date and click the green **View** button. The
   table loads real projects whose customer/project creation date falls in the
   range.
4. Use the Company name filter and the Search box to narrow results; use the
   "Show entries" dropdown and Previous/Next to page.
5. Sign in as an executive-role user — the report returns **403** and the data
   does not load.

## Source data
- Base: `drm.projects` (one row per project).
- Joined: `drm.customers`, `drm.users` (owner), `drm.project_financials`,
  product/software workflow tables, `drm.project_details`,
  `drm.documents` (count), `drm.payments`, `drm.tasks` (aggregates).
- Company-name matched (no FK): `drm.product_posting_invoices`,
  `drm.gm_entries`, `drm.bv_entries`, `drm.invoices`.

## Exact columns (22)
1. # (row number) · 2. ID · 3. Name · 4. Package · 5. Status · 6. Person ·
7. Customer Create Date · 8. GM Pay Date · 9. GM Doc · 10. BV Date ·
11. Invoice Date · 12. Receipt Date · 13. Method · 14. Project ·
15. Project Create Date · 16. Data Date · 17. HOD Date · 18. Dep Date ·
19. P15 · 20. Assign Date · 21. Finish · 22. Remaining.

## Known limitations
- `gm_entries`, `bv_entries`, `invoices`, and `product_posting_invoices` have
  no foreign key to projects, so the person / method / invoice / GM / BV
  columns are matched by **company name** (case-insensitive, latest record).
  This is inherently fragile when company names are duplicated or differ
  slightly across tables.
- No department-level row filtering is applied: a permitted managerial user
  sees all project records they are authorized to view, not a department
  subset.
- The Replit development database currently has no project/customer rows, so
  the report renders an honest empty state until data exists. (Verified
  end-to-end by temporarily seeding one customer + project, confirming the row
  rendered with correct enrichment, then removing the seed data.)

## Unresolved errors
- None introduced by this feature. `npm run check` reports 64 pre-existing
  TypeScript errors in unrelated files (`server/repositories/*`); none are in
  any project-report file.
