# PATCH 7 — Build / Typecheck / Test Report (Stage 8, Section E)

**Date:** 2026-06-30. **Environment:** Replit (NixOS container).
All commands executed this session against the active app (`server/`, `client/`,
`shared/`). Results are real, not asserted.

## Toolchain

| Item | Value |
|---|---|
| Node | `v20.20.0` |
| npm | `10.8.2` |
| Test runner | Vitest `v4.1.8` |
| Bundler | Vite (client) + esbuild (server) |

## Commands & results

| Step | Command | Result | Evidence |
|---|---|---|---|
| Install | `npm ci` | **Not executed** (see note) | — |
| Typecheck | `npm run check` (`tsc`) | **PASS — exit 0** | clean, no diagnostics |
| Build | `npm run build` (`vite build && esbuild server/index.ts …`) | **PASS — exit 0** | built in 29.95s |
| Dev server | `npm run dev` | **PASS — running** | boot log: `serving on fixed port 5000`; `[accounts] schema maintenance completed successfully` |
| Tests | `npm test` (`vitest run`) | **PASS — 227/227, 15 files, exit 0** | duration ~22–39s |
| Migration | `npm run db:push` | **FAIL (known, pre-existing)** | FK type mismatch repo-wide; runtime ensure-DDL is the applied path (see `PATCH7_DATABASE_MIGRATION_PLAN.md`) |

### `npm ci` note (honest)
`npm ci` was **not** run. In the Replit environment dependencies are platform-managed;
`npm ci` deletes and reinstalls `node_modules`, which would interrupt the running
dev workflow and provides no additional signal here. Dependency integrity is instead
evidenced by the green `check`, `build`, and `test` runs above, all of which resolve
and compile the full dependency graph. To reproduce a clean-install gate in CI, run
`npm ci && npm run check && npm run build && npm test`.

## Build warnings (non-fatal)
- Client: `index-*.js` chunk **3,149 kB** (gzip 817 kB) — exceeds the 500 kB advisory.
  Vite recommends `manualChunks` / dynamic `import()` code-splitting. **Non-blocking**;
  app builds and serves. Optimization is a performance follow-up, not a Stage-8 gate.
- Server bundle `dist/index.js` **2.3 mb** — expected for a single esbuild bundle with
  `--packages=external`; non-blocking.
- Browserslist caniuse-lite data ~8 months old (cosmetic).

## Test surface (15 files, 227 tests)
Includes `server/validate-secrets.test.ts` (production secret hardening:
missing/weak/short `JWT_SECRET`, weak `SESSION_SECRET`, `MOCK_AUTH` prod-fatal),
plus invoice/GM workflow, permission matrix, and data-integrity suites carried from
Patches 5–6. All green.

## Unresolved errors
- **None blocking.** `tsc` exit 0, `build` exit 0, `test` 227/227.
- **Known/accepted, out of scope:** `db:push` FK mismatch (tracked under DB-001;
  runtime ensure-DDL is the live-apply path). Chunk-size advisory (performance follow-up).

## Reproduction
```
node -v            # v20.20.0
npm -v             # 10.8.2
npm run check      # tsc → exit 0
npm run build      # vite + esbuild → exit 0
npm test           # vitest → 227/227 exit 0
npm run dev        # serves on :5000
```
