# Invoice State Machine (Patch 3 Stage 3)

The product-posting invoice workflow (Sales → HOD → Accounts → PMS) is owned by a
single service: `server/services/invoice-workflow.service.ts`. Every invoice
endpoint delegates to it, so the state machine, role/stage checks, validation,
audit trail and PMS linkage live in exactly one place. The workflow operates on
the `drm.product_posting_invoices` table (NOT the legacy `drm.invoices` table).

## Statuses

| Status            | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `DRAFT`           | Created, not yet submitted for approval.             |
| `PENDING_HOD`     | Submitted, awaiting HOD approval.                    |
| `PENDING_ACCOUNT` | HOD-approved, awaiting Accounts approval.            |
| `APPROVED`        | Accounts-approved; queued for PMS project creation.  |
| `PAID`            | Payment recorded and reconciled (terminal).          |
| `REJECTED`        | Rejected at HOD or Accounts stage (terminal).        |
| `CANCELLED`       | Cancelled by owner/manager (terminal).               |

## Allowed transitions

```
DRAFT            -> PENDING_HOD | CANCELLED
PENDING_HOD      -> PENDING_ACCOUNT | REJECTED | CANCELLED
PENDING_ACCOUNT  -> APPROVED | REJECTED | CANCELLED
APPROVED         -> PAID | CANCELLED
PAID             -> (terminal)
REJECTED         -> (terminal)
CANCELLED        -> (terminal)
```

Any other change is rejected. `REJECTED -> PENDING_HOD` resubmission is **not**
implemented (the spec lists it as optional, "if implemented safely"); it is
deferred rather than added without a defined correction workflow.

### Error contract

- Illegal transition → `400 BAD_REQUEST` (`Illegal status change: X → Y`).
- Wrong role or wrong stage → `403 FORBIDDEN`.
- Invoice not found → `404 NOT_FOUND`.
- Duplicate-blocked create → `409 CONFLICT` (with `duplicateInvoiceId`).

## Role / stage rules

| Action            | Allowed roles / actors                                        | Valid from status |
| ----------------- | ------------------------------------------------------------ | ----------------- |
| Create            | `sales_executive`, `sales_manager`, `admin`                  | n/a               |
| Submit to HOD     | invoice owner or override role                               | `DRAFT`           |
| HOD approve/reject| `hod`, `super_hod`, `admin`                                  | `PENDING_HOD`     |
| Account approve/reject | `account_manager`, `admin`                             | `PENDING_ACCOUNT` |
| Mark paid         | `account_manager`, `admin`                                  | `APPROVED`        |
| Cancel            | invoice owner or override role                               | DRAFT/PENDING_HOD/PENDING_ACCOUNT/APPROVED |
| Edit (patch)      | owner (open stages) or admin (locked correction)            | see field rules   |

Override roles = `admin`, `super_hod`, `hod`, `sales_manager`, `account_manager`.

## Endpoints (mounted at `/api/invoices`)

| Method & path                         | Purpose                                  |
| ------------------------------------- | ---------------------------------------- |
| `POST   /api/invoices`                | Create a workflow invoice                |
| `PATCH  /api/invoices/:id`            | Whitelisted field edit (per status/role) |
| `POST   /api/invoices/:id/submit-hod` | DRAFT → PENDING_HOD                       |
| `POST   /api/invoices/:id/hod-approve`| PENDING_HOD → PENDING_ACCOUNT            |
| `POST   /api/invoices/:id/hod-reject` | PENDING_HOD → REJECTED (reason required) |
| `POST   /api/invoices/:id/account-approve` | PENDING_ACCOUNT → APPROVED (+PMS link) |
| `POST   /api/invoices/:id/account-reject`  | PENDING_ACCOUNT → REJECTED (reason required) |
| `POST   /api/invoices/:id/mark-paid`  | APPROVED → PAID (payment validation)     |
| `POST   /api/invoices/:id/cancel`     | → CANCELLED (reason required)            |
| `GET    /api/invoices`                | List (sales execs see only their own)    |
| `GET    /api/invoices/queue/hod`      | PENDING_HOD queue                         |
| `GET    /api/invoices/queue/account`  | PENDING_ACCOUNT queue                     |
| `GET    /api/invoices/export`         | Actor-scoped collection export           |
| `GET    /api/invoices/:id/history`    | Full audit trail                          |
| `GET    /api/invoices/:id/export`     | Single-invoice snapshot + history + link |
| `PUT    /api/invoices/:id/approve`    | Legacy alias → delegates to the same machine |

## Required create fields & validation

Enforced by `workflowCreateInvoiceSchema` (`server/validators/invoice.validators.ts`):

- `customerId` (uuid) — required.
- `amount` — required, **strictly positive**, ≤ 2 decimals (zero/negative rejected).
- a service — `serviceType` **or** `projectName` required (downstream routing).
- `currency` — optional, defaults to `USD`; an **invalid** currency is rejected.
- `invoiceDate` — optional; an **invalid** date is rejected (the spec's reject
  list checks for an invalid date, not a missing one).
- `paymentTerms`, `servicePackage`, `companyName`, `sourceModule`, `sourceId`,
  `notes` — optional.
- sales owner = the authenticated actor (cannot be spoofed via the body).

**Deferred (documented, not built):** existence checks for "unknown service /
project" and "invalid source record" are not validated against catalogs / live
rows — only presence is enforced. Adding catalog lookups is heavy and risks
breaking existing callers, so it is out of scope for this stage.

## Duplicate rules

A second **active** invoice for the same `customerId` +
`lower(serviceType|projectName)` + `sourceModule` + `sourceId` is blocked
(`409`). Active statuses (this stage adds `PAID`):

```
DRAFT, PENDING_HOD, PENDING_ACCOUNT, APPROVED, PAID
```

The duplicate check is **fail-closed**: if the lookup itself errors it throws
(`500`) and the create is blocked — a broken check never admits a silent
duplicate. Override is allowed only for `admin` / managers, requires
`overrideDuplicate: true` **and** a non-empty `overrideReason`, and is audited.

## Payment rules (APPROVED → PAID)

`markPaid` requires:

- `paymentMethod` (non-empty) and `receiptReference` (non-empty).
- `paidAmount` must **reconcile** with the invoice amount within ±0.01 —
  over-payment and under-payment are rejected (`400`). This is the explicit
  over/under-payment rule.
- only `account_manager` / `admin` may record payment.

A proof/attachment URL is not currently captured (the spec lists it as "if
required"); it can be added later without changing the state machine.

## Field-protection rules (patch)

- `DRAFT` / `PENDING_HOD`: owner (or manager override) may edit project/service/
  company/date/terms/notes and financials — **except** that at `PENDING_HOD` a
  reviewing HOD/manager who is **not** the owner or an admin **cannot** change
  `amount` or `currency` (separation of duties: HOD approval must not mutate the
  financial amount).
- `PENDING_ACCOUNT`: `notes` only (admin may also correct amount/currency/terms).
- `APPROVED` / `PAID` / `REJECTED` / `CANCELLED`: locked — admin-only correction,
  fully audited.
- Broad/empty bodies are rejected (`workflowPatchSchema` requires ≥ 1 known field).

## PMS linkage behavior

On Account **approve** the invoice moves to `APPROVED` and:

1. PMS managers (`product_posting_manager`, `software_manager`, `dd_manager`) are
   notified that an approved invoice is ready for project creation.
2. The approved invoice **is** the project-pending record — it surfaces in the
   existing pending-project queue (`projectsRepository.findPendingInvoices`,
   status `APPROVED` with no linked project). The response returns `projectId`
   (the linked project if one already exists, else `null`).
3. The actual project is created by a real PMS manager
   (`POST /api/account/create-project-from-gm` / the PMS queue). The workflow
   does **not** auto-create or fake a downstream project.
4. Duplicate project creation is prevented because a created project links back
   via `projects.invoiceId`, so the invoice then drops out of the pending queue
   and `findProjectLink` returns the existing project.

**Deferred (documented):** the HOD queue currently shows all `PENDING_HOD`
invoices and is **not** scoped per department — `product_posting_invoices` has no
reliable department key, and synthesizing one would be fake data.

## Audit behavior

Every action records an entry via `AuditLogService` (stored in
`drm.activity_logs`; rich fields live in the JSON `details` column): previous
status, next status, actor, action, reason/remarks, changed fields, source
module and request context. `GET /api/invoices/:id/history` replays this trail in
chronological order.

## Tests run

- `npm run check` (tsc) — see changelog for baseline note.
- `npm test` — full suite.
- `npm run dev` — boot + route smoke checks.
