# Phase 2A — Legacy archive schema design

**Schema:** `legacy_archive` on `drm_legacy_stage`  
**DDL:** `backend/scripts/migration/ddl/02_legacy_archive_tables.sql` (generated)

## Design goals

1. **No silent coercion** — scalar values stored as **TEXT** (NULL distinct from `''`).
2. **Original names** — table and column names match MySQL `` `ndrm`.`table` `` / column names.
3. **Traceability** — metadata columns on every row:
   - `_archive_row_id` (internal bigserial)
   - `_legacy_pk` / `_legacy_pk_column`
   - `_source_database` (default `ndrm`)
   - `_source_table`
   - `_ingested_at`, `_mig_batch_id` (set in Phase 2B)
4. **Uniqueness** — `UNIQUE (_source_table, _legacy_pk)` prevents duplicate archive inserts on retry.

## Primary keys

PK columns inferred from MySQL `ALTER TABLE ... ADD PRIMARY KEY` (165/166). Override:

| Table | PK column |
|-------|-----------|
| `tbl_receipts` | `receiptid` (no ALTER PK in dump) |

## Columns that cannot be losslessly typed without risk

| MySQL feature | Archive representation |
|---------------|-------------------------|
| `ENUM(...)` | TEXT (original label) |
| `0000-00-00` dates | TEXT as exported in INSERT |
| `ON UPDATE CURRENT_TIMESTAMP` | TEXT + ingest timestamp in `_ingested_at` |
| `LONGTEXT` / HTML | TEXT |
| `DECIMAL` / `FLOAT` | TEXT (modern transform uses `transformDecimalString`) |
| Unsigned ints | TEXT |

Optional Phase 2B: add `_source_row_json` jsonb (string values only) per row for audit — not required for Phase 2A DDL.

## Regenerate DDL

```bash
python3 backend/scripts/migration/tools/generate_archive_ddl.py
```

## Current status

- **166** archive tables created (empty — **no legacy rows imported** in Phase 2A).
