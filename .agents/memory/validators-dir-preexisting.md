---
name: server/validators is a populated domain directory
description: Creating a same-named validator file silently clobbers an existing one imported by routes.
---

`server/validators/` already holds domain validator modules (e.g.
`invoice.validators.ts`, `common.validators.ts`) that are imported by route files
(`invoice-routes.ts` imports the `workflow*Schema` exports from
`invoice.validators.ts`).

**Rule:** before creating a validator file with the `write` tool, check whether it
already exists (`git cat-file -e HEAD:<path>` / `ls server/validators/`) and grep
for its importers. The `write` tool overwrites silently, so a "new" file with an
existing name destroys the exports other routes depend on.

**Why:** during Patch 5 Stage 1 a `write` to `server/validators/invoice.validators.ts`
clobbered the pre-existing file; only `tsc` (missing-export errors in
`invoice-routes.ts`) caught it. Fix was to restore the original exports verbatim and
append the new schemas.

**How to apply:** when adding domain validators, prefer appending to the existing
file (after reading it) over writing a fresh one; treat any same-named target as
"edit", not "create".
