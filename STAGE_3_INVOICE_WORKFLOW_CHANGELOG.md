# Stage 3 — Invoice Approval Workflow (Changelog)

Adds a strict approval state machine on top of the existing
`drm.product_posting_invoices` table: Sales → HOD → Account → PMS, with field
validation, duplicate prevention, payment validation, full audit history, and
reliable PMS pending-project linkage. Backend is the security boundary;
frontend changes are minimal and only on screens already using the workflow.

See `INVOICE_STATE_MACHINE.md` for the states, transitions, roles, and the full
endpoint list.

## What changed

### Database (additive only, no data loss)
- New optional columns on `product_posting_invoices`: `currency`,
  `invoice_date`, `payment_terms`, `service_type`, `service_package`,
  `source_module`, `source_id`, `receipt_reference`, `paid_amount`,
  `paid_date`, `rejection_reason`, `notes` (mirrored in `shared/schema.ts`).
- Applied via a runtime `ensureInvoiceWorkflowSchema()` (ALTER TABLE ADD COLUMN
  IF NOT EXISTS) — the repo convention — because a pre-existing unrelated
  foreign-key type mismatch makes a full `drizzle-kit push` impossible.

### Backend
- `server/services/invoice-workflow.service.ts` (new): the single owner of all
  transitions. Enforces legal transitions (400), correct role/stage (403),
  fail-closed duplicate prevention with audited admin/manager override (409),
  payment reconciliation, per-status field whitelisting, audit logging of every
  action, and PMS-manager notification + project-link lookup on account approve.
- `server/validators/invoice.validators.ts`: added workflow create / decision /
  mark-paid / cancel / patch schemas (positive amount, required customer +
  service, required rejection reason, payment fields).
- `server/routes/invoice-routes.ts`: rewritten to expose the full
  `/api/invoices/...` surface, all delegating to the service. The legacy
  `PUT /api/invoices/:id/approve` is kept as a thin alias that routes to the
  correct stage handler, so the existing approvals widget keeps working.

### Frontend (minimal)
- `product-posting-approvals-widget.tsx`: queues strictly by stage, calls the
  proper stage endpoints, requires a rejection reason, shows success/error
  toasts, refreshes after actions, and adds an invoice history dialog.
- `product-posting-sales-widget.tsx`: added a required customer selector (create
  now requires a customer), positive-amount input, replaced all `alert()` calls
  with toasts, and surfaces create/upload errors.

## Reuse / no duplication
- Audit history reuses `AuditLogService` → `drm.activity_logs` (no new table).
- PMS linkage reuses `projectsRepository.findPendingInvoices()` (which already
  surfaces `APPROVED` invoices with no project) — no duplicate conversion logic.
- Notifications reuse `NotificationService`.
- Stage 4 (workflow-transition service) is out of scope and untouched.

## Verification
- `tsc --noEmit` stays at the pre-existing baseline (no new type errors).
- End-to-end API smoke test (admin token) confirmed: zero/negative & missing
  customer rejected; valid create → PENDING_HOD; duplicate blocked (409);
  override requires reason; illegal mark-paid blocked; HOD→Account→APPROVED→PAID
  happy path; wrong-stage actions 403; payment amount reconciliation; reject
  requires reason; history chain and export return correctly. Smoke-test rows
  were removed afterward.
