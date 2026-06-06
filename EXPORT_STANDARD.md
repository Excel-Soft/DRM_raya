# Export Standard

Rules and current status for report/data exports (CSV / Excel / PDF) in the
active app.

## Rules

1. **Real backend data only.** Exports must serialize data fetched from the
   backend (DB-backed). Never export mock/hardcoded/static placeholder rows.
2. **Respect active filters.** The export must reflect the same filters
   (date range, status, owner, company, search, etc.) the user currently has
   applied to the on-screen view.
3. **Respect role access.** Exports go through the same authenticated, RBAC-
   gated endpoints as the underlying view; a user can only export what they can
   see.
4. **Descriptive filenames.** Include the report name and a timestamp (and date
   range where relevant), e.g. `gm_report.csv`, `attendance_2026-06.xlsx`.
   `client/src/lib/export-utils.ts` standardizes timestamped filename
   generation.
5. **Column fidelity.** Do not export hidden columns unless the user explicitly
   chose to show/select all columns.
6. **User feedback.** Show a success or error toast on completion/failure.

## Helpers

- `client/src/lib/export-utils.ts` — `exportToCSV`, `exportToExcel` (xlsx),
  `exportToPDF` (jspdf + autotable); timestamped filenames.
- `client/src/lib/performance-export.ts` — multi-sheet Excel + structured PDF
  for performance reports.
- `server/reports-routes.ts` — server-side CSV exports built from real,
  filtered DB queries (`Content-Type: text/csv`,
  `Content-Disposition: attachment; filename="..."`).

## Per-report status

| Report | Path (frontend / endpoint) | Data | Filters | Format | Status |
|---|---|---|---|---|---|
| Salary | `pages/salary-report.tsx` | Real DB | dates | CSV/Excel | OK |
| Account ledger | `/api/reports/ledger/export-csv` | Real DB | company, dates | CSV | OK |
| Office expenses | `pages/office-expenses.tsx` | Real DB | search, dates | CSV/Excel | OK |
| GM report | `pages/gm-report-new.tsx`, `/api/reports/gm-entries/export-csv` | Real DB | date range | CSV | OK |
| BV report | `/api/reports/bv-reports` | Real DB | date range | JSON→CSV | OK |
| Refund report | `/api/reports/refund-entries/export-csv` | Real DB | date range | CSV | OK |
| Project report | `/api/reports/projects` | Real DB | status, owner | CSV | OK |
| Completed projects | `pages/pms-completed-projects.tsx` | Real DB | search | CSV | OK |
| Performance | `pages/drm/performance.tsx` | Real DB | user, date | PDF/Excel | OK |
| In-service (VAS) | `pages/reports-in-service.tsx` | Real DB | user, date | JSON→CSV | OK |
| Customer management | `pages/customer-management.tsx` | Real DB | status, grade, pool | CSV | OK |
| Attendance | `pages/attendance-report.tsx` | Real DB | date, user | CSV/Excel | OK |
| Loan report | `/api/reports/loan` | Real DB | date range, user | CSV/Excel | OK |
| Lead import template | `/api/leads-import/template` | Static template (by design) | — | CSV | OK (template, not data) |
| **Service commission verifications** | `pages/service-commission-verifications.tsx` | **Mock/static** | none | CSV | **VIOLATION — to fix** |
| **Service dropout / follow-up** | `pages/service-dropout-customer.tsx` (+ siblings) | **Mock/hardcoded** | none | CSV | **VIOLATION — to fix** |
| **Due VAS payment** | `pages/service-due-vas-payment.tsx` | **Mock** | none | CSV | **VIOLATION — to fix** |

## Known violations (deferred)

The three service-module pages above export mock/hardcoded data. They predate
Stage 9 and were **not** modified here — rebuilding their data layers (and the
backing endpoints/tables) is out of Stage 9 scope and would risk breaking the
service module. They should be migrated to real, filtered backend endpoints in
a dedicated service-module pass, after which their status moves to OK.

> Note: the DRM commission-verification flow (`drm.commission_verifications`,
> Stage 7) is real DB-backed and separate from the mock
> `service-commission-verifications.tsx` page listed above.
