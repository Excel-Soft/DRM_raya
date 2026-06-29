# Workflow Reconciliation Report (Patch 6 Stage 4)

A read-only report that surfaces cross-department **workflow** drift across the
GM → invoice → project → workflow → QA → verification chain.

```
GET /api/workflow/reconciliation
```

- **Router:** `server/routes/workflow-reconciliation-routes.ts`, mounted at
  `/api/workflow` in `server/routes.ts`.
- **Access:** `admin`, `super_hod`, or `super_admin` only → otherwise `403`.
  Unauthenticated → `401`.
- **Read-only:** no writes, no status changes. Every check returns the real
  offending rows or nothing — figures are never fabricated.
- **Resilient:** each check runs in its own `try/catch`. A single failing check is
  reported under `checkErrors` and never `500`s the whole report.
- **SQL note:** `drm.gm_entries.id` is `varchar` while `projects`/`invoices`/
  `project_dependencies` carry `gm_id` as `text`, so those joins use `::text`
  casts (consistent with the financial reconciliation endpoint).

## Checks

| `type` | Severity | What it flags |
|--------|----------|---------------|
| `approved_invoice_without_project` | high | `product_posting_invoices.status = 'APPROVED'` with no linked `projects` row (`projects.invoice_id`). |
| `invoice_root_project_without_invoice` | medium | `projects.project_type = 'INVOICE_ROOT'` with `invoice_id is null`. |
| `project_onhold_with_satisfied_dependency` | high | `projects.status = 'OnHold'` while its `LISTING_PAGE_QA_APPROVAL` dependency is satisfied (`satisfied_at` set / `status = 'SATISFIED'`). |
| `verification_pending_too_long` | medium | Product Posting **and** Software workflows where `qa_reviewed_at is not null`, `verification_reviewed_at is null`, and QA sign-off is older than the threshold. |
| `approved_gm_without_invoice` | medium | `gm_entries.status in ('Approved','Completed')` with no `product_posting_invoices` row sharing its `gm_id`. |
| `partial_gm_with_pending_balance` | low | Partial-payment GM (`is_partial_payment = 1`), approved, where `amount_usd − Σ gm_partial_receipts.amount_usd > 0.01`. |
| `loan_gm_without_terms_or_approval` | high | Loan GM (`is_loan = 1`), approved, with no `gm_loan_terms` row or `admin_approval_status <> 'APPROVED'`. |
| `pms_workflow_status_mismatch` | medium | Project `status = 'Completed'` whose PP **or** Software workflow has not reached the terminal `VERIFICATION_COMPLETE` phase (run-check names `status_mismatch_product_posting` / `status_mismatch_software`). |

Each check is capped at 500 rows.

### Note on `pms_workflow_status_mismatch` (Patch 7 Stage 3)

Only the **high-confidence** direction is flagged: a project marked `Completed`
while its workflow is not yet terminal. The reverse direction (workflow
`VERIFICATION_COMPLETE` but project not `Completed`) is **intentionally not**
flagged — the workflow handlers complete the *task*, not the parent *project*, so
"verified but project still `Active`" is the normal end-state and flagging it
would produce mass false positives.

## Threshold config

| Env var | Default | Meaning |
|---------|---------|---------|
| `WORKFLOW_VERIFICATION_PENDING_MAX_DAYS` | `3` | Max days QA-complete work may wait for verification before being flagged. |

## Response shape

```jsonc
{
  "generatedAt": "2026-06-20T19:36:00.000Z",
  "thresholds": { "verificationPendingMaxDays": 3 },
  "totalIssues": 12,
  "summary": { "approved_invoice_without_project": 2, "loan_gm_without_terms_or_approval": 1 },
  "issues": [
    {
      "type": "approved_invoice_without_project",
      "severity": "high",
      "entity": "invoice",
      "entityId": "…",
      "label": "ACME Pvt Ltd",
      "detail": "Invoice is APPROVED but no project is linked to it.",
      "context": { "gmId": "…", "createdAt": "…" }
    }
  ],
  "checkErrors": { /* present only if a check failed */ }
}
```
