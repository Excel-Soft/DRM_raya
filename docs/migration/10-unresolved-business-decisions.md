# Phase 1F — Unresolved business decisions

Decisions required **before** Phase 2 dry run. No default choice discards legacy data.

## Duplicate sources (must pick or reconcile)

| ID | Topic | Options | Impact |
|----|-------|---------|--------|
| D1 | **`tbl_customers` vs `webxl_company`** | (a) webxl only (b) merge both (c) tbl only (d) parallel import + manual link | Customer UUID map, duplicates, CRM history |
| D2 | **`tbl_invoices` vs `webxl_invoice`** | (a) webxl only (b) merge (c) tbl archive | Invoice totals, quotation links |
| D3 | **`tbl_invitems` / `tbl_receipts`** | Archive vs map to modern invoice/payment model | Accounting integrity |
| D4 | **`activity_logs` vs `webxl_activity_logs`** | Single target `activity_logs`; dedup policy if both populated | Audit trail completeness |

## Follow-up domain

| ID | Topic | Notes |
|----|-------|-------|
| D5 | **`webxl_follow_up_services`** target | Split across `follow_ups`, `followup_services`, new staging table, or archive | 1143 INSERT stmts; FK to `webxl_followup` |
| D6 | **`webxl_last_followup`** | Snapshot vs derive from `follow_ups` | 259 INSERT stmts |
| D7 | **`webxl_dhm_followup`** | Related to diagnose vs sales follow-up | Low row count |

## GM / BV / verification

| ID | Topic | Notes |
|----|-------|-------|
| D8 | **`webxl_gmaccount` → `gm_entries`?** | Shape differs (BV dates vs order GM) | `reports-routes.ts` references bvDate |
| D9 | **`webxl_verify_gm*` family** | Extend `gm_entries` vs separate archive | Payment status text in legacy |
| D10 | **`gm_history_set` / `gm_history_set_items`** | No Drizzle target; tie to verify GM workflow? | 0 rows in dump for sets |

## Projects and tasks

| ID | Topic | Notes |
|----|-------|-------|
| D11 | **`webxl_projects` vs `webxl_create_project`** | Use create_project as primary | Minimal name list vs full rows |
| D12 | **`webxl_task_assign` (1324 stmts)** | Map to `tasks`, `project_assignments`, or both | 37 columns — partial fit |
| D13 | **`webxl_task_links` split** | `link_reports` vs `product_posting_evidence_links` routing | 4431 INSERT stmts |

## Communication / history (`webxl_com_*`, logs)

| ID | Topic | Notes |
|----|-------|-------|
| D14 | **`webxl_com_history` (2966 stmts)** | `communication_logs` vs archive-only | No code reference located |
| D15 | **`webxl_log_history` (571 stmts)** | Archive vs user activity | |
| D16 | **`webxl_com_detail` (542 stmts)** | Customer communication detail | |

## HR / attendance

| ID | Topic | Notes |
|----|-------|-------|
| D17 | **`attendance_auto_settings`** | Feature flag in modern app? | 1 row |
| D18 | **`webxl_raw_attendence` / `webxl_attendance_month*`** | Archive vs import into `attendance` | Raw staging pattern |
| D19 | **`webxl_addvance_salary`, `webxl_tem_salary_ship`, `webxl_increments`** | Map to `salary_runs` / `increment_evaluations` or archive | |

## IT / misc legacy modules

| ID | Topic | Notes |
|----|-------|-------|
| D20 | **`webxl_event*`** | No modern module — archive? | |
| D21 | **`webxl_portfolio*`** | Map to `portfolios` / `portfolio_reservations` | |
| D22 | **`webxl_messager`, `webxl_whatsapp`** | vs `support_channel_config` | |
| D23 | **`webxl_drm_setting`** | System settings store location in modern app | |

## Cutover / scope

| ID | Topic | Notes |
|----|-------|-------|
| D24 | **Supabase vs `drm_legacy_stage` only** | Phase 2 dry run stays on VPS staging; production cutover date TBD | |
| D25 | **Historical archive schema** | Keep `LEGACY_ARCHIVE` tables as read-only schema vs CSV exports | 70 tables classified archive/unknown |

## Count summary

| Category | Count |
|----------|------:|
| Duplicate-source groups (table-level) | **5** tables (+ 3 tbl_* companions) |
| `MANUAL_DECISION` tables | **24** |
| `LEGACY_ARCHIVE` tables | **70** |
| Documented decision items above | **25** (D1–D25) |

## Owners (suggested)

| Area | Suggested owner |
|------|-----------------|
| D1–D3, D14–D16 | Sales + Account management |
| D8–D10, D24 | Finance / GM operations |
| D11–D13 | PMS / operations |
| D17–D19 | HR |
| D20–D23 | IT / admin |

Record decisions in this file (append dated rows) before Phase 2 import approval.
