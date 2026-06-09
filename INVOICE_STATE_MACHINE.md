# Invoice Approval State Machine (Stage 3)

Strict workflow for product-posting invoices (`drm.product_posting_invoices`).
The single owner of every transition is
`server/services/invoice-workflow.service.ts`; all `/api/invoices` endpoints
delegate to it.

## States

| Status            | Meaning                                                        |
| ----------------- | ------------------------------------------------------------- |
| `DRAFT`           | Created but not yet submitted (optional starting state).      |
| `PENDING_HOD`     | Awaiting Head-of-Department approval.                         |
| `PENDING_ACCOUNT` | HOD approved; awaiting Account approval.                      |
| `APPROVED`        | Fully approved; surfaced in the PMS pending-project queue.    |
| `PAID`            | Payment recorded and reconciled. Terminal.                   |
| `REJECTED`        | Rejected at HOD or Account stage (reason required). Terminal. |
| `CANCELLED`       | Cancelled by owner/manager (reason required). Terminal.       |

## Legal transitions

```
DRAFT            → PENDING_HOD | CANCELLED
PENDING_HOD      → PENDING_ACCOUNT | REJECTED | CANCELLED
PENDING_ACCOUNT  → APPROVED | REJECTED | CANCELLED
APPROVED         → PAID | CANCELLED
PAID             → (terminal)
REJECTED         → (terminal)
CANCELLED        → (terminal)
```

Any other transition is rejected with HTTP `400 BAD_REQUEST`
(`Illegal status change: <from> → <to>`).

## Who may act

| Action                  | Allowed roles                                  |
| ----------------------- | ---------------------------------------------- |
| Create                  | sales_executive, sales_manager, admin          |
| Submit to HOD           | invoice owner, or manager/admin                |
| HOD approve / reject    | hod, super_hod, admin                          |
| Account approve / reject| account_manager, admin                         |
| Mark paid               | account_manager, admin                         |
| Cancel                  | invoice owner, or manager/admin                |
| Edit (PATCH)            | owner/manager while open; admin-only when locked |

Acting on the wrong stage returns `403 FORBIDDEN`
(e.g. an HOD acting on a `PENDING_ACCOUNT` invoice).

## Validation rules

- **Create**: positive amount (zero/negative rejected), valid currency, a
  customer, and a service (serviceType or projectName).
- **Duplicate prevention** (fail-closed): a second *active* invoice
  (`DRAFT`/`PENDING_HOD`/`PENDING_ACCOUNT`/`APPROVED`) for the same
  customer + service + source is blocked (`409 CONFLICT`). Admins/managers may
  override with a mandatory `overrideReason` (audited). If the uniqueness check
  itself errors, the create is blocked — never silently allowed.
- **Reject**: a reason is always required.
- **Mark paid**: payment method and receipt/reference are required and the paid
  amount must reconcile with the invoice amount (±0.01).
- **Field protection**: edits are whitelisted per status. `DRAFT`/`PENDING_HOD`
  allow most fields; `PENDING_ACCOUNT` allows notes (admin may also correct
  financials); `APPROVED`/`PAID`/`REJECTED`/`CANCELLED` are immutable except an
  audited admin correction.

## PMS linkage

When Account approves, the invoice becomes `APPROVED` and automatically appears
in the existing PMS pending-project queue
(`projectsRepository.findPendingInvoices()` already returns `APPROVED` invoices
that have no linked project — no duplicate conversion logic is added). PMS
managers are notified, and the approve response returns the existing project id
if one is already linked.

## Audit history

Every action is recorded via `AuditLogService` into the existing
`drm.activity_logs` table (no new table): previous/next status, actor, reason,
and changed fields. Read it via `GET /api/invoices/:id/history`.

## Endpoints

```
GET    /api/invoices                 list (sales execs see their own)
POST   /api/invoices                 create
GET    /api/invoices/queue/hod       PENDING_HOD queue (HOD)
GET    /api/invoices/queue/account   PENDING_ACCOUNT queue (Account)
GET    /api/invoices/:id/history     audit trail
GET    /api/invoices/:id/export      invoice + history + project link
POST   /api/invoices/:id/submit-hod  DRAFT → PENDING_HOD
POST   /api/invoices/:id/hod-approve
POST   /api/invoices/:id/hod-reject       { reason }
POST   /api/invoices/:id/account-approve  (+ PMS linkage)
POST   /api/invoices/:id/account-reject   { reason }
POST   /api/invoices/:id/mark-paid        { paymentMethod, receiptReference, paidAmount }
POST   /api/invoices/:id/cancel           { reason }
PATCH  /api/invoices/:id                   whitelisted field edits
PUT    /api/invoices/:id/approve           legacy alias (routes to current stage)
```
