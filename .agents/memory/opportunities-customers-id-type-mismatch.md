---
name: opportunities vs customers id type mismatch
description: drm.opportunities ids are varchar while drm.customers.id is uuid; joins/UNIONs need ::text casts.
---

# opportunities vs customers id type mismatch

In schema `drm`, `customers.id` is `uuid` but `opportunities.id`,
`opportunities.customer_id`, and `opportunities.owner_id` are `varchar`.

**Why this matters:** a raw SQL join `opportunities.customer_id = customers.id`
(uuid vs varchar) or a `UNION` whose two branches disagree on column type
throws a Postgres type error at runtime — this was the cause of a 500 on the
customer list (`customers.repository.findByUserId`).

**How to apply:** when joining or UNION-ing opportunities and customers in raw
SQL, cast to a common type with `::text` (e.g. `op.customer_id = c.id::text`,
and cast `op.id::text` / `op.stage::text` / `op.owner_id::text`, with matching
`null::text` / literal `::text` in the other UNION branch). Keep this as a
local cast workaround; a proper fix is a schema migration to align the id types
(left for a future stage).
