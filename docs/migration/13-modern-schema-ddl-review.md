# Phase 2A — Modern `drm` schema DDL review (PG 16)

## Source of truth

- **Contract:** `backend/src/shared/schema.ts`
- **Applied migrations:** `backend/migrations/0000`–`0009` + `20260603_increment_management.sql` + `20261022_copilot_core.sql`
- **Not used:** `backups/drm_production_*.sql` (PG **17.6** dump — avoided on PG **16.15**)

## Application method

Script: `backend/scripts/migration/ddl/apply_phase2a_foundation.sh`

- Sanitizes `CREATE SCHEMA` → `IF NOT EXISTS`
- Strips Drizzle `--> statement-breakpoint` markers
- Uses `SET session_replication_role = replica` during journal replay to tolerate known **varchar vs uuid** FK drift in historical migrations

## PostgreSQL 16 compatibility

| Feature | Status |
|---------|--------|
| `gen_random_uuid()` | Requires `pgcrypto` — enabled in `00_extensions.sql` |
| Drizzle enum types | Standard `CREATE TYPE ... AS ENUM` — OK on PG16 |
| `transaction_timeout` (PG17 dump only) | Not present in Drizzle journal |
| Copilot additive SQL | Applied from `20261022_copilot_core.sql` |

## Apply result (Phase 2A)

| Metric | Value |
|--------|------:|
| Drizzle tables in schema.ts | **159** |
| Tables present in `drm_legacy_stage.drm` | **146** |
| **Missing tables** | **13** |

### Missing tables (require Phase 2A completion step)

These exist in `schema.ts` but were not created by journal replay (mid-migration errors / runtime-only DDL in `ensure.ts`):

- `ab_closing_history`
- `ab_report_notes`
- `branches`
- `cheque_pool`
- `department_team_commissions`
- `departments`
- `diagnose_followups`
- `dollar_advance_payments`
- `dollar_allocations`
- `gm_bv_commission_verifications`
- `target_system_kwa_history`
- `task_files`
- `webxl_vas_comm_final`

**Root cause:** Journal SQL ordering + **type mismatches** (e.g. `account_heads.created_by_user_id` varchar FK → `users.id` uuid) and missing dependency tables (e.g. `branches` referenced before create).

### Recommended completion (Phase 2B prep, still on `drm_legacy_stage` only)

1. Run **`drizzle-kit push`** with `DATABASE_URL` pointing at **`drm_legacy_stage`** (do **not** use production `.env`), **or**
2. Extract `CREATE TABLE IF NOT EXISTS` blocks from `backend/src/server/db/ensure.ts` into a PG16-safe supplement script, **or**
3. Hand-author `ddl/04_drm_schema_supplement.sql` for the 13 tables above from `schema.ts`.

Production **`ensure.ts` at runtime** must never be pointed at Supabase for this exercise without explicit cutover approval.

## Extensions enabled

- `pgcrypto`
- `uuid-ossp`

## Foreign keys

Full FK enforcement may remain deferred during bulk load (Phase 2B). Final modern schema should match production contract before cutover.
