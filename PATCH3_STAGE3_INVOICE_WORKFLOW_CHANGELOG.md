# Patch 3 — Stage 3: Invoice State Machine + Sales → HOD → Accounts → PMS link

## Summary

Stage 3's invoice workflow was already implemented in the codebase from prior
patches: `server/services/invoice-workflow.service.ts` is the single owner of the
`drm.product_posting_invoices` state machine, with the full Sales → HOD →
Accounts → PMS pipeline, normalized `/api/invoices/*` endpoints, validation,
duplicate prevention, audit, notifications and PMS linkage already in place.

This stage is therefore a **gap-fill**: three surgical backend corrections plus
documentation. No invoice screens were redesigned, no existing sales / customer /
GM / BV / account flows were changed, no broad body updates were allowed, no
downstream project creation was faked, and no destructive DB commands were run.

See `INVOICE_STATE_MACHINE.md` for the full statuses / transitions / rules /
endpoints reference.

## Changes made this stage

### 1. Duplicate detection now treats PAID as active (spec C)
`server/services/invoice-workflow.service.ts` — added `INVOICE_STATUS.PAID` to
`ACTIVE_STATUSES`. A completed (paid) invoice is a real billing event and must
still block a second active invoice for the same customer + service + source.
Override-with-reason for admin/managers is unchanged.

### 2. Separation of duties on PENDING_HOD edits (spec H)
`server/services/invoice-workflow.service.ts` (`patch()`) — at `PENDING_HOD`, a
reviewing HOD / manager who is **not** the sales owner or an admin can no longer
change `amount` or `currency`. Previously any override-role actor (which includes
HOD) could edit financial fields while the invoice sat in their approval queue.
The sales owner can still correct figures; admin correction is unchanged and
audited.

### 3. Actor-scoped collection export endpoint (spec D)
- `server/services/invoice-workflow.service.ts` — new `exportList(actor)` that
  returns `{ invoices, count, exportedAt }` using the **same** scoping as
  `list()` (sales execs see only their own; it never widens access).
- `server/routes/invoice-routes.ts` — new `GET /api/invoices/export`, registered
  before the parameterized `/:id/*` routes so the literal path is unambiguous.
  (`GET /api/invoices/:id/export` for single-invoice snapshots already existed.)

### 4. Documentation
- `INVOICE_STATE_MACHINE.md` (new) — statuses, transitions, role/stage rules,
  endpoints, required fields, duplicate rules, payment rules, PMS linkage and
  audit behavior, plus the intentional defers.
- `PATCH3_STAGE3_INVOICE_WORKFLOW_CHANGELOG.md` (this file).

## APIs added / modified

- **Added** `GET /api/invoices/export` — actor-scoped collection export.
- All other Stage 3 endpoints already existed and were unchanged:
  `POST /api/invoices`, `PATCH /api/invoices/:id`,
  `POST /api/invoices/:id/{submit-hod,hod-approve,hod-reject,account-approve,account-reject,mark-paid,cancel}`,
  `GET /api/invoices/{queue/hod,queue/account,:id/history,:id/export}`,
  and the legacy `PUT /api/invoices/:id/approve` alias.

## DB changes

None this stage. All `product_posting_invoices` workflow columns
(`currency`, `invoice_date`, `payment_terms`, `service_type`, `service_package`,
`source_module`, `source_id`, `receipt_reference`, `paid_amount`, `paid_date`,
`rejection_reason`, `notes`) and `projects.invoice_id` already exist (and are
re-asserted idempotently at runtime via `ensureInvoiceWorkflowSchema()` with
`ADD COLUMN IF NOT EXISTS`). No destructive operations.

## State machine implemented

DRAFT → PENDING_HOD → PENDING_ACCOUNT → APPROVED → PAID, with REJECTED /
CANCELLED branches. Illegal transition → 400, wrong role/stage → 403, missing →
404, duplicate-blocked create → 409. (Full table in `INVOICE_STATE_MACHINE.md`.)

## PMS linkage behavior

On Account approval the invoice becomes `APPROVED`, PMS managers
(`product_posting_manager`, `software_manager`, `dd_manager`) are notified, and
the approved invoice becomes the project-pending record surfaced by the existing
pending-project queue (`projectsRepository.findPendingInvoices`). The API returns
`projectId` (the linked project if one already exists, else `null`). The actual
project is created by a real PMS manager via the existing PMS/account route;
the workflow does **not** auto-create or fake a downstream project. A created
project links back via `projects.invoiceId`, which prevents duplicate creation
(the invoice then drops out of the pending queue).

## Intentional defers (documented, not built)

- `invoiceDate` stays optional — the spec's reject list checks for an *invalid*
  date, not a missing one (an invalid date is already rejected).
- "Unknown service/project" and "invalid source record" are presence-checked
  only, not validated against catalogs / live rows (heavy; risks breaking
  callers).
- HOD queue is not department-scoped — `product_posting_invoices` has no reliable
  department key; synthesizing one would be fake data.
- `REJECTED → PENDING_HOD` resubmission is not implemented (spec lists it as
  optional, "if implemented safely").
- Frontend screens were **not** rewired. The existing invoice screens
  (`invoice-pool.tsx`, `hod-dashboard.tsx`, `account-manager-dashboard.tsx`,
  `create-invoice.tsx`, `account-invoices.tsx`) use the legacy endpoints and
  already use toast/dialog, require rejection reasons and show status queues.
  Rewiring them to `/api/invoices/*` is high-risk and would conflict with the
  hard rules ("do NOT redesign invoice screens / do NOT break existing flows").
  The normalized endpoints remain available for future frontend adoption.

## Tests run

- `npm run check` (tsc `--noEmit`): 56 pre-existing baseline errors in unrelated
  files; **0 in the changed files** (`invoice-workflow.service.ts`,
  `invoice-routes.ts`).
- `npm test` (vitest): **125 / 125 passing** — no regressions. (Note: the suite
  covers `workflow-transition.service.ts`; `InvoiceWorkflowService` itself has no
  dedicated unit test, so the changes below were verified by runtime smoke.)
- `npm run dev`: boots clean, serving on port 5000, no startup errors after the
  route addition.
- Authenticated read-only smoke (admin):
  - `GET /api/invoices/export` → `200` with `{invoices, count, exportedAt}`; the
    invoice set matches `GET /api/invoices` (same scope). (Dev DB currently has
    no invoices, so both are empty — the route runs and shapes correctly.)
  - `GET /api/invoices/queue/hod` → `200`.
- Unauthenticated: all `/api/invoices/*` → `401` (auth-gated).
- Spec smoke behaviors #1–#12 are enforced at the validator/state-machine layer
  (positive-amount + service-required create, fail-closed duplicate block,
  reject-needs-reason at both stages, wrong-stage 403, mark-paid method/reference
  + reconciliation, audit on every transition). Full create→approve→pay E2E with
  seeded rows was not run to avoid mutating the dev database.

## Unresolved / known limitations

- See "Intentional defers" above (department-scoped HOD queue, catalog/source
  existence validation, rejected-resubmission, frontend rewiring).
- `InvoiceWorkflowService` has no dedicated automated test file; consider adding
  one in a later stage for regression safety.
- Pre-existing (not from this stage): a hardcoded `JWT_SECRET` fallback exists in
  config — it should be moved fully to managed env and rotated separately.
