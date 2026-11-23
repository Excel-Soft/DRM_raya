# Phase 1B — Target application schema audit

**Primary source:** `backend/src/shared/schema.ts` (Drizzle ORM, PostgreSQL)  
**Secondary reference (read-only):** `backups/drm_production_20261103_095751.sql` (Supabase production schema export)  
**Audit date:** 2026-11-04

Production runtime uses **Supabase PostgreSQL** (via `backend/.env`). This audit did **not** connect to Supabase or change any environment files.

## 1. Target schema overview

| Property | Value |
|----------|--------|
| PostgreSQL schema name | **`drm`** (`pgSchema("drm")`) |
| Tables in Drizzle (`drmSchema.table`) | **159** |
| Approx. total columns (parsed) | **2091** |
| Local app DB on VPS | `drm_postgres` (unchanged in Phase 1) |
| Local PostgreSQL version | **16.15** (localhost only) |

## 2. Production reference dump (`backups/`)

| File | Notes |
|------|--------|
| `drm_production_20261103_095751.sql` | Plain SQL, **pg_dump 17.11** from server **PostgreSQL 17.6**, `drm` schema |
| `drm_production_20261103_095751.dump` | Custom format archive |
| `drm_production_20261103_095751.sql.gz` | Compressed SQL |

The SQL header confirms **UTF8** and **`standard_conforming_strings = on`**. Table count in dump scan: **278** `CREATE TABLE` lines (includes multiple schemas / partitions / duplicates vs Drizzle — treat Drizzle as the **application contract**, dump as **deployment reference**).

**Compatibility note:** Reference production is **PG 17**; migration staging on VPS is **PG 16**. Most DDL from the dump is PG16-compatible, but new PG17-only features in the dump should be filtered before applying to `drm_legacy_stage`.

## 3. Enum and type model (application)

Drizzle defines **Postgres enums in schema `drm`** via `drmSchema.enum(...)`, including (non-exhaustive):

- `pipeline_stage`, `customer_status`, `followup_status`, `followup_method`, `followup_outcome`
- `project_status`, `task_status`, `task_priority`, `task_category`
- `invoice_status`, `ledger_entry_type`, `gm_entry_type`, `gm_entry_status`
- `attendance_status`, `leave_type`, `leave_status`, `loan_status`, `overtime_status`
- `account_head_category` (Assets / Liabilities / OwnerEquity / Revenue / Expenses)
- `support_*`, `training_*`, `payment_method`, `cheque_status`, etc.

Legacy MySQL **ENUM** columns rarely match these labels exactly (case and vocabulary differ). Expect **`TYPE_CONVERSION_REQUIRED`** plus lookup tables or mapped values.

## 4. ID and relationship assumptions (modern app)

From schema patterns and backend comments:

- **Users:** `users.id` (integer/uuid per column — see schema); legacy `webxl_user.user_id` is the historical staff key.
- **Customers:** `customers` table; legacy **`webxl_company`** (not named “customers” in MySQL).
- **Follow-ups:** `follow_ups`, `followup_services`, **`diagnose_followups`** (legacy `webxl_followup_service`).
- **Financial:** `gm_entries`, `invoices`, `ledger_entries`, dollar tables, `ab_closing_history`, etc.
- **Tasks / links:** `tasks`, link-report tables; legacy **`webxl_task_links`** is high volume.
- One table retains legacy name: **`webxl_vas_comm_final`** (explicit in schema).

Many modern tables **have no legacy table of the same name** (copilot_*, product_posting_*, software_*, service_* expansions).

## 5. Migrations and code references

- Schema is centralized in **`backend/src/shared/schema.ts`** (~159 tables).
- Supplemental DDL guards exist in **`backend/src/server/db/ensure.ts`** (creates/alters missing pieces at runtime — migration must align with final Drizzle shape, not older ensure patches alone).
- Legacy table names appear in route comments (e.g. `account-routes.ts`, `link-report.service.ts`) — useful for **manual mapping** validation.

## 6. Target table inventory (Drizzle)

| Postgres table (`drm.*`) | ~Columns |
|--------------------------|----------:|
| `ab_closing_history` | 11 |
| `ab_payments` | 23 |
| `ab_report_notes` | 5 |
| `account_heads` | 14 |
| `activities` | 9 |
| `activity_logs` | 8 |
| `allowed_ips` | 6 |
| `appointments` | 9 |
| `assignment_ratio_overrides` | 15 |
| `attendance` | 13 |
| `attendance_edit_requests` | 17 |
| `attributes` | 11 |
| `branches` | 10 |
| `business_customers` | 14 |
| `bv_entries` | 19 |
| `bv_reports` | 23 |
| `call_sessions` | 14 |
| `cheque_pool` | 13 |
| `cheques` | 13 |
| `communication_logs` | 18 |
| `copilot_action_executions` | 8 |
| `copilot_action_proposals` | 10 |
| `copilot_audit_log` | 14 |
| `copilot_conversations` | 6 |
| `copilot_drafts` | 11 |
| `copilot_messages` | 6 |
| `copilot_runs` | 11 |
| `copilot_tool_calls` | 9 |
| `cross_department_status_history` | 20 |
| `customer_contacts` | 12 |
| `customers` | 43 |
| `department_team_commissions` | 17 |
| `departments` | 10 |
| `diagnose_followups` | 16 |
| `diagnosis_reports` | 15 |
| `dollar_advance_payments` | 12 |
| `dollar_allocations` | 11 |
| `dollar_buyers` | 8 |
| `dollar_buying` | 25 |
| `donations` | 9 |
| `drm_policies` | 12 |
| `employee_bonuses` | 12 |
| `follow_ups` | 16 |
| `followup_services` | 3 |
| `followup_subservices` | 3 |
| `gm_bv_commission_verifications` | 15 |
| `gm_commission_adjustments` | 8 |
| `gm_commission_records` | 15 |
| `gm_commission_slabs` | 12 |
| `gm_entries` | 51 |
| `gm_loan_terms` | 14 |
| `gm_partial_receipts` | 12 |
| `gm_pool_entries` | 13 |
| `gm_reports` | 16 |
| `impersonation_audit_logs` | 7 |
| `increment_evaluations` | 32 |
| `invoices` | 22 |
| `it_backups` | 8 |
| `it_domains` | 15 |
| `it_hosting_packages` | 6 |
| `it_registries` | 5 |
| `it_servers` | 15 |
| `journal_voucher_lines` | 8 |
| `journal_vouchers` | 16 |
| `lead_activities` | 7 |
| `lead_services` | 5 |
| `leave_requests` | 15 |
| `ledger_entries` | 23 |
| `link_report_commission_verifications` | 13 |
| `link_reports` | 12 |
| `loan_reports` | 22 |
| `loan_requests` | 14 |
| `meetings` | 19 |
| `notice_assignments` | 6 |
| `notices` | 10 |
| `notification_outbox` | 16 |
| `notifications` | 13 |
| `office_expenses` | 12 |
| `office_vas` | 9 |
| `opportunities` | 10 |
| `overtime_records` | 12 |
| `password_reset_tokens` | 6 |
| `penalties` | 31 |
| `permissions` | 7 |
| `physical_assets` | 23 |
| `policies` | 6 |
| `portfolio_reservations` | 17 |
| `portfolios` | 11 |
| `product_posting_commission_slabs` | 13 |
| `product_posting_data` | 12 |
| `product_posting_evidence_links` | 15 |
| `product_posting_invoices` | 35 |
| `product_posting_phase_definitions` | 7 |
| `product_posting_rework_history` | 9 |
| `product_posting_workflows` | 30 |
| `project_approvals` | 12 |
| `project_assignments` | 6 |
| `project_dependencies` | 11 |
| `project_details` | 13 |
| `project_documents` | 7 |
| `project_financials` | 8 |
| `project_payments` | 9 |
| `projects` | 20 |
| `queue_sales_entries` | 12 |
| `refund_gm_entries` | 10 |
| `restricted_keywords` | 3 |
| `role_permissions` | 5 |
| `roles` | 5 |
| `salary_run_items` | 33 |
| `salary_runs` | 22 |
| `service_activities` | 14 |
| `service_complaints` | 16 |
| `service_customer_feedback` | 6 |
| `service_customers` | 16 |
| `service_dropouts` | 14 |
| `service_followups` | 16 |
| `service_pool_entries` | 12 |
| `service_renewals` | 16 |
| `service_sample_requests` | 6 |
| `service_sub_subservices` | 14 |
| `service_subservices` | 14 |
| `service_targets` | 9 |
| `services` | 13 |
| `social_accounts` | 15 |
| `social_media_posts` | 26 |
| `software_commission_slabs` | 9 |
| `software_evidence_links` | 10 |
| `software_phase_definitions` | 7 |
| `software_rework_history` | 9 |
| `software_workflows` | 27 |
| `support_channel_config` | 5 |
| `support_messages` | 5 |
| `support_tickets` | 15 |
| `target_system_daily_targets` | 5 |
| `target_system_kwa_history` | 9 |
| `target_system_kwa_records` | 14 |
| `target_system_targets` | 15 |
| `target_system_user_targets` | 17 |
| `targets` | 11 |
| `task_comments` | 5 |
| `task_files` | 7 |
| `task_results` | 6 |
| `task_status_history` | 7 |
| `task_templates` | 10 |
| `task_time_extensions` | 7 |
| `task_time_logs` | 8 |
| `tasks` | 24 |
| `team_performance_snapshots` | 13 |
| `temp_contacts` | 18 |
| `temp_gm_entries` | 10 |
| `training_modules` | 14 |
| `training_progress` | 10 |
| `url_permissions` | 10 |
| `user_activities` | 14 |
| `users` | 18 |
| `vas_progress_snapshots` | 7 |
| `vas_reports` | 16 |
| `webxl_vas_comm_final` | 17 |
| `workflow_status_history` | 15 |

## 7. Unresolved questions

1. Which legacy financial source wins where both **`tbl_invoices`** and **`webxl_invoice`** exist?
2. Are **`webxl_projects`** (2 columns, minimal) and **`webxl_create_project`** the same domain as modern **`projects`**?
3. Should high-volume history tables (`webxl_com_history`, `webxl_log_history`) map to modern tables or archive-only storage?
4. Confirm UUID vs serial strategy per table in live Supabase (Drizzle file uses mixed types).

## 8. Commands used

```bash
rg -c 'drmSchema\.table\(' backend/src/shared/schema.ts
python3  # parse schema.ts for table/column names
head -n 30 backups/drm_production_20261103_095751.sql
```
