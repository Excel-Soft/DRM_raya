# Phase 2A — ETL implementation plan (Phase 2B)

## Principles

1. **Archive first** — every parsed row → `legacy_archive.*` (TEXT columns).
2. **Modern second** — optional transform → `drm.*` when mapping verified.
3. **Stream** — `createReadStream` + readline (`parsers/mysql-dump-stream.ts`); never load 901 MiB into RAM.
4. **Batch** — default 500 rows (`config/migration.env.example`).
5. **Idempotent** — `UNIQUE (_source_table, _legacy_pk)` on archive; batch_id tracking.

## Pipeline stages

| Stage | Module | Phase |
|-------|--------|-------|
| 1. Scan INSERT lines | `parsers/mysql-dump-stream.ts` | 2B |
| 2. Parse VALUES tuples | `parsers/mysql-insert-parser.ts` (TBD) | 2B |
| 3. Map columns | `mappers/csv-map-loader.ts` (from `drm-schema-mapping.csv`) | 2B |
| 4. Transform | `transformers/*` | 2A stubs + tests |
| 5. Load archive | `loaders/archive-loader.ts` | 2B |
| 6. Load modern | `loaders/modern-loader.ts` (TBD) | 2B |
| 7. Record state | `loaders/meta-writer.ts` (TBD) | 2B |
| 8. Validate | `validators/*` | 2B |

## Dependencies (no new installs in Phase 2A)

| Need | Existing package |
|------|------------------|
| PostgreSQL client | `pg` (backend dependency) |
| CSV mapping | `csv-parse` |
| Streaming | Node `fs` / `readline` |
| Tests | `vitest` |

**Optional later:** `mysql2` only if replay via temporary MariaDB is chosen over INSERT parsing.

## Repeatable runs

1. Start batch → `migration_batches`.
2. Archive insert → update `migration_table_status.archived_rows`.
3. On modern success → `migration_legacy_ids` + `migration_record_state`.
4. On modern failure → still archived; `migration_rejects` + `ARCHIVED_REJECTED` or `ARCHIVED_PENDING_REVIEW`.

## CLI entry (Phase 2B)

```bash
# Planned — not executed in Phase 2A
cd backend
MIGRATION_DATABASE_URL=postgresql://...@127.0.0.1:5432/drm_legacy_stage \
  npx tsx scripts/migration/run-import.ts --table webxl_company --phase archive-only
```

## Security

- Reject logs store **references** (table, pk, reason) — not password/token field values.
- Redact known sensitive columns in `mappers/sensitive-columns.json` (TBD).
