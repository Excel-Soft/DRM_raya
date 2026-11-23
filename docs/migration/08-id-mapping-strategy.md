# Phase 1F — ID and relationship mapping strategy

**Applies to:** Migration into `drm_legacy_stage` (Phase 2+). **Does not** modify production databases in Phase 1.

## Core principle

Legacy **`ndrm`** uses **integer** (and occasional **varchar business keys** such as `com_id`). Modern **`drm.*`** uses **`uuid`** for most primary and foreign keys. **Matching integers across tables does not prove the same entity** after migration.

## Global infrastructure (Phase 2 DDL — staging only)

Proposed helper table (name fixed in Phase 2):

```sql
-- Example shape only — not executed in Phase 1
CREATE TABLE drm.migration_legacy_ids (
  entity_type text NOT NULL,          -- 'user', 'customer', 'follow_up', ...
  legacy_table text NOT NULL,
  legacy_id text NOT NULL,            -- stringified int or natural key
  modern_id uuid NOT NULL,
  modern_table text NOT NULL,
  PRIMARY KEY (entity_type, legacy_table, legacy_id)
);
```

All ETL steps **resolve FKs through this map** (or through `customers.drm_id` for string DRM ids).

## Per-entity strategies

### Users (`webxl_user` → `users`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| PK `user_id` (int) | `users.id` (uuid) | **Generate new UUID** per row; store in `migration_legacy_ids` |
| Login identity | `username`, `email` | Copy with uniqueness checks; duplicates → `migration_rejects` |
| Password | `password_hash` / deprecated `password` | Import hash only if format recognized; **never log** |
| Attendance link `att_id` | — | **MANUAL** — may map to HR external id or ignore |

**FK rule:** Any legacy `user_id`, `uid`, `assignId`, `manager_id`, `hod_id`, `sm_id`, `added_by` → lookup **`modern_id`** where `entity_type='user'`.

### Customers (`webxl_company` → `customers`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| PK `id` (int) | `customers.id` (uuid) | **Generate UUID**; map legacy int |
| `com_id` (varchar) | `customers.drm_id` | **Preserve string** when unique |
| `assignId` | `customers.ownerUserId` | User map |
| `crm_id` | `customers.crmId` | Direct copy |

**`tbl_customers.customerid`:** Do **not** assume equal to `webxl_company.id`. Reconcile via email/phone/NTN or manual rules before insert.

### Follow-ups (`webxl_followup` → `follow_ups`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| PK `id` | `follow_ups.id` (varchar/uuid in app) | New id + map; preserve legacy in map |
| `com_id` | `customerId` | Customer map |
| `uid` | `assignedTo` / `createdBy` | User map (confirm column semantics per row type) |

### Diagnose follow-ups (`webxl_followup_service` → `diagnose_followups`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| PK `id` | `diagnose_followups.id` | New UUID |
| `com_id`, `uid` | `companyId`, `userId` | FK maps |

### Invoices (`webxl_invoice` → `invoices`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| PK `invoice_id` | `invoices.id` | New UUID + map |
| `com_id` | `customerId` | Customer map |
| `qou_id` | `quotationId` | Quotation map (uuid in prod) |

**`tbl_invoices`:** Separate map namespace (`entity_type='tbl_invoice'`) until reconciled with `webxl_invoice`.

### GM (`webxl_gmaccount`, `webxl_verify_gm*`, `webxl_tem_gm`, `webxl_refund_gm`)

| Legacy | Modern | Strategy |
|--------|--------|----------|
| Various int PKs | `gm_entries`, `temp_gm_entries`, `refund_gm_entries` | **Business decision** on which legacy rows become which `gm_type` |
| `com_id`, `user_id` | customer/sales maps | Standard FK translation |

Modern **`gm_entries.id`** is **varchar** — use consistent string/uuid policy per production Supabase (validate against reference dump in Phase 2).

### Tasks / links

| Legacy | Modern | Strategy |
|--------|--------|----------|
| `webxl_task_links.id` | `link_reports.id` and/or `product_posting_evidence_links.id` | **Split** by `source_module` rules in `link-report.service.ts` |
| `webxl_task_assign` | `tasks`, `project_assignments` | Decompose row; map project/task ids |

### Sequences / identity

| Table type | Strategy |
|------------|----------|
| `ab_payments.id` (serial) | Let PostgreSQL assign or preserve with `OVERRIDING SYSTEM VALUE` if legacy id required |
| `webxl_vas_comm_final` | **DIRECT_MIGRATION** — preserve integer ids if PG column is integer/serial |
| Drizzle `defaultRandom()` uuid PKs | Always **new uuid** unless restoring from existing Supabase export |

After bulk load, run `setval` on serials where legacy max ids were preserved.

## Relationship dependency order (recommended load)

1. `users` (+ roles/departments if in scope)
2. `customers` (+ contacts optional)
3. `services` / `attributes` (if migrated from legacy)
4. `follow_ups`, `diagnose_followups`, quotations
5. `invoices`, `gm_entries`, dollar tables, expenses
6. `attendance`, leave, overtime, penalties
7. `activity_logs`, archives, history tables
8. Commission / link report / target system tables

MySQL-enforced FKs (only 4) are a **subset**; app-level FKs dominate.

## Verification queries (Phase 2 dry run)

- Orphan users: child rows with legacy user id not in map
- Orphan customers: `com_id` not in map
- Duplicate `drm_id` on customers
- `COUNT(*)` per table vs INSERT-statement-derived estimates from Phase 1A

## Explicit non-goals (Phase 1)

- No ID map tables created on server
- No sequence adjustments
- No assumption that Supabase existing UUIDs match legacy ints
