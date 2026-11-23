# Phase 2B — Archive data integrity report

## Row-count reconciliation

Authoritative source counts: [`source-row-counts.json`](./source-row-counts.json) (full dump parse).

Archive counts: `SELECT count(*) FROM legacy_archive."<table>"` for all **166** tables.

**Result:** **0 mismatches** — **5,507,713** source rows = **5,507,713** archived rows.

Detail: [`19-archive-row-count-reconciliation.csv`](./19-archive-row-count-reconciliation.csv)

## Structure-only tables (0 source rows)

| Table |
|-------|
| `activity_logs` |
| `gm_history_set` |
| `gm_history_set_items` |
| `webxl_activity_logs` |
| `webxl_domain_backup` |
| `webxl_media` |
| `webxl_verify_gm_delay_amount_history` |

Status: `STRUCTURE_ONLY` — DDL preserved, zero rows expected.

## Duplicate / resume conflicts

| Metric | Value |
|--------|------:|
| `migration_rejects` (duplicate_legacy_pk) | ~239,514 |

These are **retry/resume collisions** (same legacy PK inserted in run 1 and attempted again in run 2), not missing source rows. Non-duplicate rejects: **0**.

## Integrity checks performed

| Check | Result |
|-------|--------|
| Missing source tables in archive | None — 166/166 destinations |
| PK uniqueness (`UNIQUE (_source_table, _legacy_pk)`) | Enforced by DDL |
| UTF-8 validity | NUL bytes normalized to `\0` text escape |
| NULL vs empty string | Preserved via TEXT + SQL NULL parameters |
| Source backup SHA-256 | Unchanged — see [`17-source-backup-integrity.md`](./17-source-backup-integrity.md) |

## Sampling note

Deterministic per-row hashes were not run on all 5.5M rows (runtime); reconciliation uses **exact COUNT(*)** per table.

## Production safety

| System | Modified |
|--------|----------|
| Supabase | No |
| `drm_postgres` | No |
| Live `.env` / PM2 / Nginx | No |
| `old_drm_database.sql` | No (read-only) |
