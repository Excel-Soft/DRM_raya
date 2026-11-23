# Phase 1E — Migration compatibility and execution plan

**Phase:** 1 (planning only — **no data import**, **no new migration packages installed**)  
**Date:** 2026-11-04

## Environment matrix

| Layer | Version / location | Role |
|-------|-------------------|------|
| Source | MariaDB 10.3.39 dump (`ndrm`) | Read-only SQL file |
| Staging DB (VPS) | PostgreSQL **16.15**, DB **`drm_legacy_stage`**, schema **`drm`** | Future isolated load target |
| Local app DB | PostgreSQL 16.15, **`drm_postgres`** | **Untouched** in Phase 1 |
| Production | Supabase **PostgreSQL 17.6** | **Untouched**; reference dump in `backups/` |

## PostgreSQL 16 suitability

**Suitable** for staging and ETL development. PG 16 supports `jsonb`, identity columns, and standard constraints needed for this migration.

**Caveat:** Production reference dump is from **PG 17**. Before applying any DDL from `backups/drm_production_*.sql` to `drm_legacy_stage`, strip PG17-only objects and verify with `pg_dump --version` / trial restore into PG16.

## pgloader vs custom streaming ETL

| Approach | Fit for this project | Notes |
|----------|---------------------|--------|
| **pgloader** (MySQL → PG) | Partial | Good for bulk type conversion and `AUTO_INCREMENT`, but legacy DB is a **file dump**, not a live MySQL server. Would require temporary MariaDB instance or `pgloader` FROM SQL (limited). Table/column **renames** (`webxl_company` → `customers`) need extensive rewrite rules. |
| **Custom streaming ETL** (recommended) | **High** | Read `old_drm_database.sql` or restored MariaDB with **streaming parsers**; transform rows in Python/Node; load into **`drm_legacy_stage.drm_*`** staging tables or directly into mapped PG tables. Handles rename maps, enum maps, zero dates, and duplicate `tbl_*` resolution explicitly. |
| **One-shot psql of MySQL dump** | **Unacceptable** | Syntax incompatible; forbidden by project rules. |

**Recommendation:** Phase 2 should use **(optional) short-lived MariaDB 10.3 container OR continue file-based INSERT parsing** + **custom ETL** into `drm_legacy_stage`, with mapping driven by `drm-schema-mapping.csv` after manual review.

## Preserving keys and relationships

1. Load **dimension** tables first (users, customers, roles, departments) with **fixed legacy IDs**.
2. Load **fact** tables with FK checks deferred (`SET session_replication_role = replica` on staging only).
3. Maintain **`legacy_id_map`** helper tables where Postgres uses UUIDs.
4. After load, run orphan-detection SQL (left joins where child key not in parent).

## Large tables / memory

- Process **`INSERT`** statements in a **line iterator** (5.5M lines, 901 MiB).
- Batch commits (e.g. 1–5k rows) per table.
- Index **after** bulk load on staging where possible.
- **`webxl_task_links`**, **`webxl_followup`**, **`webxl_com_history`** — highest INSERT statement counts; schedule separate validation passes.

## Validation checklist (post-load, Phase 2+)

- [ ] Row counts per table vs MySQL (`SELECT COUNT(*)` vs INSERT-derived estimates)
- [ ] PK uniqueness and NOT NULL violations
- [ ] Sample hash aggregates on non-PII columns (e.g. `COUNT`, `SUM(amount)` per month) — not raw PII export
- [ ] Orphan checks on `customer_id`, `user_id`, `project_id` equivalents
- [ ] Enum value distribution vs allowed Drizzle enums
- [ ] Sequence/identity values ≥ max(id)

## Failed imports and repeatability

1. **`drm_legacy_stage` is disposable** — truncate schema or drop/recreate only with approval (never touch `drm_postgres` / Supabase).
2. Version ETL scripts and mapping CSV in git.
3. Log rejected rows to **`migration_rejects`** table (jsonb reason + legacy keys).
4. Idempotent loads: `ON CONFLICT DO NOTHING` or staging tables + merge SQL.

## Phase 2 prerequisites (before any import)

1. Sign-off on **`drm-schema-mapping.csv`** manual review rows.
2. Decision on **`tbl_*` vs `webxl_*`** authoritative sources.
3. Approved cutover strategy (staging-only vs eventual Supabase sync — **out of scope** until explicit approval).
4. Install migration tooling (if any) in a **non-production** context only.
5. Backup **`drm_legacy_stage`** before first load.

## Explicit non-actions in Phase 1

- No pgloader / MariaDB install
- No import into `drm_legacy_stage`
- No changes to Supabase, PM2, Nginx, `.env`, or application code
