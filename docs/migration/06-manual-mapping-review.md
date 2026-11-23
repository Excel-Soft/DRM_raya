# Phase 1F — Manual schema mapping verification

**Date:** 2026-11-04  
**Scope:** Read-only review of `old_drm_database.sql` vs `backend/src/shared/schema.ts`, routes, services, `ensure.ts`, and `backups/drm_production_20261103_095751.sql` (header/structure only).  
**Safety:** No imports, no DDL, no `.env`/Supabase/PM2/Nginx changes.

## Executive summary

Automated name matching incorrectly routed legacy **`activity_logs`** to **`user_activities`** and mapped **`user_id` → `user_activities.id`**. Code review shows:

- **`drm.activity_logs`** — audit trail (`ActivityLogService`, `recordAuditLog`, `audit-log-routes.ts`).
- **`drm.user_activities`** — sales/finance **activity feed** for reports (`user_activity_type` enum: GM, Invoice, VAS, …).

These are **different business entities**. The updated CSV maps legacy `activity_logs` / `webxl_activity_logs` to **`activity_logs`** with **`user_id` → `userId`** (UUID via legacy user map).

## Method

1. Parsed all **166** MySQL `CREATE TABLE` blocks and **159** Drizzle tables.
2. Cross-checked **legacy table names** in `schema.ts` comments, `ensure.ts`, and route files (not name similarity alone).
3. Assigned each legacy table a **classification** ([`07-legacy-table-classification.csv`](./07-legacy-table-classification.csv)).
4. Regenerated [`drm-schema-mapping.csv`](./drm-schema-mapping.csv) with verification columns; backup at [`drm-schema-mapping.automated-backup.csv`](./drm-schema-mapping.automated-backup.csv).

## Table-level verification highlights

| MySQL table | Postgres target | Same entity? | PK compatibility | Evidence |
|-------------|-----------------|--------------|------------------|----------|
| `webxl_user` | `users` | Yes (staff) | `user_id` int → `users.id` UUID | `account-routes.ts` legacy `webxl_user` |
| `webxl_company` | `customers` | Yes (company/customer) | `id` int → `customers.id` UUID; `com_id` → `drm_id` | `gm-pool-routes.ts`, `account-routes.ts` |
| `webxl_followup` | `follow_ups` | Yes (sales follow-up) | int → varchar/uuid ids | CRM `follow_ups` |
| `webxl_followup_service` | `diagnose_followups` | Yes (Diagnose Report) | int → uuid | `schema.ts`, `diagnose-followup-routes.ts`, `ensure.ts` |
| `webxl_follow_up_services` | *(split)* | Partial overlap | FK to `webxl_followup` | Junction + manager fields; **MANUAL_DECISION** |
| `webxl_invoice` | `invoices` | Yes (modern invoice) | `invoice_id` → uuid | `account-routes.ts` |
| `tbl_invoices` / `tbl_customers` | `invoices` / `customers` | **Different era** | Incompatible shapes | **DUPLICATE_SOURCE** |
| `activity_logs` | `activity_logs` | Yes (audit) | int → uuid | `activity-service.ts` |
| `webxl_activity_logs` | `activity_logs` | Duplicate of above | Same | 0 rows in dump |
| `password_resets` | `password_reset_tokens` | Yes (tokens) | Map `user_id` via user join | `auth.routes.ts` |
| `webxl_password_reset_emails` | *(none)* | **No** (email log) | N/A | **LEGACY_ARCHIVE** |
| `webxl_task_links` | `link_reports` (+ posting links) | Yes (link report) | int → uuid | `link-report.service.ts` |
| `webxl_gmaccount` | `gm_entries` / BV | **Unclear 1:1** | int ids | `reports-routes.ts` — **MANUAL_DECISION** |
| `webxl_projects` vs `webxl_create_project` | `projects` | **Not same** | Minimal vs rich | See §Duplicate sources |
| `webxl_vas_comm_final` | `webxl_vas_comm_final` | Yes | Same table name | `schema.ts`, `ensure.ts` |

Full per-table classification: **62** `TRANSFORM_AND_MIGRATE` + **1** `DIRECT_MIGRATION`, **70** `LEGACY_ARCHIVE`, **24** `MANUAL_DECISION`, **5** `DUPLICATE_SOURCE`, **5** `STRUCTURE_ONLY`.

## Column-level corrections (critical)

| Issue | Wrong automated mapping | Verified mapping |
|-------|-------------------------|----------------|
| Audit actor | `activity_logs.user_id` → `user_activities.id` | `activity_logs.user_id` → `activity_logs.userId` + **legacy user UUID map** |
| Audit target table | *(missing)* | `table_name` → `resourceType` |
| Audit target id | *(missing)* | `record_id` → `resourceId` (varchar) |
| Audit action | `action_type` → generic camel | `action_type` → `action`; narrative → `details` JSON |
| Reset token user | `password_resets.user_id` → token row `id` | **REJECTED** — resolve **email** from legacy user; map to `password_reset_tokens.email` |
| Customer owner | `assignId` → random id | `webxl_company.assignId` → `customers.ownerUserId` (UUID map) |
| Diagnose report | N/A | `webxl_followup_service.uid/com_id` → `userId` / `companyId` |

**Rule applied globally:** `*_user_id`, `uid`, `assignId`, `manager_id`, `hod_id`, `sm_id` → **`users.id` UUID via `migration_legacy_ids`**, never the destination row’s primary key unless that column **is** the legacy user PK on `webxl_user`.

**Rule for customers:** `com_id`, `customerid` → **`customers.id` UUID map** or `drm_id` when the legacy column is the string DRM id.

## Duplicate legacy sources (Task 3)

### `tbl_customers` vs `webxl_company`

| Aspect | `tbl_customers` | `webxl_company` |
|--------|-----------------|-----------------|
| Entity | Person-centric CRM record (45 cols, ints for title/type) | Company master used across DRM (`assignId`, `com_id`, `crm_id`) |
| Rows in dump | 14 INSERT stmts | 1133 INSERT stmts |
| Modern target | Only via reconciliation | **`customers`** (authoritative for app) |
| Decision | **DUPLICATE_SOURCE** — do not merge blindly | **Primary source** for customer migration unless business proves otherwise |

### `tbl_invoices` vs `webxl_invoice`

| Aspect | `tbl_invoices` | `webxl_invoice` |
|--------|----------------|-----------------|
| PK | `invoiceid` | `invoice_id` |
| Customer link | `customerid` (tbl) | `com_id` (webxl company int) |
| Rows | 17 INSERT stmts | 58 INSERT stmts |
| Decision | **DUPLICATE_SOURCE** — archive or manual reconcile | **Preferred** for modern `invoices` mapping |

### `activity_logs` vs `webxl_activity_logs`

- **Same DDL shape**; `webxl_activity_logs` has **0** rows in this dump.
- **Merge policy:** Load into `activity_logs` with dedup key `(user_id, created_at, action_type, record_id)` if both ever populated.

### `password_resets` vs `webxl_password_reset_emails`

- **`password_resets`:** token lifecycle → **`password_reset_tokens`**.
- **`webxl_password_reset_emails`:** outbound email success/failure log → **LEGACY_ARCHIVE** (not token table).

### `webxl_followup` vs `webxl_followup_service` vs `webxl_follow_up_services`

| Table | Role | Modern target |
|-------|------|---------------|
| `webxl_followup` | Call-centric follow-up rows | `follow_ups` |
| `webxl_followup_service` | Diagnose / account-health survey | `diagnose_followups` |
| `webxl_follow_up_services` | Service lines attached to a follow-up + manager/SM/HOD thread | Partial overlap with `follow_ups` + `followup_services`; **MANUAL_DECISION** (may need staging table) |

### `webxl_gmaccount` vs `webxl_gmaccount_history` vs `webxl_gm_account_history`

| Table | Role | Target |
|-------|------|--------|
| `webxl_gmaccount` | Current GM/BV period fields | Candidate **`gm_entries`** / BV data — **not 1:1** |
| `webxl_gmaccount_history` | Short BV history | **LEGACY_ARCHIVE** |
| `webxl_gm_account_history` | Full row audit (`operation` enum) | **LEGACY_ARCHIVE** (0 rows in dump) |

### `webxl_projects` vs `webxl_create_project`

- **`webxl_projects`:** id + name only — **not** equivalent to modern **`projects`** lifecycle.
- **`webxl_create_project`:** `com_id`, `user_id`, `manager`, `project`, `detail` — **closer** to modern project creation; **prefer** for migration mapping, keep `webxl_projects` as lookup/archive.

## Migration readiness by module (Task 8)

| Module | Readiness | Rationale |
|--------|-----------|-----------|
| Users and roles | **NEEDS_TRANSFORMATION** | `webxl_user.user_id` → UUID; roles/permissions need map; passwords/hashes |
| Customers | **NEEDS_BUSINESS_DECISION** | `tbl_*` vs `webxl_company`; UUID + `drm_id` |
| Sales and follow-ups | **NEEDS_TRANSFORMATION** | High volume; `webxl_follow_up_services` unsettled |
| Tasks and projects | **NEEDS_BUSINESS_DECISION** | `webxl_task_assign` vs `tasks`/`project_assignments`; dual project tables |
| Attendance and HR | **NEEDS_TRANSFORMATION** | `webxl_attendance` mappable; monthly/raw tables **archive** |
| Invoices and accounting | **NEEDS_BUSINESS_DECISION** | Duplicate invoice sources; quotation raw table; COA partial |
| GM and financial records | **NEEDS_BUSINESS_DECISION** | `gmaccount` vs `gm_entries`; verify_gm* family |
| Reports and history | **NOT_IN_MODERN_SCHEMA** | `webxl_com_history`, `webxl_log_history`, many `*_history` — archive-first |
| Other legacy (events, portfolio, social) | **NEEDS_TRANSFORMATION** / archive mix | Prefix rules in classification CSV |

**No module is `READY_FOR_DRY_RUN` end-to-end** without Phase 2 staging DDL, ID map tables, and business sign-off on duplicate sources.

## Column mapping statistics (updated CSV)

| mapping_status | Rows |
|----------------|-----:|
| NO_TARGET_TABLE | 774 |
| NEEDS_MANUAL_REVIEW | 734 |
| TRANSFORMATION_REQUIRED | 178 |
| MATCH | 179 |

| verified_status | Rows |
|-----------------|-----:|
| VERIFIED | 21 |
| INFERRED | 336 |
| UNVERIFIED | 733 |
| NO_TARGET | 774 |
| REJECTED | 1 |

## Recommended Phase 2 approach

1. **Create migration-only tables** in `drm_legacy_stage` (not production): `migration_legacy_ids`, `migration_rejects`, optional **archive** schema for `LEGACY_ARCHIVE` tables.
2. **Load order:** `users` → `customers` → dimensions (roles, departments, services) → transactional (follow_ups, invoices, gm_entries, attendance).
3. **Custom streaming ETL** driven by updated CSV + [`08-id-mapping-strategy.md`](./08-id-mapping-strategy.md) + [`09-data-transformation-rules.md`](./09-data-transformation-rules.md).
4. **Do not** pgloader directly from MySQL dump; optional throwaway MariaDB only if team prefers SQL replay over INSERT parsing.
5. **First dry run** on `drm_legacy_stage` only, with row-count and orphan checks — still **no Supabase** until explicit cutover approval.

## Artifacts

| File | Purpose |
|------|---------|
| [`drm-schema-mapping.csv`](./drm-schema-mapping.csv) | Column mapping + verification columns |
| [`drm-schema-mapping.automated-backup.csv`](./drm-schema-mapping.automated-backup.csv) | Pre-1F automated output |
| [`07-legacy-table-classification.csv`](./07-legacy-table-classification.csv) | Per-table scope class |
| [`08-id-mapping-strategy.md`](./08-id-mapping-strategy.md) | ID / FK strategy |
| [`09-data-transformation-rules.md`](./09-data-transformation-rules.md) | Type/value transforms |
| [`10-unresolved-business-decisions.md`](./10-unresolved-business-decisions.md) | Decisions required from business |

## Regeneration

```bash
python3 docs/migration/_generate_phase1f.py
```
