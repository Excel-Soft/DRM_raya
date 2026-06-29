# Invoice → Project Generation Rules

Patch 6 — Stage 3 reference for sections I (approved invoice → project) and J
(Product Posting dependency on Listing-Page QA). This flow is **already
implemented** and is idempotent: an approved qualifying invoice creates or links
**exactly one** root project.

> **Patch 7 Stage 2 re-verification (2026-06-29):** the generation/linking service
> and triggers were re-checked and remain accurate. Generation runs best-effort on
> `POST /api/invoices/:id/account-approve` and via the explicit
> `POST /api/invoices/:invoiceId/generate-project`; one `INVOICE_ROOT` per invoice
> (retry links, never duplicates). **No project-generation behaviour was changed in
> Patch 7** (see `PATCH7_STAGE2_INVOICE_GM_SALES_CHANGELOG.md`).

## Source of truth

| Concern | Location |
| --- | --- |
| Generation / linking service | `server/services/invoice-to-project.service.ts` |
| Trigger (account approval) | `server/routes/invoice-routes.ts` (`/:id/account-approve`) |
| Manual generate endpoint | `server/routes/invoice-routes.ts` (`POST /api/invoices/:invoiceId/generate-project`) |
| Config | `shared/gm-sales-constants.ts` (`PROJECT_GENERATION_MODE`, `PROJECT_INITIAL_STATUSES`) |
| Tables | `drm.projects`, `drm.project_dependencies` (`shared/schema.ts`) |

## When a project is created

`createOrLinkProjectForApprovedInvoice` runs on **final Accounts approval**
(`POST /api/invoices/:id/account-approve`). Generation is best-effort relative to
the approval (a generation failure does not roll back the approval; it is logged)
and is governed by `projectGenerationMode`:

- `MANUAL` (default) — Accounts approval only *enables* creation; the project is
  created from the existing PMS pending-invoices queue or by the explicit manual
  generate endpoint `POST /api/invoices/:invoiceId/generate-project`. This
  preserves today's behaviour.
- `AUTOMATIC` — one root project is created/linked automatically on final
  Accounts approval.

The manual generate endpoint (`POST /api/invoices/:invoiceId/generate-project`)
works in either mode (explicit invocation) and shares the same idempotent
create-or-link service path.

## Exactly one project per invoice (idempotency)

A project row in `drm.projects` is the single `INVOICE_ROOT` for an invoice.
`createOrLinkProjectForApprovedInvoice` enforces **one root project per invoice**:
a retry returns/links the existing project instead of creating a duplicate. This
is what prevents the duplicate-project damage the patch forbids.

## What the project links

The generated `INVOICE_ROOT` project sets structured routing fields:

| Field | Value |
| --- | --- |
| `invoiceId` | the approved `product_posting_invoices` row |
| `customerId` | invoice customer |
| `gmId` | originating GM (shared across the invoice/project set) |
| `serviceType` | canonical service / product name |
| `invoiceType` | `LISTING_PAGE` / `MINIWEBSITE` / `PRODUCT_POSTING` |
| `departmentType` | `DND` (Listing Page, Miniwebsite) or `PRODUCT_POSTING` |
| `projectType` | `INVOICE_ROOT` |
| `createdBy` | actor |
| `status` | from `defaultProjectStatusAfterInvoiceApproval` (default `ACTIVE`) |

PMS / department dashboards and reports pick the project up via the existing
project queries; project generation is audited.

## Product Posting dependency on Listing-Page QA (section J)

Controlled by `requireProductPostingWaitForListingQa` (default **`false`** — no
behaviour change until management confirms).

When `true`:

- A `drm.project_dependencies` row of type `LISTING_PAGE_QA_APPROVAL` is created
  linking the Product Posting project to the same GM's Listing Page project.
- The Product Posting project is placed `OnHold` until Listing-Page QA passes; the
  assign/start path is blocked (direct API and UI), and the UI surfaces the
  awaiting-Listing-Page-QA hold state (exact wording is owned by the frontend).
- When the Listing Page project passes QA, `satisfyListingQaDependencies` flips the
  dependency to `SATISFIED` and releases the held Product Posting project
  (`OnHold` → its initial status).
- Lock and unlock are both audited.

`drm.project_dependencies` columns: `projectId`, `dependencyProjectId`, `gmId`,
`dependencyType` (`LISTING_PAGE_QA_APPROVAL`), `status` (`PENDING` / `SATISFIED`).

## Management confirmations still pending

- `projectGenerationMode` stays `MANUAL` until management confirms automatic
  generation.
- `requireProductPostingWaitForListingQa` stays `false` until management confirms
  the hard QA dependency.
- `defaultProjectStatusAfterInvoiceApproval` stays `ACTIVE`. `DOCUMENTS_PENDING` /
  `PENDING_PROJECT` have no `project_status` DB enum value yet and would require a
  confirmed schema change before use.
