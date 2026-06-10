---
name: ensure*Schema single-txn rollback trap
description: Why an ensure*Schema boot migration can silently leave columns in their OLD type and 500 every repo call.
---

# ensure*Schema runs in ONE transaction every boot — a mid-migration type clash rolls back EVERYTHING

The `ensure<Table>Schema()` repository helpers wrap their whole migration in a
single `begin/commit`, run on the first repo call after boot, and only set their
`ensured` guard to `true` on success. If any statement throws, the transaction
rolls back, the guard stays `false`, and **every subsequent repo call re-runs the
same failing migration and 500s** (the helper is awaited on the read/write path).

**The specific trap (seen on `bv_reports`):** a legacy import had an id column
(`assigned_to`) as `varchar`, so `alter table ... add column if not exists
assigned_to uuid` was a **no-op** (column already exists) and left it `varchar`.
A later `coalesce(assigned_to, user_id)` — where `user_id` had already been
converted to `uuid` earlier in the same txn — failed with *"COALESCE types
character varying and uuid cannot be matched"*, rolling back the entire
migration. Net effect: ALL id columns appeared `varchar` (the uuid conversions
never committed), the canonical join (`uuid = varchar`) 500'd, and the create/
list repo calls 500'd too.

**Why:** `add column if not exists` does NOT change the type of a pre-existing
column, and a single bad statement aborts the whole transaction — so a partial
type migration can leave the table looking untouched.

**How to apply:**
- When a boot migration converts legacy id columns to `uuid`, convert each one
  **explicitly and idempotently** with an information_schema-guarded
  `alter column <c> type uuid using nullif(<c>,'')::uuid` BEFORE any statement
  that compares/coalesces it against an already-converted column. Don't rely on
  `add column if not exists ... uuid` to fix a column that already exists.
- If "every BV/report repo call 500s right after boot," suspect the ensure
  migration is throwing & rolling back — run it directly (tsx one-off) to see the
  real PG error, then check actual column types via `information_schema.columns`.
- `bv_reports` ids (`id,user_id,customer_id,assigned_to`) are `uuid`, matching
  `users.id`/`customers.id`; joins are native `uuid = uuid` (no `::text` casts).
  Unqualified `bv_reports` in the ensure helper resolves to `drm.bv_reports`
  because `search_path = drm, public` and only that table exists.
