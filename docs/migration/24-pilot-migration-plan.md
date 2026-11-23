# Phase 2C — Pilot migration plan (`webxl_vas_comm_final`)

## Source → target

| | |
|--|--|
| **Source** | `drm_legacy_stage.legacy_archive.webxl_vas_comm_final` |
| **Target** | `drm_legacy_stage.drm.webxl_vas_comm_final` |
| **Entity type (ID map)** | `webxl_vas_comm_final_row` |
| **Legacy PK column** | `id` (stored in `_legacy_pk`) |
| **Modern PK** | `id` serial — **preserve legacy integer** |

## Row scope

| Metric | Value |
|--------|------:|
| Archive rows | 1,858 |
| Planned migrate | 1,858 (full table after batch smoke test) |

## Column mapping (modern target only)

| Archive column | Target column | Transform |
|----------------|---------------|-----------|
| `id` | `id` | int, required |
| `user_id` | `user_id` | int, required (legacy int, not UUID) |
| `manager_approve` | `manager_approve` | text → varchar |
| `hod_status` | `hod_status` | text |
| `user_status` | `user_status` | text |
| `account_pay_status` | `account_pay_status` | text |
| `account_pay_date` | `account_pay_date` | timestamp; zero-date → NULL |
| `comm_year` | `comm_year` | text |
| `comm_month` | `comm_month` | text |
| `comm_type` | `comm_type` | text |
| `per` | `per` | text |
| `comm` | `comm` | decimal(10,2) |
| `reward` | `reward` | decimal(10,2) |
| `team_reward` | `team_reward` | decimal(10,2) |
| `final_pay_amount` | `final_pay_amount` | decimal(10,2) |
| `manager_approve_date` | `manager_approve_date` | timestamp |
| `hod_satatus_date` | `hod_satatus_date` | timestamp |

### Archive-only (no modern column)

`dep`, `target`, `total_amount`, `rewardcomment`, `user_status_date`, `create_at` — remain in `legacy_archive` only until business maps them.

## ID mapping strategy

Per [`08-id-mapping-strategy.md`](./08-id-mapping-strategy.md) **DIRECT_MIGRATION**:

- `migration_meta.migration_legacy_ids.modern_id` = stringified legacy `id`
- `modern_table` = `webxl_vas_comm_final`
- No UUID generation

## Foreign keys

None on target table. **`user_id` is not validated** against `drm.users` in this pilot (intentional — schema stores bare legacy user id).

## Duplicate handling

| Case | Action |
|------|--------|
| Already in `migration_legacy_ids` | Skip selection (retry-safe) |
| Modern row with same `id` exists | Reject `duplicate_modern_id`; record in `migration_rejects` |
| Invalid int/decimal/timestamp | Reject with reason; `TRANSFORMATION_REJECTED` state |

No blanket `ON CONFLICT DO NOTHING`.

## Validation criteria

1. Archive row count unchanged.
2. Modern count = migrated count = 1,858.
3. 1:1 `migration_legacy_ids` and `TRANSFORMED_SUCCESSFULLY` states.
4. No duplicate modern `id`.
5. Sample field match archive TEXT → typed columns.
6. Zero pilot rows in `migration_rejects` for this table.

## Execution steps

1. Apply [`05_pilot_webxl_vas_comm_final.sql`](../backend/scripts/migration/ddl/05_pilot_webxl_vas_comm_final.sql) on `drm_legacy_stage`.
2. Run ETL smoke: `sudo -u postgres node backend/scripts/migration/run-pilot-transform.mjs --limit=50 --batch-size=50`
3. Validate smoke metrics.
4. Run full: `sudo -u postgres node backend/scripts/migration/run-pilot-transform.mjs --batch-size=200`
5. Emit [`26-pilot-data-reconciliation.csv`](./26-pilot-data-reconciliation.csv) and [`25-pilot-execution-report.md`](./25-pilot-execution-report.md).

## Script

`backend/scripts/migration/run-pilot-transform.mjs`

- Verifies `current_database() = drm_legacy_stage`
- Transaction per batch
- Records batches in `migration_meta.migration_batches`
