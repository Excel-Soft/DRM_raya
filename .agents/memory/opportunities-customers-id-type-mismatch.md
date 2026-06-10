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

## Broader recurring pitfalls in schema `drm` (raw SQL)
- `projects.id` is `uuid` but `project_approvals.project_id` and `tasks.project_id`
  are `varchar`. Any join `projects.id = *.project_id` throws `operator does not
  exist: uuid = character varying`; cast both sides `::text`
  (seen in `projects.repository.ts` delayed/upcoming queries).
- `drm.customers` has **no `name` column** — the display name is `company_name`
  (and `person_name` for the contact). Selecting/filtering `c.name` throws
  `column c.name does not exist` (Postgres often hints `u.name`/`cb.name`, which
  are the *users* table). For customer display use `c.company_name`.
- `drm.attendance.id` and `drm.attendance.user_id` are `varchar`, but
  `drm.users.id` is `uuid`. A join `drm.users u ON u.id = a.user_id` throws
  `operator does not exist: uuid = character varying`; cast the uuid side
  (`u.id::text = a.user_id`). Note `attendance_edit_requests.user_id` is `uuid`
  (so its join to users needs no cast) while `attendance_edit_requests.attendance_id`
  is `varchar` (matches `attendance.id`).
- `drm.users` *does* have `name`; only `customers` lacks it.
**Why:** these caused 500s on otherwise-correct Stage 6/7 list endpoints.
**How to apply:** in any new raw SQL touching customers or project↔approval/task
joins, default to `company_name` for customer names and `::text` casts on
project-id joins.
