# Phase 2B — Archive import execution

**Target:** `drm_legacy_stage.legacy_archive` only  
**Date:** 2026-11-04

## Readiness (Task A)

| Check | Result |
|-------|--------|
| `legacy_archive` schema | Present — 166 tables |
| `migration_meta` schema | Present — 6 helper tables |
| Preservation manifest | [`17-preservation-manifest.csv`](./17-preservation-manifest.csv) |
| Source file | `/var/www/DRM_raya/old_drm_database.sql` (901 MiB) |
| Disk space | ~54 GiB free on `/` |
| PostgreSQL | 16.15, database `drm_legacy_stage` verified before each write |

## Import mechanism (Task C)

**Selected:** **B — Custom streaming INSERT parser** (validated on full dump).

- **Not used:** Temporary MariaDB (Docker unavailable; host package install blocked by policy).
- **Parser:** `backend/scripts/migration/parsers/mysql_insert-parser.mjs` (character-level, not regex row splitting).
- **Loader:** `backend/scripts/migration/run-archive-import.mjs` using existing **`pg`** driver (batch size 500).
- **Validation pass:** Python parser counted **5,507,713** source rows across **159** data tables (**0** parse errors).

## Execution timeline

| Step | Detail |
|------|--------|
| Run 1 | Full stream import — stopped at `webxl_task_links` (~4.55M rows) due to PostgreSQL `UTF8` error on embedded `0x00` |
| Fix | `sanitizeArchiveText()` — NUL → literal `\0` in TEXT (preserved semantics, valid UTF-8) |
| Run 2 | Resume from dump line **4562628** (INSERT #14550) — completed remaining statements |

**Logs:** `/var/log/drm-archive-import.log`, `/var/log/drm-archive-import-resume2.log`

## Commands

```bash
cd /var/www/DRM_raya/backend
sudo -u postgres node scripts/migration/run-archive-import.mjs
sudo -u postgres node scripts/migration/run-archive-import.mjs 4562628
```

## Batch / resume behaviour

- Progress recorded in `migration_meta.migration_batches`.
- Duplicate `(source_table, legacy_pk)` on resume → `migration_rejects.duplicate_legacy_pk` (**not** silent discard of source data).
- No automatic truncation of archive tables.

## Phase 2C boundary

No writes to `drm.*` application tables. No UUID/customer merges. Archive only.
