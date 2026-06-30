# Patch 7 — DB / Migration Reconciliation

Date: 2026-06-30. Scope: reconcile the schema source, the migration tooling, and
the live `drm` schema for the surface touched in Patch 7 Stage 5, and document
the runtime-DDL dependency. **No destructive commands were run.**

## Schema source & tooling

- **Schema of record:** `shared/schema.ts` (Drizzle).
- **Generator:** `drizzle.config.ts` → `dialect: postgresql`,
  `schemaFilter: ["drm"]`, `out: "./migrations"`.
- **Migration files** live in `./migrations` (plus `migrations/meta`). They are
  the historical record; they are **not** the live-apply path in this repo.

## `db:push` is broken (known, pre-existing)

`npm run db:push` fails repo-wide on a **pre-existing foreign-key type
mismatch** (unrelated to this stage). Because of that:

- We do **not** run `db:push` or any `drizzle-kit` migrate/push as part of a
  change.
- Any required schema change is applied as **additive runtime DDL**
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) or via `psql`, never a push.
- The server performs **runtime schema maintenance on boot** — startup logs show
  `[accounts] schema maintenance completed successfully`. This is the de-facto
  reconciliation path for additive needs.

## Patch 7 Stage 5 DDL footprint

**Zero.** This stage added no columns, tables, constraints, or indexes. Every
column referenced by the code changes already exists in the live `drm` schema
(verified via `information_schema.columns`):

| Table | Column(s) used | Type | Nullable | Used by |
|---|---|---|---|---|
| `gm_entries` | `dollar_rate` | numeric | YES | dollar-tx now stores rate **or NULL** (no `277`) |
| `gm_entries` | `is_loan` | integer | — | AB-report `FILTER (WHERE is_loan = 1)` fix |
| `gm_entries` | `is_deleted` | boolean | — | AB-report `gm_stats` real boolean filter (kept) |
| `temp_gm_entries` | (no `is_deleted`) | — | — | AB-report `temp_stats` filter dropped (`WHERE 1=1`) |
| `it_backups` | `domain_id, person_name, backup_type, backup_url, details, backup_date, created_at` | uuid/text/ts | mixed (`backup_type`, `backup_date`, `created_at` NOT NULL) | backup create |
| `it_domains` | `domain_name, expiry_date, ssl_expiry_date, hosting_expiry_date, status, created_at` | text/ts | mixed | domains list / export / status badge |

Notably, `it_domains` has **no** `company` / `email` / `contact_no` columns —
which is why the IT Domains UI now renders those as **N/A** and the unbacked
filter card was removed (see `PATCH7_STAGE5_OFFICE_DOMAIN_CHANGELOG.md`).

## Pre-existing data-shape defects fixed without DDL

The AB-report 500 was a **query/type** bug, fixed in SQL text only (no schema
change):

- `is_loan = true` → `is_loan = 1` (column is integer).
- `temp_gm_entries` filtered on a non-existent `is_deleted` → filter removed.

These reconcile the query to the **actual** live column types/inventory rather
than changing the schema to match the query.

## Reconciliation status

- Live `drm` schema **matches** what the Patch 7 Stage 5 code expects. No drift
  requiring DDL was found on the touched surface.
- The broader `db:push` FK mismatch remains **open** and is out of scope for a
  gap-closure stage (fixing it is a schema migration, not a closure task).
