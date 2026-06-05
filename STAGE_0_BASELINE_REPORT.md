# Stage 0 — Baseline Report

Baseline inspection of the imported WebExcels CRM/ERP/DRM codebase. No business
logic, workflows, permissions, or schema were changed in this stage. Only
read-only inspection + the existing running app were used.

## Project root
- `/home/runner/workspace` — the single `package.json` lives here and contains all
  `dev` / `build` / `start` / `check` / `db:push` scripts.

## Active runtime (confirmed)
- Backend entry: `server/index.ts` → `server/routes.ts` (Express + TypeScript).
- Frontend: `client/src/App.tsx` (React + Vite + TypeScript, wouter routing).
- Shared: `shared/schema.ts` (Drizzle ORM, PostgreSQL schema `drm`).
- The smaller `src/` scaffold is **legacy and NOT mounted** by the running server.
  Do not treat it as the primary app.

## Node / npm version
- Node: **v20.20.0** (satisfies Node 20 requirement).
- npm: **10.8.2**.

## Install command
- Dependencies were already installed (`node_modules` present) and the app boots
  and serves successfully, so **no reinstall was performed** in this stage. If a
  clean install is needed: `npm ci` (fallback `npm install`).

## Run command
- `npm run dev` → `cross-env NODE_ENV=development tsx watch server/index.ts`.
- Build: `npm run build` (vite build + esbuild bundle of server).
- Prod start: `npm run start` (`NODE_ENV=production node dist/index.js`).

## App run status
- **Running.** Workflow `Start application` is up, serving on fixed **port 5000**.
- Startup log shows: DB connected, HOD routes mounted, accounts schema
  maintenance completed, `serving on fixed port 5000`.
- Unauthenticated `GET /api/auth/me` correctly returns 401.

## Database status
- **Connected** to the Replit-provided PostgreSQL (`host=helium db=heliumdb
  user=postgres`).
- Schema: `drm`. Startup "accounts schema maintenance completed successfully"
  indicates schema is present.
- `npm run db:push` was **not** run — schema is already pushed and the app boots
  with DB-backed routes working. (Run `db:push` only when `shared/schema.ts`
  changes.)

## Environment variables required
- `DATABASE_URL` — **SET** (Replit PostgreSQL).
- `JWT_SECRET` — **SET** (JWT signing/verification).
- `NODE_ENV` — provided per-script via `cross-env` (`development` in dev,
  `production` in start); not required to be set in the shell.
- Replit PG also exposes `PGHOST`, `PGDATABASE`, etc. (SET).
- Optional/risky: `MOCK_AUTH` (see P0 risks) — **currently NOT set** (safe).

## Major server route groups
Mounted in `server/routes.ts` (≈72 route files under `server/` and
`server/routes/`). Representative groups:
- Auth: `/api/auth` (`auth.routes.ts`) — public.
- DRM: `/api/drm` (`drm-routes.ts`).
- Attributes: `/api` (`attributes-routes.ts`).
- AI: `/api/ai` (`ai-routes.ts`).
- CRM / Sales / Customers: `/api/crm` + `/api` (`crm-routes.ts`, `sales-routes.ts`).
- Pools / Leads: `/api/pools` (`pools-routes.ts`), GM/BV (`gm-pool-routes.ts`,
  `gm-bv-pool-routes.ts`).
- Temp contacts: `/api/customer/temporary-contact` + `/api/temp-contact`.
- Users / RBAC: `/api/users` (`users-routes.ts`), `/api` (`rbac-routes.ts`).
- HR: leave / overtime / loan / attendance routes.
- PMS / Projects: `/api/pms`, `/api/projects`, `/api/tasks`.
- Product posting / Software workflow: `/api/product-posting`, `/api/software`.
- Service: `service-*-routes.ts`.
- Office / Accounts: `/api/office`, `account-routes.ts`, `/api/invoices`.
- Reports: `/api/reports` (`reports-routes.ts`, `stage3-reports-routes.ts`).
- Support: `support-routes.ts`. Training: `/api/training`. Events: events routes.
- Notice / Policies / Portfolio / IT assets / Reception / Notifications /
  Target system, etc.

## Major frontend route groups
`client/src/App.tsx` declares **~190 `<Route>` entries** (wouter). Groups:
- Dashboards (`/dashboard/*` — ~25 role dashboards).
- Sales / Customers (`/sales/*`, `/customers/*`, `/customer/*`).
- HR (`/hr/attendance`, `/hr/leave-request`, `/hr/overtime`, `/hr/loan`).
- PMS / Projects (`/pms/*`, `/projects/*`).
- Product posting (`/product-posting/*`), QA/verification.
- Service (`/service/*` — ~18 pages).
- Office / Accounts (`/office/*`, `/account/*`).
- DRM (`/drm/*`). Reports (`/reports/*`). Support (`/support/*`). Events
  (`/events/*`). Training (`/training`).

## Direct /api fetch usage summary
- API access is centralized through `client/src/lib/queryClient.ts`
  (`apiRequest` / `apiRequestJson` + TanStack Query). It **globally attaches**
  `Authorization: Bearer <token>` and `x-acting-role` headers.
- Pages issue calls via `useQuery`/`useMutation` with `/api/...` keys routed
  through that helper, so auth headers are consistently applied. A few pages also
  use `fetch` directly (e.g. `auth.tsx` login/reset) — these set headers
  explicitly.

## Duplicate route groups found
- `crmRoutes` mounted at **both** `/api/crm` and `/api` (the second mount exists
  to expose `/api/customers/search` at the root).
- `tempContactsRoutes` mounted at **both** `/api/customer/temporary-contact` and
  `/api/temp-contact`.
- `rbacRoutes` mounted at `/api` (broad root mount).
These are intentional aliases but increase surface area / ambiguity; documented,
not changed.

## Mock / static pages found
Confirmed literal mock/static data (see `MOCK_STATIC_SCREEN_INVENTORY.md`):
- `client/src/pages/drm/pms-setting.tsx` — `MOCK_ACTIVITIES` rendered as table.
- `client/src/pages/reports-bv-pending-rc.tsx` — `MOCK_DATA` rendered + counted.
- `client/src/pages/service-pool-dashboard.tsx` — `mockData` rows rendered.
- `client/src/components/performance-graph.tsx` — `mockData` chart series.
- `client/src/pages/create-target.tsx` — `dummyData`.
- Export-only sample data (not display fallback): `service-private-pool.tsx`,
  `service-commission-verifications.tsx`.

## Routes mounted before authentication
In `server/routes.ts`, the global `app.use("/api", authMiddleware)` is applied
**after** these mounts:
1. `/api` request-logging middleware (harmless).
2. Optional `MOCK_AUTH` middleware — **only if `MOCK_AUTH=true`** (a hard auth
   bypass; see P0).
3. `/api/drm` (`drm-routes.ts`) — applies `authMiddleware` **locally** per route,
   so individual handlers are still protected.
4. `/api/auth` (`auth.routes.ts`) — intentionally public (login/refresh/etc.).
5. `/api` (`attributes-routes.ts`) — **NO auth** on its handlers (P0).
6. Public DB health check.

## Immediate P0 risks confirmed
1. **Unauthenticated attributes endpoints.** `attributes-routes.ts` exposes
   `GET /api/attributes/:category`, `POST /api/attributes`, and
   `DELETE /api/attributes/:id` with **zero auth checks**, mounted before the
   global `authMiddleware`. Create/delete of attribute data is reachable without a
   token. (Not fixed in Stage 0 — flagged for the security stage.)
2. **`MOCK_AUTH` bypass.** When `MOCK_AUTH=true`, a middleware fabricates a user
   (defaulting to `admin@webexcels.com`) from a header/env, bypassing real auth.
   Currently **not set**, but it must never be enabled in any shared/production
   environment.
3. **Mock/static screens presented as real data** (pms-setting, bv-pending-rc,
   service-pool-dashboard, performance-graph) — risk of users trusting fake data.
4. **Pre-existing type errors** (58, see Stage 0 testing section) — not a runtime
   blocker today but a correctness/maintenance risk.

## Stage 0 testing (`npm run check`)
- `tsc` reports **58 errors**, all **pre-existing baseline** in
  `server/repositories/*.ts` (call-sessions, customers, permissions,
  project-approvals, project-assignments) and `server/reports-routes.ts` —
  Drizzle row-shape / nullability mismatches. Documented, **not refactored**
  (out of scope for Stage 0). The app runs and the test suite passes regardless.
- `npm test` (vitest): **14 tests pass**.

## Recommended next stage
**Stage 1 — Security hardening of pre-auth surface:** add auth (and role checks)
to `attributes-routes.ts`, audit every router mounted before the global
`authMiddleware`, and gate/forbid `MOCK_AUTH` outside local dev. Then schedule a
later stage to replace the confirmed mock/static screens with real API-backed
data.
