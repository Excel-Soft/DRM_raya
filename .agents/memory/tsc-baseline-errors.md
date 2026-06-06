---
name: Pre-existing tsc baseline errors
description: The repo ships with a stable set of TypeScript errors unrelated to most tasks.
---

`npx tsc --noEmit` reports a stable baseline of pre-existing errors (~57–58)
concentrated in `server/reports-routes.ts` and several `server/repositories/*.ts`
files (Drizzle overload/null-vs-string mismatches).

**Why:** These predate current work and are not boot-blockers; the app runs and
the vitest suite passes despite them.

**How to apply:** When validating a change, compare the error *count* and check
that none of the errors are in files *you* touched, rather than expecting 0 total
errors. Don't chase these baseline errors unless the task is explicitly to fix them.
