---
name: WebExcels DRM Replit setup quirks
description: Non-obvious environment/DB gotchas when running the WebExcels DRM (rest-express) app on Replit
---

## Custom env loader never overrides existing process.env
`server/env.ts` loads `.env` but skips any key already present in `process.env`.
On Replit, the platform injects `DATABASE_URL` (+ `PG*`) before the process
starts, so values baked into `.env` (e.g. the old external Supabase URL) are
silently ignored and the platform DB wins.
**Why it matters:** to point the app at a specific DB you must set it in Replit's
managed env, not by editing `.env` (which is gitignored and edit-blocked).
**Edge case / fragility:** if `DATABASE_URL` is ever unset in Replit env, the app
silently falls back to whatever stale value is in `.env`.

## db.ts rejected the Replit internal DB host
`validateDbHost()` in `server/db.ts` required a dotted hostname; Replit's
internal host is a single label (`helium`) and was rejected. Allowing
`helium`/`process.env.PGHOST` was the only code change needed to boot against the
Replit-provided Postgres.

## Schema has impossible varchar→uuid FKs; db:push half-applies
`shared/schema.ts` (and the base migration) declare many FKs where a `varchar`
column references `users.id` (`uuid`). Postgres can't create those FKs, so
`drizzle-kit push` aborts at the FK stage — **but tables are created first**, so
the schema ends up usable with only those FK constraints missing (the original DB
never enforced them either).
**Why it matters:** treat this partial-push as the accepted boot state; don't try
to "normalize" types to make push converge — references to `users.id` are a mix
of uuid and varchar, so no single fix is consistent. This is deferred tech debt.
