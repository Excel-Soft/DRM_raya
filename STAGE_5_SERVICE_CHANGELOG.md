# Stage 5 — Service Department Full Data Integration

This stage converts the Service Department's mock/empty pages into real,
API-backed workflows and reports. No service redesign was performed, no fake
service records were introduced, and unrelated modules (sales, PMS, product
posting) were left untouched. There is no external WhatsApp integration — the
follow-up "send" is a saved message-draft only. Central engines (leave, loan,
penalty) are reused; no parallel engines were built.

The database is currently empty, so every converted page renders **real-or-empty**
data — it never invents rows.

## Backend

### New files
- `server/utils/service-grade.ts` — grade normalization (free-text customer
  grades `A/A+/A-/B/B+/B-` → canonical keys `A`, `B_PLUS`, `B`, `B_MINUS`) plus a
  SQL predicate helper and a `isServiceGradeKey` validator.
- `server/repositories/service-reports.repository.ts` — raw, parametrized SQL
  reporting queries (all department-scoped):
  - `listCustomersByGrade`, `monthlyFollowups`, `notFollowed`,
    `dropouts` (with `weeklyOnly`), `dueVasPayments`, `listComplaints`,
    `dashboardCounts`.
  - `ensureComplaintColumns()` — idempotent `ALTER TABLE ... ADD COLUMN IF NOT
    EXISTS` for complaint lifecycle columns (`due_date`, `assigned_at`,
    `closed_at`, `reopened_at`).
- `server/repositories/service-documents.repository.ts` — `ensureTable()` +
  CRUD for BV/VAS documents. Attachments are stored as a name + http(s) URL
  (link metadata); there is **no file-upload storage** in this environment.
- `server/service-reports-routes.ts` — registers the reporting + document routes;
  runs `ensureComplaintColumns()` / `ensureTable()` on startup; validates grade
  keys, document types, verification statuses, and attachment URLs.

### Edited files
- `server/service-core-routes.ts` — complaints `GET` is now joined, paginated and
  filterable; added complaint create validation and the lifecycle PATCH endpoints
  (`/:id`, `/:id/assign`, `/:id/resolve` (remarks required), `/:id/close`,
  `/:id/reopen`) via parametrized SQL casting to the `drm.service_complaint_status`
  enum. Dropouts `GET` is now joined + paginated. Follow-up / renewal / GM-VAS-BV
  stubs preserved unchanged.
- `server/repositories/service-pool.repository.ts` — added `assign`, `transfer`
  and `recordMessageDraft` (append-only audit trail in `metadata.audit`).
- `server/service-pool-routes.ts` — added `PATCH /service-pool/:id/assign`,
  `PATCH /service-pool/:id/transfer`, `POST /service-pool/:id/message-draft`
  (draft only — nothing is sent externally).
- `server/routes.ts` — registered `registerServiceReportsRoutes`.

### Scoping & schema approach
- Every list endpoint scopes by user: managerial roles see their department
  (`getDepartmentFilterUserIds`), executives see their own records.
- All list responses use the shape `{ data, total, page, pageSize }`.
- Schema additions use raw `CREATE TABLE / ALTER TABLE ... IF NOT EXISTS`
  (mirroring the existing service-pool repository), **not** `drizzle-kit push`,
  to avoid drift on the imported schema.

## API endpoints
- `GET /api/service/customers?grade=A|B_PLUS|B|B_MINUS&page&pageSize&search&executive&status&dateFrom&dateTo`
- `GET /api/service/followups/monthly`, `GET /api/service/followups/not-followed`
- `GET /api/service/dropouts`, `GET /api/service/dropouts/weekly`,
  `GET /api/service/dropouts/report`
- `GET /api/service/complaints` · `POST /api/service/complaints`
- `PATCH /api/service/complaints/:id` · `/:id/assign` · `/:id/resolve` ·
  `/:id/close` · `/:id/reopen`
- `GET /api/service/payments/due`
- `GET /api/service/dashboard/counts`
- `GET/POST /api/service/documents` · `PATCH /api/service/documents/:id` ·
  `PATCH /api/service/documents/:id/verify` · `DELETE /api/service/documents/:id`
- `PATCH /api/sales/service-pool/:id/assign` · `/transfer` ·
  `POST /api/sales/service-pool/:id/message-draft`

## Frontend (19 pages converted)
All pages keep their exact existing UI shell (header, Copy/Excel/PDF, Column
visibility, Search, table, pagination footer) and now use `useQuery` /
`useMutation` + `apiRequestJson`, with real server-side pagination, search and
filters, and the standard "No data available in table" empty state.

- **Grade customers**: `service-a-customer`, `service-b-customer`,
  `service-b-plus-customer`, `service-b-minus-customer`, `service-grade-list`.
- **Follow-up / dropout reports**: `service-monthly-followup`,
  `service-not-follow-customer`, `service-dropout-customer`,
  `service-weekly-dropout`.
- **Complaints**: `service-complaint-list` — list + filters + full lifecycle
  (create, assign, resolve [remarks required], close, reopen).
- **Documents & payments**: `service-bv-document-list`,
  `service-vas-document-list` (CRUD + verify + delete; attachment-link helper
  text), `service-due-vas-payment` (read-only; null amounts render "—").
- **Pool & dashboards**: `service-public-pool` (real data + assign/transfer/
  message-draft actions), `service-assistant-manager-dashboard` (real counts
  from dashboard/counts). `service-manager-dashboard` already used real
  endpoints, so it was left unchanged.
- **Central engines**: `service-loan-application` → `/api/loans`,
  `service-leave-application` → `/api/leave`, `service-add-penalty` →
  `/api/penalties` (reused; no parallel engines).

## Notes & limitations
- DB is empty → pages render real-or-empty; no seeding was performed.
- No file-upload storage: BV/VAS document "attachments" are name + http(s) link.
- Due VAS payment amounts derive from the latest `service_renewals.amount` and
  may be null (rendered "—"); the `services` table has no price column.
- WhatsApp follow-up is a saved draft only; there is no external send.

## Verification
- `npm run check` — no new TypeScript errors introduced by this stage (the
  pre-existing baseline count is unchanged; all changed files are clean).
- `npm run build` — production build succeeds.
- App boots cleanly; the new DDL (`service_documents` table + complaint
  lifecycle columns) is confirmed present in the database.
