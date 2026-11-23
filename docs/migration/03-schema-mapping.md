# Phase 1C — Schema mapping

**Artifact:** [`drm-schema-mapping.csv`](./drm-schema-mapping.csv)  
**Generated:** 2026-11-04  
**Method:** Automated column-level match between MySQL DDL (166 tables) and Drizzle `schema.ts` (159 tables), with a small curated table-name map from backend comments. **No row data was read.**

## Mapping status summary (column rows)

| mapping_status | Count | Meaning |
|----------------|------:|---------|
| NO_TARGET_TABLE | 1267 | Legacy column; no confident Postgres table |
| NEEDS_MANUAL_REVIEW | 415 | Table guessed but column unmatched or ambiguous |
| TRANSFORMATION_REQUIRED | 82 | Name mapping (rename / snake↔camel) |
| TYPE_CONVERSION_REQUIRED | 47 | Same logical column; MySQL type ≠ PG |
| MATCH | 54 | Same table + column name (type may still differ) |

**Total CSV rows:** 1865 (one per MySQL column)

**MySQL tables with at least one non–`NO_TARGET_TABLE` column:** ~45 / 166

## Curated table-level hints (verify before Phase 2)

These mappings were applied only where documented in code comments or obvious naming; all remain subject to manual QA:

| MySQL table | Suggested Postgres table | Confidence |
|-------------|-------------------------|------------|
| `webxl_user` | `users` | Medium |
| `webxl_company` | `customers` | Medium |
| `webxl_followup` | `follow_ups` | Medium |
| `webxl_followup_service` | `diagnose_followups` | Medium (ensure.ts) |
| `webxl_follow_up_services` | `followup_services` | Low–medium |
| `webxl_attendance` | `attendance` | Medium |
| `webxl_invoice` / `tbl_invoices` | `invoices` | Low (duplicate sources) |
| `webxl_gmaccount` | `gm_entries` | Medium |
| `webxl_vas_comm_final` | `webxl_vas_comm_final` | High (same name) |
| `webxl_kwa_history` | `target_system_kwa_history` | Medium |
| `webxl_terget` / `webxl_setterget` | `targets` / target_system_* | Low |
| `activity_logs` / `webxl_activity_logs` | `user_activities` | Low |

Tables with **best automatic column overlap** (still not “ready to import”):  
`webxl_vas_comm_final`, `webxl_company`, `webxl_followup_service`, `webxl_user`, `password_resets`.

## Transformation categories

### Foreign-key dependency order (MySQL-enforced only)

1. `webxl_dollars_received_history`
2. `webxl_dollars_received_history_installment` → depends on (1)
3. `webxl_user` → referenced by `webxl_follow_up_services`
4. `webxl_follow_up_services` → depends on (3)

All other load ordering must be derived from **logical** FKs (e.g. `com_id` → customers) — **NEEDS_MANUAL_REVIEW**.

### Circular dependencies

No circular **database-enforced** FK cycles detected (only four FKs total).

### Enum differences

MySQL legacy enums (10 columns) use lowercase / legacy labels; Drizzle uses PascalCase or separate enum types. Plan: mapping tables or `CASE` transforms — never direct cast.

### UUID conversion

Modern schema uses `uuid` in several areas; legacy MySQL uses integer IDs almost everywhere. Any UUID columns in Postgres may need **new UUIDs** with legacy_id mapping tables unless Supabase already uses integers for those entities.

### Date/time

- MySQL `datetime` / `timestamp` → PostgreSQL `timestamptz` (recommend UTC normalization; dump header uses `+00:00`).
- **`0000-00-00`** and **`ON UPDATE CURRENT_TIMESTAMP`** must be stripped or rewritten.

### Boolean

`tinyint(1)` → PostgreSQL `boolean` (21 columns).

### JSON

Single MySQL `json` column → `jsonb` with validation.

### AUTO_INCREMENT

Preserve IDs via `INSERT ... OVERRIDING SYSTEM VALUE` or pre-set sequences after bulk load for tables that must keep legacy keys for joins.

### Duplicate / orphan risks

- Parallel **`tbl_*`** and **`webxl_*`** customer/invoice data.
- **`webxl_task_links`** / **`webxl_followup`** high volume — broken `com_id` / project references likely.
- **`webxl_follow_up_services`** optional FKs to `webxl_user` — NULL vs orphan distinction required.

## How to use the CSV

1. Filter `mapping_status != NO_TARGET_TABLE` for in-scope tables.
2. Sort by `mysql_table`, review every `NEEDS_MANUAL_REVIEW` row.
3. Do **not** treat `MATCH` as production-ready until types and enums are validated against live Supabase.

## Regeneration

```bash
python3  # generator script was run ad hoc in Phase 1; re-run from Phase 2 repo script once checked in
```
