---
name: todo_tasks lazy table & schema qualification
description: Why all to-do endpoints can 500 on a fresh DB, and a schema-qualification inconsistency to watch.
---

# To-do (`todo_tasks`) lazy table

`drm.todo_tasks` is a raw-SQL table (not in `shared/schema.ts`) and is **not created
by any migration or boot-time ensure**. On a database where no to-do has ever been
created, the table does not exist, so **every** to-do endpoint (status update,
summary, participant list/remove) returns `500`, not `404`/empty.

**Why:** there is no `CREATE TABLE IF NOT EXISTS drm.todo_tasks` anywhere in `server/`.
The table appears to be expected to exist already (legacy import) or to be created by a
write path that hasn't run in this environment.

**How to apply:** when a to-do endpoint 500s on a fresh DB, do not treat it as an
endpoint bug — confirm the table exists first (`information_schema.tables`). New to-do
endpoints should mirror the existing owner/admin permission + `array_remove` pattern;
their 404/200 paths only become reachable once the table exists.

**Schema-qualification inconsistency:** `server/todo-routes.ts` queries
`drm.todo_tasks` (schema-qualified) while `server/sales-routes.ts` queries
`todo_tasks` (unqualified, relies on `search_path`). Keep this in mind if one path
works and the other 500s — they can resolve to different/absent relations depending
on `search_path`.
