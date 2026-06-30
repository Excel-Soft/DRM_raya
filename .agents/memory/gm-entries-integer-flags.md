---
name: gm_entries boolean-looking flags are INTEGER
description: gm_entries.is_loan / is_partial_payment are integer (1/0), not boolean; temp_gm_entries has no is_deleted — raw SQL comparing them to true/false 500s.
---

In `drm.gm_entries`, the flag columns `is_loan` and `is_partial_payment` are
**INTEGER** (1/0), NOT boolean. `is_deleted` on `gm_entries` *is* a real boolean.
`drm.temp_gm_entries` and `drm.refund_gm_entries` have **no `is_deleted` column`
at all (and no flag columns) — only `amount`, `status`, `created_at`, etc.

**Why:** Raw SQL that compares these integer flags to booleans
(`WHERE is_loan = true`, `is_partial_payment = false`, `FILTER (WHERE is_loan =
true)`) throws Postgres `operator does not exist: integer = boolean` and the
endpoint 500s. Filtering `temp_gm_entries`/`refund_gm_entries` on
`coalesce(is_deleted,false)=false` throws `column does not exist`. This bit two
separate endpoints (`/api/account/ab-report/stats` and
`/api/account/dollar-system/list`) that were silently 500ing.

**How to apply:** In hand-written SQL over these tables use integer comparisons
(`is_loan = 1`, `is_partial_payment = 0`) and never reference `is_deleted` on
`temp_gm_entries`/`refund_gm_entries`. Verify column types via
`information_schema.columns` before assuming a boolean. (The Drizzle layer maps
these to numbers; the mismatch only surfaces in raw `pool.query` SQL.)
