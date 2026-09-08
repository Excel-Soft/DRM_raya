# Stage 3 Invoice Workflow

## What & Why
Add a strict invoice approval workflow (Sales → HOD → Account → PMS) on top of the
existing `product_posting_invoices` table: a real state machine, field validation,
duplicate prevention, payment validation, full audit history, and reliable linkage
into the existing PMS pending-project queue. Builds on the Stage 2 foundation
services (ValidationService, AuditLogService, NotificationService).

## Done looks like
- An invoice moves only through legal stages: DRAFT → PENDING_HOD → PENDING_ACCOUNT
  → APPROVED → PAID, plus REJECTED and CANCELLED. Illegal jumps are refused.
- Creating an invoice with a missing/zero/negative amount, bad currency, missing
  customer, or unknown service is rejected with a clear validation error.
- A duplicate active invoice for the same customer + project/service + source is
  blocked; only admins/managers can override with a mandatory reason (audited).
- HOD only sees and acts on PENDING_HOD items; Account only on PENDING_ACCOUNT.
  Rejection always requires a reason.
- Marking an invoice PAID requires payment method, receipt/reference, and a paid
  amount that reconciles with the invoice amount, by an authorized account role.
- When Account approves, the invoice reliably appears in the existing PMS
  pending-project queue (no duplicate conversion logic) and PMS managers are
  notified; the API returns the project link if one already exists.
- Every action is recorded with previous/next status, actor, role, reason, and
  changed fields, viewable as an invoice history.
- Affected workflow screens (PMS approvals / invoice queue) show queues by correct
  status, disable invalid actions, require rejection reasons, show history, and use
  toasts (no browser alerts).

## Out of scope
- The separate general `invoices` table and the gm-entries / pending-quotations
  screens — left untouched.
- Redesigning invoice screens or sales/customer/GM/BV flows.
- Stage 4 workflow-transition work (separate task).

## Decisions (locked)
- Canonical table is `product_posting_invoices`; its `status` is free-text so
  DRAFT/PAID need no enum migration.
- Missing fields are added as NEW OPTIONAL columns (additive, no data loss) and one
  schema push: currency, invoice_date, payment_terms, service_type/package,
  source_module + source_id, receipt_reference, paid_amount, paid_date,
  rejection_reason, notes.
- Invoice history reuses `activity_logs` via AuditLogService (no new table).
- Frontend changes are minimal and only on screens already using the workflow
  invoices.

## Steps
1. **State machine service** — Create a single invoice-workflow service that owns
   all transitions, returning 400 for illegal state changes and 403 for wrong
   role/stage; every endpoint delegates to it.
2. **Schema additions** — Add the new optional columns to the workflow invoice
   table and run a safe additive schema push.
3. **Validators** — Extend invoice validators for create / update / payment /
   decision with the required fields and rules.
4. **Duplicate prevention** — Block a second active invoice for the same
   customer + project/service + source; allow admin/manager override with reason.
5. **Endpoint surface** — Add the `/api/invoices/...` endpoints (submit-hod,
   hod-approve/reject, account-approve/reject, mark-paid, cancel, queue/hod,
   queue/account, history, export, create, patch); keep existing
   product-posting-invoice routes as thin aliases calling the same service.
6. **HOD & Account queues** — Filter strictly by stage; enforce stage-correct
   approve/reject; require rejection reason.
7. **Payment validation** — Enforce method, receipt/reference, amount
   reconciliation, and authorized role before APPROVED → PAID.
8. **Field protection** — Whitelist editable fields per status/role; reject broad
   body updates; approved/paid invoices immutable except admin correction (audited).
9. **Audit & history** — Record every action (prev/next status, actor, role,
   reason, changed fields, source) and expose an invoice history endpoint.
10. **PMS linkage** — On account approval, populate the existing PMS
    pending-project queue, notify PMS managers, return the project link, and
    prevent duplicate project creation per invoice.
11. **Minimal frontend** — Update only the workflow-invoice screens: queues by
    status, disabled invalid actions, required rejection reason, payment errors,
    history, refresh after action, friendly unauthorized errors, toasts.
12. **Docs & verify** — Write STAGE_3_INVOICE_WORKFLOW_CHANGELOG.md and
    INVOICE_STATE_MACHINE.md; run `npm run check` and `npm run dev`; run the 12
    invoice smoke tests.

## Relevant files
- `server/routes/invoice-routes.ts`
- `server/sales-routes.ts`
- `server/account-routes.ts`
- `server/pms-routes.ts`
- `server/repositories/projects.repository.ts`
- `server/validators/invoice.validators.ts`
- `server/services/validation.service.ts`
- `server/services/audit-log.service.ts`
- `server/services/notification-service.ts`
- `shared/schema.ts:451-480`
- `client/src/pages/invoice-pool.tsx`
- `client/src/pages/account-manager-dashboard.tsx`
- `client/src/pages/hod-dashboard.tsx`
