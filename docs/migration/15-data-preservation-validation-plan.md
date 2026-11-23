# Phase 2A — Data preservation validation plan

## Per-table reconciliation

For each of **166** source tables:

```
total_source_rows
  = archived_rows
  = modern_migrated_rows + archived_only_rows + archived_pending_review_rows + archived_rejected_rows
```

(`modern_migrated_rows` ⊆ archived — dual state `ARCHIVED_AND_MIGRATED`.)

## Checks (Phase 2B)

| # | Check | Method |
|---|--------|--------|
| 1 | Source vs archive count | Compare INSERT parse count vs `COUNT(*)` on `legacy_archive.table` |
| 2 | PK uniqueness | `UNIQUE (_source_table, _legacy_pk)` constraint + validation query |
| 3 | Duplicate source rows | Group by legacy PK in archive before modern load |
| 4 | Missing FK (logical) | Left join via `migration_legacy_ids` for user/customer |
| 5 | Customer map | Every `com_id` used → map or `ARCHIVED_PENDING_REVIEW` |
| 6 | User map | Every `user_id`/`uid` → map or pending |
| 7 | Invoice/payment | Preserve `tbl_*` and `webxl_*` separately; cross-check only via reconciliation_candidates |
| 8 | Task/project links | Orphan report — no delete |
| 9 | Enum transform | Sample distinct TEXT values vs allowed PG enums |
| 10 | Zero dates | Count rows where archive TEXT matches `0000-00-00%` |
| 11 | Decimal precision | Compare archive TEXT to modern numeric stringification |
| 12 | UUID map | Every modern insert has `migration_legacy_ids` row |
| 13 | Sequences | `setval` ≥ max legacy serial where preserved |
| 14 | Rejects | `migration_rejects` count matches `ARCHIVED_REJECTED` |

## Traceable end states

| State | Archive | Modern | Reject row |
|-------|---------|--------|------------|
| ARCHIVED_ONLY | ✓ | — | — |
| ARCHIVED_AND_MIGRATED | ✓ | ✓ | — |
| ARCHIVED_PENDING_REVIEW | ✓ | — | optional note |
| ARCHIVED_REJECTED | ✓ | — | ✓ |

**Failure rule:** If modern transform fails, row **remains** in archive; state → `ARCHIVED_REJECTED` or `ARCHIVED_PENDING_REVIEW`.

## Validation status field

`migration_meta.migration_table_status.validation_status`:

- `pending` (Phase 2A default for all 166 tables)
- `passed` / `failed` / `needs_review` after Phase 2B runs

## Reports

`reports/` will emit CSV summaries per batch (no PII columns).
