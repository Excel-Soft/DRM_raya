# Phase 2C — Recommended next module (post-pilot)

**Status:** Awaiting explicit approval before any further modern transforms.

## Completed in Phase 2C

| Module | Rows | Notes |
|--------|------:|-------|
| `webxl_vas_comm_final` → `drm.webxl_vas_comm_final` | 1,858 | Only **DIRECT_MIGRATION** in [`07-legacy-table-classification.csv`](./07-legacy-table-classification.csv) |

## Recommended order (evidence-based, not scheduled)

### Option A — Small reference data with existing `drm` table (preferred next)

**Candidate:** `webxl_attribute` → `drm.attributes`

| Pro | Con |
|-----|-----|
| Low INSERT volume in dump (1 statement) | Requires **NEW_UUID** + legacy id map |
| Clear product/domain name in classification | May need dependency checks (services/catalog) |
| Target table likely already in 147-table set | Column mapping mostly **INFERRED** in CSV — needs schema.ts verification |

**Prerequisites:** Document column map; confirm target table DDL on staging; no FK to unmigrated parents.

### Option B — DDL completion batch (parallel track, no data)

Apply targeted **`ddl/04_drm_schema_supplement.sql`** (to be authored) for the **12 remaining** missing tables from [`13-modern-schema-ddl-review.md`](./13-modern-schema-ddl-review.md), starting with dependency roots:

1. `departments`, `branches`
2. `ab_closing_history`, `ab_report_notes`
3. `task_files`, `cheque_pool`, …

Does not migrate data; unblocks modules that target those tables.

### Option C — Auth-adjacent token table

**Candidate:** `password_resets` → `password_reset_tokens`

| Pro | Con |
|-----|-----|
| Single INSERT in dump | **Security-sensitive** — likely expire/archive tokens rather than activate |
| Mapped in classification | Requires **user UUID map** |

**Not recommended** until user migration strategy is approved.

## Explicitly blocked until business decisions

| Decision | Tables / domains |
|----------|------------------|
| D1 | `tbl_customers` vs `webxl_company` |
| D2–D3 | `tbl_invoices`, receipts, line items |
| D4 | `activity_logs` vs `webxl_activity_logs` |
| D5–D7 | Follow-up family |
| D8–D10 | GM/BV verification |
| D11–D13 | Projects / tasks / link routing |

Do not migrate duplicate-source groups without reconciliation rules.

## User / customer foundation

Most **TRANSFORM_AND_MIGRATE** rows need:

- `migration_meta.migration_legacy_ids` for `users` and `customers`
- Approved duplicate policy (D1, D2)

Pilot intentionally avoided this by choosing integer-`user_id` ledger with no FK.

## Suggested approval gate for Phase 2D

1. Confirm next module choice (A/B/C or alternate).
2. If Option B: review and apply supplement DDL on `drm_legacy_stage` only.
3. If Option A or C: publish module-specific plan mirroring [`24-pilot-migration-plan.md`](./24-pilot-migration-plan.md).
4. Run batch smoke + full table with same validation matrix as pilot.

## Missing DDL tracker (updated)

| Table | Required for |
|-------|----------------|
| `ab_closing_history` | `webxl_ab_closing_history` transform |
| `ab_report_notes` | AB reporting |
| `branches`, `departments` | Org structure FKs |
| `cheque_pool` | Cheque workflows |
| `department_team_commissions` | Commissions |
| `diagnose_followups` | `webxl_followup_service` (D5) |
| `dollar_advance_payments`, `dollar_allocations` | Dollar module |
| `gm_bv_commission_verifications` | BV verify panel (distinct from VAS pilot table) |
| `target_system_kwa_history` | Target KWA |
| `task_files` | Task attachments |

`webxl_vas_comm_final` — **created** (pilot).
