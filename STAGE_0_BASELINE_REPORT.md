# STAGE 0 — Baseline Audit, Run Stability & Implementation Control

WebExcels DRM / CRM / ERP (imported). Read-only audit. No business features
implemented, no refactors, no deletions, no workflow/DB-structure changes. The
only file written by this stage is this report (plus generated `dist/` build
artifacts from `npm run build`).

---

## 1. Correct project root
- **Root:** `/home/runner/workspace`
- **Active `package.json`:** name `rest-express` (single root package; no nested
  workspace `package.json` files).
- **Scripts confirmed present:** `dev`, `build`, `start`, `check`, plus
  `db:push` / `db:generate` / `db:migrate` (drizzle-kit), `db:seed`, `db:setup`,
  `test` (vitest).
  - `dev`: `cross-env NODE_ENV=development tsx watch server/index.ts`
  - `build`: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
  - `start`: `cross-env NODE_ENV=production node dist/index.js` (with a `prestart`
    guard that rebuilds if `dist` is missing)
  - `check`: `tsc`
- **Legacy / not the active app:** `auth:dev` (`tsx src/server/index.ts`) and
  `api:dev` (`tsx src/server.ts`) point at the smaller `src/` scaffold — confirmed
  legacy, not used by the active runtime.

## 2. Node / npm version
- `node -v` → **v20.20.0**
- `npm -v` → **10.8.2**

## 3. Install command used
- Dependencies already installed (`node_modules` present, ~465 MB). No reinstall
  was required to run. The appropriate command for a clean machine is
  **`npm install`** (a single root lockfile drives the whole app).

## 4. Run command
- **`npm run dev`** — bound to the `Start application` workflow, serving on
  **port 5000** (Express serves both the API and the Vite client via middleware).
  App run status: **running / serving**.

## 5. Build / check result
- **`npm run build`: SUCCESS** (exit 0, ~30s). Artifacts produced:
  - `dist/index.js` (server bundle, ~1.5 MB)
  - `dist/public/index.html` + `dist/public/assets/*` (client bundle)
  - Non-blocking warning: main client chunk > 500 kB (code-splitting opportunity,
    not an error).
- **`npm run check` (`tsc`): pre-existing errors present, NOT fixed (per Stage 0
  scope).** ~19 distinct error sites / 64 total `error TS` lines, all in files
  unrelated to the active boot path:
  | File | Error sites |
  | :--- | :--- |
  | `server/reports-routes.ts` | 6 |
  | `server/debug-routes.ts` | 4 |
  | `server/repositories/project-assignments.repository.ts` | 2 |
  | `server/repositories/call-sessions.repository.ts` | 2 |
  | `server/repositories/project-approvals.repository.ts` | 1 |
  | `server/repositories/permissions.repository.ts` | 1 |
  | `server/repositories/customers.repository.ts` | 1 |
  | `server/migrations/update-related-customers.ts` | 1 |
  | `server/migrations/create-related-customers.ts` | 1 |
  - These are mostly Drizzle row-type / nullability mismatches and an
    `insert()` shape mismatch. They do **not** block `dev`, `build`, or `start`
    (build uses esbuild/vite, which transpile without type-checking). Left
    untouched — no unrelated refactor.

## 6. Database status
- **Engine:** PostgreSQL (Replit-provided). `DATABASE_URL` is set in the
  environment.
- **Schema:** `drm` (plus default `public`). **118 tables** in `drm`.
- **Seed state:** `drm.users` has **1 row** (dev admin). Most business tables are
  effectively empty in this dev DB.
- **ORM:** Drizzle; schema defined in `shared/schema.ts` (2,787 lines). Migrations
  via drizzle-kit. No DB-structure changes were made.

## 7. Existing environment variables referenced (names only — no values)
- **Core:** `DATABASE_URL`, `NODE_ENV`, `PORT`, `JWT_SECRET`
- **DB (alt/legacy):** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
  `DB_SSL`, `DATABASE_SSL`, `DB_LOGGED`, `PGHOST`
- **Auth / cookies:** `AUTH_COOKIE_NAME`, `AUTH_COOKIE_DOMAIN`,
  `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_MAX_AGE_MS`,
  `MOCK_AUTH`, `MOCK_AUTH_EMAIL`, `IP_RESTRICTION_ENABLED`
- **CORS / origins:** `CLIENT_ORIGIN`, `CORS_ORIGINS`, `FRONTEND_URL`,
  `VITE_APP_URL`, `VITE_ORIGIN`
- **Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **AI:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`
- **Debug/logging:** `LOG_LEVEL`, `DEBUG_AUTH`, `DEBUG_ERRORS`, `DEBUG_PG_POOL`,
  `DEBUG_ATTENDANCE`, `DEBUG_SALES_DASH`
- Only `DATABASE_URL`, `JWT_SECRET`, and (for prod) cookie/origin settings are
  required to boot; others are optional/feature-gated.

## 8. Main frontend routes count
- **~168 route entries** in `client/src/App.tsx` (includes duplicates and
  dynamic `:param` routes).

## 9. Main sidebar items count
- **~105 clickable nav links** in `client/src/components/app-sidebar.tsx`.

## 10. Main backend route groups (`server/routes.ts`)
Mounted (in order): `app.use("/api", mockAuth?)` → `/api/drm` → `/api/auth` →
`/api` attributes → **`authMiddleware` (line 179)** → `checkAllowedIp` →
`checkUrlPermission` → `/api/ai`, then the protected groups:
`registerSalesRoutes`, `registerPmsRoutes`, `registerSupportRoutes`,
`registerGmPoolRoutes`, `registerGmBvPoolRoutes`, `registerProjectActivityRoutes`,
`registerQuotationRoutes`, `registerServicePoolRoutes`,
`registerServiceExecutiveRoutes`, `registerServiceManagerRoutes`,
`registerServiceCoreRoutes`, `registerSettingsRoutes`, `registerAttendanceRoutes`,
`registerTodoRoutes`, `registerLeaveRoutes`, `registerOvertimeRoutes`,
`registerLoanRoutes`, `registerProjectReportRoutes`, `registerReportsRoutes`,
`registerAccountRoutes`, `registerQuickEntriesRoutes`, `registerDashboardRoutes`,
`registerHodRoutes`, `registerBotRoutes`, `registerFormRoutes`, `registerFbRoutes`,
`registerDdManagerRoutes`, `registerDdExecutiveRoutes`, plus `app.use` routers:
`/api/customer/temporary-contact`, `/api/temp-contact`, `/api/pools`,
`/api/training`, `/api/crm` (+ root `/api`), `/api/office`, `/api/users`,
`/api/admin/activities`, RBAC `/api`, `/api/notice-board`, `/api/policies`,
`/api/portfolio`, `/api/it`, `/api/reception`, `/api/invoices`, `/api/projects`,
`/api/tasks`, `/api/notifications`, `/api/product-posting`, `/api/software`,
`registerPostingDataRoutes`, `/api/target-system`, `registerPerformanceRoutes`,
`registerIncrementRoutes`, `registerPenaltyRoutes`,
`registerTeamReportLinkReportRoutes`.

## 11. Mock / static pages found (listed in routes/sidebar)
- `DailyAddedGmReport` (`/daily-reports/added-gm`) — hardcoded `mockData`.
- `AllSocialAccountsPage` (`/drm/all-social-accounts`) — hardcoded `mockData`.
- `ItManagerDashboard` (`/dashboard/it-manager`) — hardcoded domain data ("mocked
  from image").
- `PmsStatus` (`/pms/status`) — simulated task IDs (`task-mock…`).

## 12. Security risks confirmed
- **Backend routes mounted BEFORE authentication (high):** `/api/drm`
  (`drmRoutes`, line 112) and `/api` attributes (`attributesRoutes`, line 118) are
  registered **before** `app.use("/api", authMiddleware)` (line 179). Their
  handlers do **not** internally check `req.user`, so permission/menu and
  attribute data (incl. write endpoints) are reachable unauthenticated.
- **Client-only route protection:** `client/src/hooks/useRouteProtection.ts`
  guards purely on `sessionStorage` — cosmetic; real enforcement must be
  server-side.
- **`MOCK_AUTH` bypass:** when `MOCK_AUTH=true`, a header-driven mock user is
  injected and the real `authMiddleware` is skipped. Must remain disabled in
  production.
- Genuinely public endpoints (expected): `/api/auth/login|signup|forgot-password`,
  `/health/db`, `/health/auth`.

## 13. API / frontend mismatches found
- **Sidebar links resolving only via the `/reports/:type` wildcard** (no
  dedicated route component): `/reports/loan`, `/reports/vas`, `/reports/gm`,
  `/reports/bv`. They render the generic `UserReports` page via the catch-all
  rather than a purpose-built page; `/reports/gm` in one place points at
  `/analytics/gm`.
- **Duplicate frontend route paths** (later definition wins in Wouter):
  `/product-posting/manager`, `/product-posting/executive`, `/drm/delay-project`,
  `/drm/pms-setting`, `/office/chart-of-accounts`, `/account/gm-entries`,
  `/pms/project-report`, `/customer/temporary-contact` vs `/sales/temp-contact`.
- **Route shadowing (backend, already noted in code review):** exact
  `/api/reports/*` paths are shadowed by the reports router's `/reports/:type`
  param route unless mounted earlier — relevant for any future report endpoint.

## 14. Files that SHOULD be touched in Stage 1 (candidates — pending your scope)
- `server/routes.ts` — move `drmRoutes` / `attributesRoutes` to **after**
  `authMiddleware` (or add per-handler auth) to close the pre-auth exposure.
- The four mock pages in §11 — convert to real API-backed pages if they are in
  the Stage 1 requirements.
- Sidebar/route reconciliation for the `/reports/loan|vas|gm|bv` links and the
  duplicate route paths in §13.
- (Optional, low-risk) the pre-existing `tsc` errors in §5 if type-clean CI is a
  Stage 1 goal.
> Exact Stage 1 file set depends on the feature scope you approve next.

## 15. Files that should NOT be touched yet
- `shared/schema.ts` and any migration files — no DB-structure changes.
- Approval-workflow logic (PMS approvals, product-posting/software workflow phase
  logic in `server/routes/product-posting-workflow-routes.ts` and related).
- Roles / permissions / RBAC enforcement semantics.
- The legacy `src/` scaffold and `auth:dev` / `api:dev` scripts.
- Existing backup / scratch files.
- Unrelated modules carrying the pre-existing `tsc` errors, unless explicitly in
  Stage 1 scope (no broad refactor).

---

## Files inspected
- `package.json`, `server/index.ts`, `server/routes.ts`, `server/auth.routes.ts`,
  `server/leave-routes.ts`, `server/loan-routes.ts`, `server/overtime-routes.ts`,
  `server/routes/product-posting-workflow-routes.ts`, `server/todo-routes.ts`,
  `server/drm-routes.ts`, `shared/schema.ts`, `client/src/App.tsx`,
  `client/src/components/app-sidebar.tsx`, `client/src/hooks/useRouteProtection.ts`.

## Recommended next stage
Proceed to **Stage 1** only after approval. Highest-value first step:
**close the pre-auth route exposure** (`/api/drm`, `/api/attributes`) in
`server/routes.ts`, then address mock-page conversion and route/sidebar
reconciliation per the approved feature scope.
