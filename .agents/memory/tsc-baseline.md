---
name: tsc baseline errors
description: Known pre-existing type errors that must NOT be "fixed" as part of unrelated work.
---

`npx tsc --noEmit` reports ~58 pre-existing errors that are **baseline** and out of scope to fix:
- `server/reports-routes.ts` — drizzle typing issues (enum mismatches, `createdBy` not on certain tables, `SQL<unknown> | undefined` passed where `SQL<unknown>` expected, `string | null` vs `string`).
- `server/repositories/*.ts` (call-sessions, customers, permissions, project-approvals, project-assignments).

**Why:** these are drizzle/business-logic typings that predate recent work; "fixing" them means touching business logic and risks behavior changes.

**How to apply:** when checking your own changes with tsc, filter these out. If total stays ~58 and none of the errors point at files you changed, you introduced no new type errors. `npm run check` can exit 0 even with these present (npm masks tsc's non-zero exit) — read the actual error list, don't trust the exit code.
