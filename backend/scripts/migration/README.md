# DRM legacy migration (Phase 2+)

**Target database:** `drm_legacy_stage` only.

## Layout

| Path | Role |
|------|------|
| `config/` | `migration.env` (local, gitignored) from `migration.env.example` |
| `ddl/` | PostgreSQL foundation scripts + `apply_phase2a_foundation.sh` |
| `tools/` | `generate_archive_ddl.py` |
| `parsers/` | Streaming MySQL dump parsers |
| `transformers/` | Value transforms (unit-tested) |
| `loaders/` | Archive + modern loaders (Phase 2B) |
| `validators/` | Count and FK checks |
| `mappers/` | CSV-driven column maps (Phase 2B) |
| `reports/` | Batch summaries (Phase 2B) |
| `tests/` | Vitest for pure transforms |

## Dependencies

Uses existing backend packages only: `pg`, `drizzle-orm`, `csv-parse`, Node streams. **No new npm installs in Phase 2A.**

Optional Phase 2B: consider `mysql2` only if live MariaDB replay is chosen over INSERT parsing.

## Run tests

```bash
cd /var/www/DRM_raya/backend
npx vitest run scripts/migration/tests
```

## Apply foundation DDL

```bash
/var/www/DRM_raya/backend/scripts/migration/ddl/apply_phase2a_foundation.sh
```

Verify output includes `TARGET DATABASE: drm_legacy_stage`.
