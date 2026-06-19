---
name: Cold full-project tsc is environment-blocked
description: Why a clean `tsc --noEmit` run is hard to get in this sandbox and what to use instead.
---

# Cold full-project `tsc --noEmit` times out in this sandbox

A cold full-project `npx tsc --noEmit` here regularly exceeds the 120s shell
timeout (no `.tsbuildinfo` exists initially even though `incremental: true`), and
backgrounded/detached runs (`nohup … &`) get reaped when the tool's shell session
ends, so the `done` sentinel never appears.

**Use instead:** the editor's `tsserver` is already running. Query
`getLatestLspDiagnostics({ filePath })` (diagnostics skill) per touched file —
it's fast and authoritative for type errors in those files. Combine with the
vitest suite (which transforms TS) and a clean boot for confidence.

**Why:** repeatedly re-running the same timing-out `tsc` wastes the whole turn
budget and still yields nothing. LSP per-file diagnostics + green tests is the
practical equivalent of the `tsc=0` gate for the files you changed.
