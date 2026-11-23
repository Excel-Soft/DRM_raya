# Phase 2C — Pilot execution report (`webxl_vas_comm_final`)

**Database:** `drm_legacy_stage`  
**Executed:** 2026-11-04 (UTC+1 server local)

## Summary

| Metric | Value |
|--------|------:|
| Source rows (archive) | 1,858 |
| Selected for processing (batch 1) | 50 |
| Migrated (batch 1) | 50 |
| Rejected (batch 1) | 0 |
| Selected (batch 2 — remainder) | 1,808 |
| Migrated (batch 2) | 1,808 |
| Rejected (batch 2) | 0 |
| **Total migrated** | **1,858** |
| **Total rejected** | **0** |
| Pending | 0 |
| ID mappings created | 1,858 |
| Duplicate modern PK conflicts | 0 |
| Orphan FK references | N/A (no FKs) |
| Archive rows before / after | 1,858 / 1,858 |
| Archive immutable | **Yes** |

## Batches (`migration_meta.migration_batches`)

| batch_id | rows_migrated | rows_rejected | Notes |
|----------|---------------|---------------|-------|
| `7f04792c-e0f4-41b7-844a-43cff1524950` | 50 | 0 | Smoke test (`--limit=50`) |
| `c54688b9-27fb-435a-84f9-5c7bc5e43569` | 1,808 | 0 | Full remainder |

Earlier same-day batches with 0 rows migrated were no-op runs (no pending rows / pre-DDL); no data impact.

## Validation results

| # | Check | Result |
|---|-------|--------|
| 1 | Source-to-target row accounting | 1,858 = 1,858 |
| 2 | PK uniqueness (`drm.webxl_vas_comm_final.id`) | 0 duplicates |
| 3 | FK integrity | N/A |
| 4 | Required fields (`id`, `user_id`) | All present |
| 5 | Enum conversion | N/A |
| 6 | Timestamps | Zero dates nulled; samples ISO-stored |
| 7 | Decimal precision | e.g. archive `1750` → `1750.00` |
| 8 | UUID mappings | N/A — integer IDs preserved |
| 9 | Data consistency (random sample join) | Match on `comm`, `comm_year` |
| 10 | Archive immutability | COUNT unchanged |

## Traceability

| Artifact | Count |
|----------|------:|
| `migration_legacy_ids` (`webxl_vas_comm_final_row`) | 1,858 |
| `migration_record_state` = `TRANSFORMED_SUCCESSFULLY` | 1,858 |
| `migration_rejects` for `webxl_vas_comm_final` | 0 |
| Per-row outcomes | [`26-pilot-data-reconciliation.csv`](./26-pilot-data-reconciliation.csv) |

## Modern table statistics

| Stat | Value |
|------|------:|
| min(`id`) | 1 |
| max(`id`) | 2,260 |
| distinct `user_id` | 123 |

Gap in serial range is consistent with legacy source (non-contiguous ids), not migration loss.

## Known limitations

1. **Six archive columns** not copied to modern schema (documented in plan).
2. **`user_id`** not validated against migrated users.
3. **NUL normalization** applies only at archive layer; pilot table had no NUL issue.
4. Mapping CSV marks many columns **INFERRED** — pilot used physical PG snake_case columns from `schema.ts`, not application camelCase.

## Safety

- No changes to Supabase, `drm_postgres`, `.env`, PM2, Nginx, or live code.
- No `legacy_archive` UPDATE/DELETE/TRUNCATE.

## STOP condition

**Phase 2C pilot complete.** Do not start additional modules without explicit approval — see [`27-phase2c-next-module-plan.md`](./27-phase2c-next-module-plan.md).
