---
name: drizzle-kit push is broken in this repo
description: Why `npm run db:push` fails repo-wide and how to apply schema changes instead
---

`npm run db:push` (drizzle-kit push) fails for the WHOLE repo, not just your
table, with: `Key columns "created_by_user_id" and "id" are of incompatible
types: character varying and uuid` (an ATAddForeignKeyConstraint error). This is
a pre-existing schema/DB drift unrelated to any new change — drizzle-kit tries to
reconcile every table and chokes on this FK mismatch before touching yours.

**Why:** the live DB and `shared/schema.ts` disagree on a foreign-key column
type somewhere; push refuses to proceed.

**How to apply schema changes instead:**
- Add the column to `shared/schema.ts` (so the ORM types are correct), AND
- Apply it at runtime with a lazy `ensure<Feature>Schema()` that runs
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` (the repo convention), and/or
  run the same idempotent ALTER directly via `psql "$DATABASE_URL"`.
- Verify with `information_schema.columns`. Do not rely on `db:push`.
