# PATCH 6 — Build / Type-Check / Runtime Report (Stage 10, Section A)

Technical gates executed in the Replit environment on 2026-06-22. All results below
are **real captured outputs**, not estimates. Raw logs retained under `/tmp`:
`p6_ci.log`, `p6_check.log`, `p6_build.log`, `p6_test.log`.

## Environment

| Item | Value |
|---|---|
| Node version | `v20.20.0` (engines: `>=20 <23`) |
| npm version | `10.8.2` |
| OS | Replit NixOS container |
| DB | Replit-provided PostgreSQL (`helium`), schema `drm` |
| NODE_ENV (dev) | `development` |

## A.1 Install — `npm ci`

- **Command:** `npm ci`
- **Result:** ✅ **exit 0**
- Added **608 packages**, audited 609 in ~1m.
- **Security audit:** **16 vulnerabilities (1 low, 8 moderate, 7 high)** — all from
  transitive dependencies; none introduced by Patch 6. Tracked as a non-blocking
  hardening item (`npm audit` for detail). No `audit fix --force` run (would risk
  breaking changes); deferred to a dedicated dependency-hardening pass.
- Deprecation warnings only (`@esbuild-kit/core-utils`, old `glob`) — non-blocking.

> Note: the runbook historically used `npm install`; `npm ci` (clean, lockfile-exact)
> also completes successfully, confirming `package-lock.json` is in sync.

## A.2 Type-check — `npm run check` (`tsc`)

- **Command:** `npm run check` → `tsc`
- **Result:** ✅ **exit 0 — 0 errors.**
- (Historical baseline noted ~57 pre-existing `tsc` errors in legacy files; the
  current tree type-checks clean with no emitted errors.)

## A.3 Build — `npm run build`

- **Command:** `npm run build` → `vite build && esbuild server/index.ts ... --outdir=dist`
- **Result:** ✅ **exit 0.**
- Client (Vite): built in **39.01s**.
- Server (esbuild): `dist/index.js` ≈ **2.3 mb**, bundled in ~224ms.
- **Warning (non-fatal):** largest client chunk `assets/index-*.js` =
  **3,147.06 kB (gzip 816.11 kB)**, exceeding the 500 kB advisory. This is a bundle
  **optimisation** flag (code-splitting / manualChunks), **not a build failure**.
  Tracked as a non-blocking performance item.

## A.4 Dev server — `npm run dev` (workflow "Start application")

- **Command:** `cross-env NODE_ENV=development tsx watch server/index.ts`
- **Result:** ✅ **boots cleanly, serving on port 5000.**
- Boot log evidence: `[db] connecting host=helium ... ssl=off`, `HOD routes mounted`,
  `serving on fixed port 5000`, `[accounts] schema maintenance completed successfully`.
- Live runtime health (HTTP, post-restart):
  - `GET /` → **200** (Vite client served).
  - `GET /api/auth/me` (anonymous) → **401** (`reason=missing-token`) — global auth live.
  - Browser console at boot: `[vite] connecting...` → `[vite] connected.` (no errors).
- IPv6 bind falls back to `0.0.0.0` (informational), then binds 5000 successfully.

## A.5 Tests — `npm test` (`vitest run`)

- **Command:** `npm test` → `vitest run`
- **Result:** ✅ **exit 0.**
- **Test files: 14 passed (14). Tests: 219 passed (219).** Duration ~50s.

## A.6 Database — migration / schema verification (non-destructive)

- **`drizzle-kit push` (`npm run db:push`) is a KNOWN partial-failure** and was **not**
  re-run. It fails at the foreign-key stage because `shared/schema.ts` /
  `migrations/0000_*.sql` declare ~62 FKs where a `varchar` column references
  `users.id` (a `uuid`); PostgreSQL refuses FKs across incompatible types. This is
  **pre-existing** and affects only those referential constraints, not tables/columns
  or app behaviour. Re-running `push` could attempt destructive alterations, so it was
  deliberately avoided per "no destructive DB operations."
- **Schema verified read-only** via `information_schema`:
  - `drm` schema present; **508 base tables** (the original 108 schema-defined tables
    plus per-executive sales tables auto-provisioned at runtime by `ensureSalesTables`).
  - `drm.users` confirmed with `id (uuid)`, `role (text)`, `role_id (text)`,
    `roles (array)`, plus HR/profile columns — consistent with `shared/schema.ts`.
- **Runtime schema maintenance** runs on boot (`[accounts] schema maintenance completed
  successfully`) and via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` paths,
  which is the supported mechanism in this repo (not `db:push`).

## A.7 Unresolved errors / non-blocking items

| Item | Severity | Status |
|---|---|---|
| 16 npm-audit vulns (1 low/8 mod/7 high, transitive) | Medium | Open — dependency hardening pass |
| Client chunk > 500 kB (index ~3.14 MB) | Low | Open — bundle code-splitting |
| `db:push` FK varchar→uuid mismatch (pre-existing) | Low | Documented; schema applied via runtime ensure paths |
| browserslist data ~8 months old | Cosmetic | Open — `npx update-browserslist-db@latest` |

**Gate summary:** install ✅ · type-check ✅ · build ✅ (1 advisory) · dev server ✅ ·
tests ✅ (219/219) · DB schema verified ✅ (non-destructive). **No blocking errors.**
