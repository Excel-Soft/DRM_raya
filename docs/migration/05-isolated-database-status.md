# Phase 1D — Isolated PostgreSQL migration database

**Date:** 2026-11-04  
**Host:** Contabo VPS, local PostgreSQL (socket `/var/run/postgresql/.s.PGSQL.5432`, **localhost only**)

## Pre-check

| Check | Result |
|-------|--------|
| `drm_legacy_stage` existed before Phase 1? | **No** (only `drm_postgres` and `postgres` listed) |
| `drm_postgres` modified? | **No** — size remains **~7527 kB** |
| Network exposure of 5432 changed? | **No** |

## Actions performed

```bash
# List databases
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1;"

# Create isolated migration database (owner: drm_app)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE drm_legacy_stage OWNER drm_app;"

# Dedicated schema (empty)
sudo -u postgres psql -d drm_legacy_stage -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA IF NOT EXISTS drm AUTHORIZATION drm_app;"
```

**Note:** Initial `\if` conditional attempt in `psql` failed (client meta-command); creation was completed with explicit `CREATE DATABASE` after confirming absence.

## Current status

| Item | Value |
|------|--------|
| Database | **`drm_legacy_stage`** |
| Owner | **`drm_app`** |
| Schema | **`drm`** (owner **`drm_app`**) |
| Tables in `drm` | **0** |
| Database size | Empty (minimal catalog size) |
| Data restored from MySQL? | **No** |
| Data copied from `drm_postgres`? | **No** |

## Verification queries

```sql
SELECT d.datname, pg_catalog.pg_get_userbyid(d.datdba) AS owner
FROM pg_catalog.pg_database d
WHERE datname IN ('drm_legacy_stage', 'drm_postgres');

SELECT nspname, nspowner::regrole FROM pg_namespace WHERE nspname = 'drm';

SELECT count(*) FROM pg_tables WHERE schemaname = 'drm';
```

## Permissions

Database creation required **`postgres` superuser** (one-time). Day-to-day Phase 2 loads should use **`drm_app`** credentials from the secured credentials file on the server (not stored in this repository).

## Next step (Phase 2, after approval)

Apply **staging DDL** (either Drizzle-generated or subset of production reference) to `drm_legacy_stage.drm` — still **without** touching `drm_postgres` or Supabase until a separate cutover plan is approved.
