# Invoice → Project Generation Rules (P9)

How an **approved** product-posting invoice becomes exactly one linked project.

## Entry points

1. **Manual (default).** `POST /api/invoices/:invoiceId/generate-project`
   (roles: `account_manager`, `admin`, `product_posting_manager`). Surfaced in
   the Account Manager approvals widget as **Generate Project** on approved
   invoices. Always available, regardless of mode.
2. **Automatic (opt-in).** When `projectGenerationMode = AUTOMATIC`, final
   Accounts approval triggers generation as a best-effort side-effect. Approval
   itself never fails if generation hiccups (errors are logged and swallowed).

`projectGenerationMode` defaults to **MANUAL**, which preserves the existing PMS
pending-invoices queue untouched.

## Idempotency — one root project per invoice

- A generated/linked root project is marked `project_type = 'INVOICE_ROOT'`.
- A partial unique index (`uq_projects_invoice_root`) allows **at most one**
  `INVOICE_ROOT` per `invoice_id`.
- The service is **create-or-link**: if a project already exists for the invoice,
  the earliest one is treated as the root and **reused** — no insert. Concurrent
  inserts that race the index get a unique-violation (`23505`), which is caught
  and converted into a link to the winning row.
- Result: retry, re-approval, double-click, or page refresh never create a
  duplicate. The endpoint returns `{ created, linked, projectId, status, held }`
  so the caller can tell "created" from "already generated".

> Assign-task sub-projects deliberately copy the parent's `invoice_id` but are
> tagged `project_type = 'SUBPROJECT'`, so they are excluded from the root index
> and never collide with it.

## What the root project links

`invoiceId`, `gmId`, `customerId`/company, department (`departmentType`),
`serviceType`, `projectType`, `invoiceType`, and `createdBy` (source/actor).
These come from **structured invoice fields**, not loose name text.

## Initial status

- Comes from `defaultProjectStatusAfterInvoiceApproval` (mapped to the DB status
  string). If the config/key is missing, current behavior is preserved.
- **Exception (P10):** if `requireProductPostingWaitForListingQa = true` and an
  unsatisfied Listing Page QA dependency applies to a Product Posting root, the
  project is created **OnHold** instead, and flips to the configured status once
  the dependency is satisfied. See `PRODUCT_POSTING_LISTING_QA_DEPENDENCY.md`.

## Department routing

Routing reads structured fields (`invoiceType` / `departmentType` /
`serviceType` / `projectType`) rather than parsing names:

- `LISTING_PAGE` → Listing / DD department (existing business model)
- `MINIWEBSITE` → D&D / Software / DD route (existing business model)
- `PRODUCT_POSTING` → Product Posting route

## Auditing

Every generation (create or link) is recorded via `AuditLogService` with the
actor, invoice, resulting project id, status, held flag, and dependency id.

## Smoke checklist

1. Account approval (AUTOMATIC) or Generate Project (MANUAL) yields exactly one
   project for the approved invoice.
2. Re-running generation returns the existing project — no duplicate.
3. Project links invoice, GM, customer, department, service type.
4. Status uses the configured initial status (or OnHold when held).
5. Department routing matches the invoice's structured type.
