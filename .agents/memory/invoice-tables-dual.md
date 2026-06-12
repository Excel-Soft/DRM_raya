---
name: Two invoice tables (don't duplicate the state machine)
description: WebExcels DRM has two distinct invoice tables; only one has a status state machine. Reuse it instead of building a second.
---

There are **two** separate invoice tables in this app, and they are easy to conflate:

- `drm.product_posting_invoices` — governed by a **full status state machine**
  (`server/services/invoice-workflow.service.ts`, documented in
  `INVOICE_STATE_MACHINE.md`), exposed via the router mounted at `/api/invoices`
  (`server/routes.ts`). States: DRAFT → PENDING_HOD → PENDING_ACCOUNT → APPROVED → PAID,
  with transition validation.
- `drm.invoices` — the "accounts" invoices, handled in `server/account-routes.ts`.
  Create uses zod; **update** uses a `pickWritable` + `INVOICE_WRITABLE_FIELDS`
  allow-list (good). BUT `PATCH /api/account/invoices/:id/status` has **no**
  transition validation and **no** action-level role gate (only `if (!req.user)`).

**Why:** A Patch 3 baseline audit initially treated "invoice state machine" as
entirely missing. It is missing only for `drm.invoices`; building a fresh machine
would duplicate the existing `invoice-workflow.service.ts`.

**How to apply:** When asked to add invoice status/transition validation, first
identify which table. For `drm.invoices`, reuse the `invoice-workflow.service.ts`
pattern (and add a role gate on the status endpoint) rather than writing a new one.
