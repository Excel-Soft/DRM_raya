---
name: Report/feature table durability vs the live DB
description: A table can exist in the dev DB yet be missing from schema.ts + ensure.ts — verify durability against information_schema, don't trust a changelog's "added" claim.
---

# A table existing in the dev DB does NOT mean it is durable

Feature/route code can ship querying a `drm.<table>` that exists in the **dev** DB
(hand-created during a prior session, or from a since-reverted migration) but is
**absent** from both `shared/schema.ts` and `server/db/ensure.ts`. Everything works
in dev, so it looks done — but a fresh / production DB 500s on every route that
touches the table.

**Why:** `db:push` is broken repo-wide (see db-push-broken-fk.md), so tables/columns
are created at runtime by `ensure*Schema` functions wired into `ensureDbOnce()`. If a
table isn't in that chain (and not in schema.ts as the source of truth), nothing
recreates it on a clean DB. A changelog claiming "added to schema.ts / ensure.ts" can
be flatly false — confirm against the files and the live catalog, not the prose.

**How to apply:** when finishing or verifying a report/feature backed by a raw-SQL
table:
1. `rg` the table name in BOTH `shared/schema.ts` AND `server/db/ensure.ts`.
2. Compare columns/types/defaults to `information_schema.columns` and indexes to
   `pg_indexes` (schemaname='drm').
3. If missing, add the drizzle table (source of truth) + an idempotent
   `CREATE TABLE/INDEX IF NOT EXISTS` ensure fn wired after the other ensures. It is a
   no-op where the table already exists, so it can't abort the shared single boot
   transaction; uuid→uuid FK refs to drm.users/drm.customers carry no type-clash
   rollback risk. Match index names to the live ones to avoid duplicate-by-different-name.
