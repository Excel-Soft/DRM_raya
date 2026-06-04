---
name: Type-check baseline
description: How to interpret `npm run check` results in WebExcels DRM
---

`npm run check` reports a set of pre-existing TypeScript errors concentrated in
`server/repositories/*` (drizzle return-type mismatches: nullable name/email,
missing columns, `SQL<unknown> | undefined` args). The total count drifts
roughly between 58 and 66 across edits.

**Why:** these are long-standing repository typing issues unrelated to feature
work; fixing them is out of scope for most tasks.

**How to apply:** when verifying a change introduced no new type errors, confirm
the *changed files* have zero errors (and the total did not rise above the
working baseline), rather than expecting an exact fixed number. `npm run build`
should still succeed.
