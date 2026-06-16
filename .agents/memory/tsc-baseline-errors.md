---
name: tsc baseline is zero
description: The repo's `tsc --noEmit` baseline was driven to zero; any new error is a real regression.
---

`npm run check` (`tsc --noEmit`, strict) now reports **0 errors**. The repo
previously carried a stable ~57-error baseline (Drizzle overload / null-vs-string
mismatches in `server/reports-routes.ts`, `server/repositories/*`, plus a handful
of client implicit-any / missing-generic spots); those were all resolved.

**Why:** A dedicated task fixed every baseline error with type-only changes
wherever possible. The app runs via `tsx` (no typecheck at runtime), so type fixes
are safe as long as they don't alter emitted/runtime behavior.

**How to apply:** Treat any `tsc` error as a regression introduced by your own
change — fix it before finishing. Do not assume a "pre-existing" baseline anymore.
When a strict error points at genuinely broken runtime code (e.g. a Drizzle table
property that doesn't exist and is `undefined` at runtime), prefer using the real
column over casting-to-suppress, which would preserve the latent crash.
