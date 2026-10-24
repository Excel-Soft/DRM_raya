# Foundation status — Phase 1–4 (see PHASE4_FOUNDATION_AUDIT.md for readiness)

**Branch:** `fix/upgrade_frontend_habib`  
**Date:** 2026-03-23  
**Scope:** Scaffold only — no business pages, no Express/DB/deploy changes.

---

## Phase 0 prerequisite check

| Deliverable | Status |
|-------------|--------|
| Reconciled route matrix (registry + App + sidebar + backend) | **DONE (Phase 0 inventory)** — see `docs/route-matrix/phase-0-exit-record.md` |
| Legacy audit logs client guard (AUTH-AUDIT-01) | **DONE** — `frontend/src/lib/route-access.ts` |
| Next route-access policy spec | **DONE** — `src/lib/auth/route-access.ts` (ported from legacy) |
| Phase 2 auth bootstrap | **DONE** — `AuthProvider`, `/auth` login, sessionStorage Bearer |
| App shell pilot | **DONE (minimal)** — `AppShell`, pilot `/notice-board` |
| Migration tracker with real routes | **DONE** — `migration-routes.json` + `migration-tracker.ts` |
| Module ownership / parallel dev | **DEFERRED** — until Habib approves foundation (`PHASE4_FOUNDATION_AUDIT.md`) |
| Production/staging Node version for standalone Next | **PENDING** — no CI/deploy evidence in repo (legacy frontend is static Vite) |
| Shared-code browser audit | **DONE** — `src/config/shared-import-audit.ts` |

Proceeding with Phase 1 scaffold was **non-destructive** and did not block on Phase 0 matrix completion.

---

## Completed scaffold tasks

- [x] `frontend-next/` Next.js **16.4.2** App Router + TypeScript strict
- [x] npm lockfile (`package-lock.json`) for `frontend-next/`
- [x] `output: "standalone"` in `next.config.ts`
- [x] Dev/prod rewrites: `/api`, `/uploads` → `BACKEND_URL`
- [x] `@/*` and `@shared/*` TypeScript paths
- [x] API client foundation (`browser-client`, `server-client`, `errors`, `env`)
- [x] Minimal app routes: `(app)/`, `(public)/auth`, `api-health`
- [x] Module placeholders: `auth`, `dashboard`
- [x] Providers pass-through (client boundary for Phase 2)
- [x] No `proxy.ts` (Express = auth authority)
- [x] README + this status doc

---

## Shared-code audit summary

| File | Client-safe? |
|------|----------------|
| `validators.ts` | Yes (Zod) |
| `gm-sales-constants.ts` | Yes |
| `service-bridge-constants.ts` | Yes |
| `verification-lifecycle.ts` | Yes |
| `schema.ts` | **No** — Drizzle ORM; server/bundle risk |
| `dollarsystem.php` | N/A — not TS |

Compile-time `@shared/validators` import verified via `shared-import-audit.ts`.

---

## Node.js compatibility

| Environment | Version | Notes |
|-------------|---------|--------|
| Local (this run) | v23.11.0 | Next 16 OK; ESLint engine range — use `frontend-next/.npmrc` (`engine-strict=false`) or Node 24+ / 22.13+ / 20.19+ |
| Next.js 16 requirement | ≥ 20.9 | Documented |

Production Node for standalone Next: **not verified** in repository artifacts.

---

## Validation results

| Check | Result |
|-------|--------|
| `npm install` | **PASS** (with `.npmrc` `engine-strict=false` on Node 23.11.0) |
| `npm run typecheck` | **PASS** (`@shared/validators` via `shared-path.typecheck.ts`) |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** (`next build --webpack`; Turbopack default blocked sibling `shared/` imports) |
| Standalone output | **PASS** — `.next/standalone/server.js` present |
| `GET /api/health/db` direct to Express :5001 | **PASS** (backend running locally during validation) |
| `GET /api/health/db` via Next rewrite (:3000) | **PASS** — rewrite to `BACKEND_URL` / :5001 |
| Legacy `frontend/` / `backend/` | **UNCHANGED** (no tracked diffs) |

### `@shared` bundler note

Turbopack build cannot resolve symlinks or files outside `frontend-next/` roots. Production build uses **`--webpack`** with `experimental.externalDir` and `@shared` webpack alias. Runtime app does not bundle shared code until modules import it (Phase 2+).

---

## Known blockers / follow-ups before pilot (Phase 2–3)

1. Complete reconciled **route matrix** and populate `migration-tracker.ts`.
2. Confirm **Talha** module ownership.
3. Implement **auth** flow + React Query providers (Phase 2).
4. Port **sidebar/topbar** and shadcn `ui/` (Phase 3).
5. Confirm production **Node** runtime and Nginx standalone routing in staging.
6. Align **BACKEND_URL** / `PORT` documentation with team default (5000 vs 5001).

---

## Phase 4

See **`docs/PHASE4_FOUNDATION_AUDIT.md`**. Foundation hardening audit complete; **not declared fully ready** for broad module migration or Talha assignment.
