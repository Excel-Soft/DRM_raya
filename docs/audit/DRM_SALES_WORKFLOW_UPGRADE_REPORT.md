# DRM Sales Workflow — WebExcels Implementation

**Target:** `DRM-WebExcels-Version-10` only (backend + frontend)  
**Legacy reference (read-only):** `DRMBackup10_09_26/` — not modified in this pass  

## Recovery note (wrong-project attempt)

Git on **`DRMBackup10_09_26`** still shows local modifications (e.g. `layouts/func.php`, `global_followup.php`, …) from earlier work. **This implementation did not touch those files.** To discard that batch safely:

1. In Cursor, reject/unreview any pending changes under `DRMBackup10_09_26/` if still in the review panel, **or**
2. From that repo: `git restore -- <specific files>` (avoid blanket `git restore .` if you have unrelated edits you want to keep).

**`DRM-WebExcels-Version-10` (habib-dev):** prior to this pass, only `.gitignore` and an audit pointer were dirty; workflow code lives in backend/frontend files listed below.

## Workflow (new app)

Company/customer → service follow-up (`drm.follow_ups` + `followup_subservice_details`) → **60-day company-wide eligibility** → quotation with follow-up links → creator **Done** (confirm) → HOD approve/reject → approved **GM** or **invoice** quotation → GM pool or manual invoice.

## Files changed (WebExcels)

| Path | Purpose |
|------|---------|
| `backend/src/shared/gm-package-catalog.ts` | GM vs service classification |
| `backend/src/server/services/sales-workflow.service.ts` | Eligibility, validation, GM/invoice gates |
| `backend/src/server/routes/quotation-routes.ts` | Eligibility on create/update/confirm/HOD; schema columns; eligible-products API |
| `backend/src/server/routes/gm-pool-routes.ts` | `quotationId` required (non-admin); link + consume quotation |
| `backend/src/server/utils/gm-sales-permissions.ts` | Stricter invoice gate for sales executives |
| `backend/src/server/tests/sales-workflow.service.test.ts` | Unit tests |
| `frontend/src/components/my-quotations-widget.tsx` | Create GM vs Create Invoice actions |

## Schema (runtime ensure, idempotent)

- `quotations`: `downstream_kind`, `primary_followup_id`, `converted_gm_id`
- `quotation_items`: `followup_id`, `followup_detail_id`
- `drm.gm_entries`: `quotation_id`

## Tests executed

```bash
cd backend && npx vitest run src/server/tests/sales-workflow.service.test.ts
```

**Result:** `sales-workflow.service.test.ts` — **2 passed** (2026-10-26 local vitest).

End-to-end HTTP scenarios (follow-up → quote → HOD → GM/invoice) require dev Postgres + auth — **not executed** in this session.

## Deployment

Deploy backend + frontend together. First request to quotation/GM routes applies additive columns. Smoke-test sales executive and HOD paths on staging.

## Confirmation

**No files under `DRMBackup10_09_26/` were modified during this WebExcels implementation pass.**
