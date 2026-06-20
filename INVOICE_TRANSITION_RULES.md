# Invoice Transition Rules

Patch 6 — Stage 3 reference for the invoice workflow (sections G & H). The invoice
state machine, role-gated transitions, validation, and duplicate prevention are
**already implemented**. Raw status updates are not accepted: status only moves
through dedicated transition endpoints that run through the service layer.

## Source of truth

| Concern | Location |
| --- | --- |
| Status enum + legal-transition map | `shared/gm-sales-constants.ts` (`INVOICE_WORKFLOW_STATUSES`, `INVOICE_LEGAL_TRANSITIONS`) |
| Transition service (guards, transaction, duplicate check) | `server/services/invoice-workflow.service.ts` |
| Central transition guard | `server/services/workflow-status.service.ts` |
| Invoice API | `server/routes/invoice-routes.ts` |
| Default-invoice generation | `server/services/gm-invoice-generation.service.ts` |
| Validators | `server/validators/invoice.validators.ts` |
| Table | `drm.product_posting_invoices` (`shared/schema.ts`) |

> Note: the transition service is `invoice-workflow.service.ts` (its established
> name). It fulfils the role the spec calls `invoice-transition.service.ts`; no
> second service was created, to avoid duplicating the transition logic.

## States

`DRAFT`, `PENDING_HOD`, `PENDING_ACCOUNT`, `APPROVED`, `REJECTED`, `PAID`,
`CANCELLED`.

## Legal transitions (`INVOICE_LEGAL_TRANSITIONS`)

```
DRAFT           -> PENDING_HOD | CANCELLED
PENDING_HOD     -> PENDING_ACCOUNT | REJECTED | CANCELLED
PENDING_ACCOUNT -> APPROVED | REJECTED | CANCELLED
APPROVED        -> PAID | CANCELLED
PAID            -> (terminal)
REJECTED        -> (terminal)
CANCELLED       -> (terminal)
```

Any move not in this map is rejected (HTTP 400) before a row is touched. The
status column is never written from a client-supplied raw status: every change
goes through service-backed transition methods (the central
`transitionWorkflowStatus`, plus dedicated methods such as `markPaid` that call
`assertTransition` before their `UPDATE`, and the initial status set on create).

## Endpoints (`server/routes/invoice-routes.ts`)

| Method + Path | Transition | Guard |
| --- | --- | --- |
| `POST /api/invoices` | create (DRAFT or PENDING_HOD) | `requireManualInvoiceCreator()` |
| `GET /api/invoices`, `/queue/hod`, `/queue/account` | read | role-scoped |
| `GET /api/invoices/:id/history` | audit trail | authed |
| `GET /api/invoices/:id/export` | snapshot + history + project link | authed |
| `POST /api/invoices/:id/submit-hod` | DRAFT → PENDING_HOD | owner/role |
| `POST /api/invoices/:id/hod-approve` | PENDING_HOD → PENDING_ACCOUNT | `requireRole("hod","super_hod","admin")` |
| `POST /api/invoices/:id/hod-reject` | PENDING_HOD → REJECTED | `requireRole("hod","super_hod","admin")` |
| `POST /api/invoices/:id/account-approve` | PENDING_ACCOUNT → APPROVED (+ PMS linkage) | `requireRole("account_manager","admin")` |
| `POST /api/invoices/:id/account-reject` | PENDING_ACCOUNT → REJECTED | `requireRole("account_manager","admin")` |
| `POST /api/invoices/:id/mark-paid` | APPROVED → PAID | `requireRole("account_manager","admin")` |
| `POST /api/invoices/:id/cancel` | pending → CANCELLED (reason) | role-scoped |
| `PATCH /api/invoices/:id` | whitelisted field edits per status/role | role-scoped |

The deprecated `PATCH /api/account/invoices/:id/status` raw-status path is
superseded by these service-backed transition endpoints.

## Rules enforced

- **No raw status updates** — only the transition endpoints above.
- **Stage-scoped roles** — HOD actions require a HOD-family role; Account actions
  require account manager/admin. The service layer re-validates the role inside
  `transitionWorkflowStatus`, so a direct API call cannot bypass the UI.
- **Reject reason required** — `hod-reject` / `account-reject` require a reason.
- **Approval readiness** — `assertApprovalReadiness` requires a customer, a
  positive amount, and an invoice type / service before APPROVED.
- **Positive amount** — the create / patch / mark-paid validators and approval
  readiness require a positive amount; a zero or negative amount is rejected
  (there is no zero-value-with-reason path in the current implementation).
- **Payment fields** — `mark-paid` records `payment_method` / `receipt_reference`
  / `paid_amount` / `paid_date`.
- **Invoice type enum** — `LISTING_PAGE`, `MINIWEBSITE`, `PRODUCT_POSTING`.
- **Manual creator config** — `requireManualInvoiceCreator()` allows manual
  creation per role, gating Service Executives behind
  `serviceExecutiveCanCreateManualInvoice` (default `false`).
- **Audit + notify** — every transition writes to `drm.activity_logs` and
  notifies the next stage.

## Duplicate invoice prevention (fail-closed)

`InvoiceWorkflowService.findActiveDuplicate` blocks creating a second **active**
invoice (DRAFT / PENDING_* / APPROVED / PAID) for the same
**customer + service (serviceType/projectName) + source (module/id)**. The check
fails closed (any lookup error blocks creation). A manager/admin may override only
by supplying `overrideReason`, which is recorded.

## Default-invoice generation + idempotency (section H)

`server/services/gm-invoice-generation.service.ts` generates the three default
invoices (`LISTING_PAGE`, `MINIWEBSITE`, `PRODUCT_POSTING`):

- Timing controlled by `gmInvoiceGenerationTiming`: `ON_GM_CREATION` (default) or
  `AFTER_FINAL_GM_APPROVAL` — generation happens at exactly one documented event.
- **Idempotent**: at most one invoice per `(GM, invoiceType)`; a retry links the
  existing row rather than creating a duplicate.
- Each invoice is linked to its GM / customer, audited, and visible under the GM
  detail.

## Management confirmations still pending

- `gmInvoiceGenerationTiming` stays `ON_GM_CREATION` until management confirms
  otherwise.
- `serviceExecutiveCanCreateManualInvoice` stays `false`.
