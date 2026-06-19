# Product Posting → Listing Page QA Dependency (P10)

A Product Posting project must not start until the **same GM's** Listing Page
project has passed QA — **only when** `requireProductPostingWaitForListingQa =
true`. When the config is `false` (the default), everything below is a no-op and
Product Posting is never blocked.

## Dependency model — `drm.project_dependencies`

| Column | Meaning |
| --- | --- |
| `project_id` | The dependent **Product Posting root** project. |
| `dependency_project_id` | The **Listing Page root** it waits on (nullable; matching is primarily by GM). |
| `gm_id` | The GM the two roots share — the robust matching key. |
| `dependency_type` | `LISTING_PAGE_QA_APPROVAL`. |
| `status` | `PENDING` → `SATISFIED`. |
| `satisfied_at` / `satisfied_by` | When/who released it. |
| `metadata` | jsonb — hold reason and audit context. |

Unique on `(project_id, dependency_type)`, so creating the dependency is
idempotent. (See the changelog for how these columns consolidate the original
Part B field list.)

## Why match by GM, not by creation order

Listing Page and Product Posting roots for the same GM can be generated in either
order. Matching by `gm_id` means the dependency reconciles correctly no matter
which project is created first — `reconcileListingProductDependencies(gmId)` runs
on each generation and links/creates the `PENDING` row once both roots exist.

## Lifecycle

1. **Create.** When a Product Posting root is generated (or reconciled) and a
   Listing Page root for the same GM exists, a `PENDING` dependency is created and
   the PP root is set **OnHold**.
2. **Hold (UI + API).**
   - Product Posting Manager dashboard: attempting to assign a held project shows
     **"Waiting for Listing Page QA approval."**
   - `POST /api/product-posting/projects/:projectId/assign-task` rejects with
     **409** `{ code: "LISTING_QA_PENDING" }` — direct API calls cannot bypass it.
3. **Satisfy.** When a Listing Page project completes QA via
   `POST /api/product-posting/tasks/:taskId/qa-review` (action `complete`),
   `satisfyListingQaDependencies({ gmId })`:
   - marks matching dependencies `SATISFIED` (`satisfied_at` / `satisfied_by`),
   - flips the held Product Posting root(s) from **OnHold** to the configured
     `defaultProjectStatusAfterInvoiceApproval`,
   - notifies the Product Posting manager/executive,
   - records an audit unlock event.
4. **Assignable.** The Product Posting project can now be assigned normally.

All of step 3 is best-effort and never throws, so QA completion itself can't
fail because of dependency bookkeeping.

## Config = false behavior

No dependency rows are created, nothing is held, the assign-task gate is a pass,
and QA completion skips the satisfy step. Product Posting behaves exactly as
before this stage.

## Smoke checklist

6. With config on and LP QA unsatisfied, the PP project is held (OnHold).
7. The assign button shows the clear hold reason.
8. Direct assign-task API returns 409 while unsatisfied.
9. Listing Page QA completion unlocks Product Posting.
10. PP becomes assignable after the dependency is satisfied.
11. Audit log records project creation, dependency lock, and unlock.
