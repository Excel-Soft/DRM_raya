# Phase 2B — Failed and unresolved records

## Summary

| Category | Count |
|----------|------:|
| Source rows (parsed) | 5,507,713 |
| Rows in `legacy_archive` | 5,507,713 |
| Unresolved source rows (no archive row) | **0** |
| Non-duplicate import failures | **0** |

## `migration_rejects`

| `rejection_reason` | Count | Meaning |
|--------------------|------:|---------|
| `duplicate_legacy_pk` | ~239,514 | Resume attempted re-insert of PK already archived (run 1 + run 2 overlap) |

Query (staging only):

```sql
SELECT rejection_reason, count(*) FROM migration_meta.migration_rejects GROUP BY 1;
```

No reject rows contain password/token field payloads — references are table + line / legacy_id only.

## Per-record states

Bulk `migration_record_state` rows were not inserted for all 5.5M records in Phase 2B (volume). Traceability is provided by:

- `legacy_archive._legacy_pk` / `_legacy_pk_column`
- `migration_meta.migration_batches`
- Table-level [`19-archive-row-count-reconciliation.csv`](./19-archive-row-count-reconciliation.csv)

Phase 2C may add selective `migration_record_state` rows for modern migration candidates.

## Encoding edge case

MySQL strings containing ASCII NUL (`0x00`) are stored as the two-character sequence `\0` in archive TEXT (documented in import script). Original bytes are recoverable from archive for audit.
