# Next modules after D1 + D2 (staging)

**Done on `drm_legacy_stage`:** users, customers, attributes, follow_ups, diagnose_followups, invoices (headers only), gm_entries (verify GM).

## Recommended order (Wave 3 → 5)

### Wave 3 — Fix D2 gaps + sales workflow (do first)

| Priority | Module | Source | Target | Archive rows (approx.) | Why |
|----------|--------|--------|--------|----------------------:|-----|
| **3A** | Invoice line items | `webxl_invoice_item` | Update `drm.invoices.items` JSON | **~14,665** | Invoice UI ab sparse hai |
| **3B** | Quotations | `webxl_quotations` + `webxl_quotation_items` | `drm.quotations` (+ lines) | **~5,931** + **~11,035** | Dashboard `/api/sales/quotations/*`, HOD workflow |
| **3C** | Payments (optional) | `webxl_payments` | ledger / invoice link | **~10,625** | Paid status reconcile with invoices |

**Decision:** D2 invoices = **webxl only** (already applied). `tbl_invoices` / `tbl_invitems` stay archive-only unless business reopens D2/D3.

### Wave 4 — HR + leads (medium volume, clearer maps)

| Priority | Module | Source | Target | Archive rows (approx.) |
|----------|--------|--------|--------|----------------------:|
| **4A** | Attendance | `webxl_attendance` | `drm.attendance` | **~483,212** (batched) |
| **4B** | Leads | `webxl_leads` → `drm.opportunities` | **158,565** loaded — see [57-module-leads-migration-plan.md](./57-module-leads-migration-plan.md) |

### Wave 5 — Needs business call before ETL

| ID | Module | Blocker |
|----|--------|---------|
| **D5** | `webxl_follow_up_services` (~55k) | Target split: `followup_services` vs staging |
| **D12–D13** | `webxl_task_assign`, `webxl_task_links` (~844k links) | Task vs posting evidence routing |
| **D8–D9** | `webxl_gmaccount`, `webxl_verify_gm_*` extras | Extend GM vs archive (verify GM already loaded) |
| **D14–D16** | `webxl_com_history`, `webxl_com_detail` | Communication logs vs archive-only |

### Usually later / archive-first

- `webxl_task_links` (844k) — after D13
- `webxl_com_history` (218k) — after comms decision
- `password_resets` — security policy (expire vs migrate)
- `tbl_*` parallel domains — only with explicit merge rules

## Suggested next execution (one approval)

**Start Wave 3A + 3B together:** invoice items backfill, then quotations ETL — biggest Mac-visible win after D2.

## Prerequisites (every module)

1. `migration_legacy_ids` for users + customers (done).
2. `drm_app` GRANT on new tables.
3. Mac: `SKIP_SCHEMA_ENSURE=true` until schema aligned.
4. Dry-run → execute on **`drm_legacy_stage` only**.
