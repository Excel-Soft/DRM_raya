---
name: tsc baseline is clean
description: authoritative npm run check / tsc --noEmit returns 0 errors; an older "~57 baseline errors" note is stale.
---

# tsc baseline is clean

`npm run check` (`tsc --noEmit`) returns **0 errors** and finishes within the ~115s
sandbox window.

**Why this matters:** an earlier note claimed ~57 pre-existing `tsc` errors to ignore
as baseline. That is stale. Do NOT excuse new `tsc` errors as "pre-existing baseline" —
any error tsc reports now is a real regression to fix.

**How to apply:** LSP per-file diagnostics or `vitest` are fine for the inner loop, but
the authoritative gate (`npm run check`) is expected fully green. `npm run build`
(vite + esbuild) also passes; `npm run dev` boots on fixed port 5000.
