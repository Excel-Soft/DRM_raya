# Patch 5 — Stage 5 Changelog

**P9 — Standardize Approved-Invoice → Project generation**
**P10 — Enforce Product Posting dependency on Listing Page QA approval**

This stage is **thin and additive**. The default configuration preserves the
existing behavior exactly: project generation stays **MANUAL** and the Product
Posting QA dependency is **off**. Nothing in the prior workflow changes unless an
administrator opts in via config.

---

## 1. Configuration keys (`gm_sales_workflow_config`)

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `projectGenerationMode` | `MANUAL` \| `AUTOMATIC` | `MANUAL` | `AUTOMATIC` creates the linked root project on final Accounts approval. `MANUAL` keeps the existing PMS pending-invoices queue; generation happens only via the explicit endpoint/button. |
| `requireProductPostingWaitForListingQa` | boolean | `false` | When `true`, a Product Posting root project is held until the same GM's Listing Page project passes QA. |
| `defaultProjectStatusAfterInvoiceApproval` | enum | `ACTIVE` | Initial status of a generated root project (mapped to the DB status string). Used when not held. |

`projectGenerationMode` is the only new key; it is auto-seeded with the existing
idempotent config-merge logic, so older config rows gain it on next read.

## 2. Database changes (applied at runtime via `ensureProjectStage5Schema`)

`npm run db:push` is broken repo-wide on a pre-existing FK type mismatch, so the
schema is applied at boot with additive, idempotent DDL (`ADD COLUMN IF NOT
EXISTS` / `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).

**`drm.projects` — new columns:** `created_by`, `gm_id`, `service_type`,
`invoice_type`, `project_type`.
- Indexes: `idx_projects_gm_id`, `idx_projects_invoice_type`.
- Partial unique index `uq_projects_invoice_root` on `(invoice_id)`
  `WHERE invoice_id IS NOT NULL AND project_type = 'INVOICE_ROOT'` — the
  idempotency backstop. It only constrains generated **INVOICE_ROOT** projects,
  so legacy rows and assign-task **SUBPROJECT** rows (which copy the parent's
  `invoice_id`) are excluded and the index builds cleanly on existing data.

**`drm.project_dependencies` — new table:**
`id`, `project_id` (dependent PP root), `dependency_project_id` (LP root,
nullable), `gm_id`, `dependency_type` (default `LISTING_PAGE_QA_APPROVAL`),
`status` (`PENDING` \| `SATISFIED`), `satisfied_at`, `satisfied_by`, `metadata`,
`created_at`, `updated_at`.
- Unique index `uq_project_dependencies_project_type` on
  `(project_id, dependency_type)` → idempotent dependency creation.
- Indexes `idx_project_dependencies_gm`, `idx_project_dependencies_status`.

> **Deviation from the original spec (documented):** the original Part B field
> list (`dependent_project_id`, `required_status`, `current_status`,
> `is_satisfied`, `hold_reason`) was consolidated to the columns above on the
> architect's design: `project_id` is the dependent project, a single `status`
> enum replaces `is_satisfied`/`required_status`/`current_status`, `gm_id` makes
> matching robust to creation order, and `metadata` (jsonb) carries the
> hold reason / audit context. Behavior is equivalent; the shape is leaner.

## 3. APIs added / modified

- **Added** `POST /api/invoices/:invoiceId/generate-project` — explicit,
  idempotent invoice → project generation. Roles: `account_manager`, `admin`,
  `product_posting_manager`. Works in either generation mode (it is the manual
  trigger).
- **Modified (hook)** Accounts approval (`InvoiceWorkflowService.accountDecision`,
  reached via `POST /api/invoices/:id/account-approve`) — when
  `projectGenerationMode = AUTOMATIC`, it calls the generation service
  best-effort after the approval is committed. Approval can never fail because of
  generation; errors are logged and swallowed.
- **Modified (gate)** `POST /api/product-posting/projects/:projectId/assign-task`
  — returns **409** `{ code: "LISTING_QA_PENDING" }` when an unsatisfied Listing
  Page QA dependency applies (config-gated; no-op otherwise). Sub-projects it
  creates are now tagged `project_type = 'SUBPROJECT'` and carry
  `gm_id` / `service_type` / `invoice_type` forward.
- **Modified (satisfy)** `POST /api/product-posting/tasks/:taskId/qa-review`
  (action `complete`) — when the QA-completed project is a Listing Page project,
  it satisfies matching dependencies for that GM and releases held PP projects.

## 4. Backend files changed

- `shared/gm-sales-constants.ts` — `PROJECT_GENERATION_MODE`,
  `PROJECT_DEPENDENCY_TYPES`, `PROJECT_TYPES`, `projectGenerationModeSchema`;
  new config key wired into schema / defaults / descriptions.
- `shared/schema.ts` — `projects` routing columns; `projectDependencies` table.
- `server/db/ensure.ts` — `ensureProjectStage5Schema`, wired into `ensureDbOnce`.
- `server/services/invoice-to-project.service.ts` — **new**; the core service.
- `server/services/invoice-workflow.service.ts` — AUTOMATIC-mode approval hook.
- `server/routes/invoice-routes.ts` — manual generate-project endpoint.
- `server/routes/product-posting-workflow-routes.ts` — assign-task gate,
  sub-project tagging, QA-completion dependency satisfaction.

## 5. Frontend files changed (minimal)

- `client/src/components/product-posting-approvals-widget.tsx` (Part C) —
  Account Manager sees an "Approved — project generation" block with a
  **Generate Project** action; toasts reflect created / already-generated / held
  status from the idempotent endpoint.
- `client/src/pages/product-posting-dashboard.tsx` (Part D) — the assign-task
  mutation now surfaces the backend's honest rejection; a held Product Posting
  project shows the clear reason **"Waiting for Listing Page QA approval."**

## 6. Tests run

- `npm run check` — no new errors vs. the known pre-existing baseline.
- `npm run dev` — boots; `ensureProjectStage5Schema` applies the columns/table/
  indexes on startup.
- Manual smoke checks per `INVOICE_TO_PROJECT_GENERATION_RULES.md` and
  `PRODUCT_POSTING_LISTING_QA_DEPENDENCY.md`.

## 7. Management confirmations pending

- Final value of `projectGenerationMode` for production (defaulting to `MANUAL`).
- Whether `requireProductPostingWaitForListingQa` should be enabled, and the
  exact `defaultProjectStatusAfterInvoiceApproval`.
- Department-routing matrix sign-off (LISTING_PAGE / MINIWEBSITE / PRODUCT_POSTING)
  — current behavior follows the existing structured `invoiceType` model.
