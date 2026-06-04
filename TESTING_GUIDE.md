# Testing Guide

This guide covers how to run the project's checks and tests, what the automated
smoke tests cover, and a manual smoke checklist for verifying the app by hand.

## Commands

All commands are run from the repository root.

| Purpose | Command |
|---|---|
| Type-check (no emit) | `npm run check` (alias for `tsc`) |
| Run all tests | `npm test` (alias for `vitest run`) |
| Run a single test file | `npx vitest run server/stage10-smoke.test.ts` |
| Production build | `npm run build` (vite build + esbuild bundle of server) |
| Start (production) | `npm start` (requires a prior build; `prestart` builds if missing) |
| Dev server | `npm run dev` (`tsx watch server/index.ts`, serves API + Vite client on `PORT`, default 5000) |

### Notes

- Tests use **vitest + supertest**. Config: `vitest.config.ts` includes
  `server/**/*.test.ts` and `shared/**/*.test.ts`. `fileParallelism` is disabled
  so DB-backed tests share a single Postgres pool serially.
- Several tests hit the **real dev Postgres** through the same pool the app uses.
  They require `DATABASE_URL` to be reachable. The Stage 10 smoke tests are
  resilient — they soft-skip DB-sensitive assertions when the DB is unreachable.
- `npm run check` may surface known pre-existing baseline type errors in
  `server/debug-routes.ts` and `server/reports-routes.ts`. These are tracked and
  are not introduced by Stage 10 work.

## What the automated smoke tests cover

`server/stage10-smoke.test.ts` builds the full app via `registerRoutes` (the same
entrypoint `server/index.ts` uses) and verifies cross-cutting behaviour that does
NOT require seeded data or known credentials:

- **Auth gate**: unauthenticated `GET` to a representative protected endpoint in
  each major module returns **401**:
  `/api/auth/me`, `/api/users`, `/api/events`, `/api/reports/reception`,
  `/api/pms/projects`, `/api/product-posting/report-links`,
  `/api/service/complaints`, `/api/attendance/todo`.
- **Login error handling**: `POST /api/auth/login` with bad credentials returns
  **401** (never 500); a malformed body returns **400**. Both bodies are
  sanitized (no stack trace / SQL / secret column names leaked).
- **Unknown routes**: unknown `/api` paths and unknown non-API paths are handled
  without a 500 or stack leak.

`server/performance-routes.team.test.ts` covers the paginated
`/api/drm/performance/team` leaderboard contract against the real DB.

## Manual smoke checklist

Perform after a deploy or significant change. Log in with a real account.

1. **Login**: `pages/auth.tsx` → submit valid credentials → redirected to a role
   dashboard; invalid credentials show an error toast (not a crash).
2. **RBAC block**: navigate (or deep-link) to a route your role should NOT access
   → blocked / redirected, not a server 500.
3. **Sidebar route opens**: click several sidebar items → each page loads without
   a blank screen or console error (lazy-loaded pages show a brief spinner).
4. **Customer list**: open the customer/sales customer list → rows render, filters
   work.
5. **Sales / lead page**: open a sales dashboard and the lead pools page → data
   loads.
6. **PMS task page**: open `pms-tasks.tsx` / team workspace → task board renders.
7. **Product posting manager**: open the product-posting manager dashboard/queue
   → queue loads (or empty state, not an error).
8. **Service page**: open a service list (e.g. complaints) → renders.
9. **Report page**: open a report (e.g. reception, GM, BV) → data/export buttons
   work; export downloads a file.
10. **Attendance todo**: open the attendance todo list → items load; create one.
11. **Admin user list**: as an admin, open the user list → users render; create /
    edit / toggle status works.

If any step returns a 500 or a blank page, capture the server log line
(`[ERROR] METHOD URL -> status`) and the browser console before filing.
