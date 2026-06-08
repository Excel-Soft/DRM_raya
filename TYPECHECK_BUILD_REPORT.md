# Typecheck & Build Report — Stage 10 (Task A)

Active app: `server/` + `client/` + `shared/`. The `src/` tree is legacy and not
mounted. Commands run from the repo root.

## `npm run check` (tsc `--noEmit`)

- **Result:** completes with **57 pre-existing errors** (the stable baseline).
- **New errors introduced by Stage 10:** **0**. None of the Stage 10
  new/changed files (`server/middleware/request-id.ts`, `server/index.ts`,
  `server/logger.middleware.ts`) produce type errors.
- The 57 baseline errors live in unrelated business-logic files (notably
  `server/reports-routes.ts` drizzle enum / `createdBy` typings around lines
  450+, and `server/repositories/*.ts`). They predate Stage 10 and were **not**
  refactored — fixing them would require touching business logic/queries, which
  is explicitly out of scope (no risky global refactor).

Count command:

```bash
npm run check 2>&1 | grep -c "error TS"   # -> 57
```

## `npm run build`

- **Result:** **passes** (`✓ built in ~29s`; esbuild server bundle `dist/index.js`).
- Client emits **per-page lazy chunks** (route-level code splitting from task B
  is active — see the many small dashboard/report/service chunks in the output).
- **Warning (expected, not an error):** the main `index-*.js` chunk is
  ~3.15 MB (gzip ~812 kB). Vite warns that some chunks exceed 500 kB. This is the
  shared/eager bundle (router shell, vendor libraries, and the many non-heavy
  pages that remain eager by design). Heavy routes are already split out.

### Largest emitted chunks (illustrative)

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (eager shell + vendor) | ~3.15 MB | ~812 kB |
| `it-manager-dashboard-*.js` | 157 kB | 21 kB |
| `software-manager-dashboard-*.js` | 151 kB | 19 kB |
| `index.es-*.js` (vendor) | 151 kB | 51 kB |
| `sales-assistant-manager-dashboard-*.js` | 113 kB | 28 kB |
| `proxy-*.js` | 111 kB | 36 kB |

## Decisions

- **No global tsc refactor.** Baseline kept at 57; gate = "0 new errors", which
  Stage 10 meets.
- **No aggressive `manualChunks` vendor splitting.** Reworking Rollup chunking to
  shrink the eager `index` chunk risks breaking import order / runtime init for a
  large app with many interdependent pages. Route-level lazy loading (task B) is
  the sanctioned, lower-risk split and is in place. Further vendor-chunk tuning is
  recorded as an optional, non-blocking future item.

## Reproduce

```bash
npm run check    # 57 baseline errors, 0 new
npm run build    # passes; per-page lazy chunks + one large eager index chunk
npm test         # vitest: 14 tests pass
```
