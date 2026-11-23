# Wave 8 — small unmapped archive tables

**Target DB:** `drm_legacy_stage` only.

## What it does

Copies every `legacy_archive.*` table that has **no** `migration_legacy_ids` rows yet and **≤1000** archive rows into `drm.legacy_archive_payload` (full row as JSONB). Tracking uses `entity_type=legacy_payload_row`.

## Run

```bash
cd /var/www/DRM_raya/backend
sudo -u postgres bash scripts/migration/run-wave8-all-sequential.sh
# log: /tmp/wave8-migrate.log

# one table:
node scripts/migration/run-wave8-small-archive-transform.mjs --execute-staging --module=webxl_bot_hints

# dry-run discover:
node scripts/migration/run-wave8-small-archive-transform.mjs --dry-run --module=all --max-rows=1000
```

## Notes

- **`tbl_*` is never migrated** (excluded in SQL + script guard).
- Tables without `id` use `_archive_row_id` + `_legacy_pk`.
- **Partial dedicated ETL** (any rows in `migration_legacy_ids` for that source) is skipped — e.g. payments, leads, task_links keep running their own scripts.
- Wave 8b: `run-wave8b-remaining-sequential.sh` (`--max-rows=250000`, log `/tmp/wave8b-migrate.log`).
