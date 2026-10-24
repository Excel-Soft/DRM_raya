# DRM WebExcels — Next.js 16 Frontend Migration Plan

**Status:** Final proposal for team review — implementation not authorized yet  
**Document version:** 2.0  
**Target frontend:** `frontend-next/`  
**Legacy frontend:** `frontend/` (Vite + React + wouter; unchanged until approved cutover)  
**Backend:** `backend/` (existing Express.js API; no rewrite)  
**Database:** Existing database engine, schema, tables, and data; no change in this migration  
**Working context:** Existing team branches and release conventions must be verified before implementation  
**Route inventory:** `frontend/src/routes/route-registry.ts` (approximately 195 registered paths, per the current audit)

---

## 1. Executive decision

Migrate the DRM frontend incrementally to **Next.js 16 App Router**, TypeScript, and a module-first structure. Keep the existing Express API and database unchanged. Use **hybrid rendering**: Server Components by default for suitable server-rendered structure, and Client Components for interactive business screens and existing React Query workflows. Deploy the Next app as a Node.js server using standalone output behind Nginx. Keep the Vite application deployable until the new app passes the cutover gates.

This document is a plan only. Do not scaffold, port modules, modify deployment configuration, change database schema, or cut over production until the plan and pilot scope are approved.

### Decisions locked for this proposal

| Area | Decision |
|---|---|
| Next.js | Next.js 16.x; pin an exact compatible stable patch and lockfile at implementation time |
| Router | App Router |
| Rendering | Hybrid Server Components + Client Components |
| Backend | Existing Express.js API unchanged |
| Database | Existing database unchanged; no migration/schema work in scope |
| API contracts | Preserve endpoints, request/response formats, session behaviour, and role checks |
| Migration model | Separate `frontend-next/`; legacy Vite remains intact until cutover |
| Deployment | Node.js standalone output behind Nginx |
| First milestone | Auth + shared shell + one representative pilot module/flow |
| Team model | Habib owns foundation/integration; Habib and Talha own separate modules after foundation is accepted |
| Release | Staging rehearsal, monitored cutover, and tested rollback before production switch |

**Compatibility note:** Next.js 16 requires Node.js 20.9 or newer and TypeScript 5.1 or newer according to the official upgrade guide. Verify the actual server/runtime and every dependency before pinning the version. Next.js 16 uses `proxy.ts` rather than the deprecated `middleware.ts` convention. References: [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

---

## 2. Existing frontend audit — baseline from the supplied review

The existing review reports the following. Counts are audit estimates and should be rechecked against the current branch before implementation.

| Layer | Current state |
|---|---|
| Build/deploy | Vite 5; `frontend/dist/public`; `frontend/deploy.sh`; Nginx serves static output |
| UI | React 18, TypeScript, Tailwind, shadcn/Radix |
| Routing | wouter; routes declared in `App.tsx`; approximately 190 lazy imports |
| Data | TanStack React Query; `lib/queryClient.ts`; `credentials: "include"`; `/api/*` |
| Authentication | Cookie/session through `/api/auth/*`; client guard `hooks/useRouteProtection.ts` |
| Pages | Approximately 203 files under `frontend/src/pages/` |
| Route inventory | Approximately 195 registered paths across 24 logical modules |
| Shared code | `frontend/shared/` contains schema, validators, and constants |
| Risks | Monolithic route wiring, flat page layout, mixed shared/domain components, server dependencies in legacy frontend package, multiple navigation/access sources |

### Baseline files to audit before porting

- `frontend/src/routes/route-registry.ts` — route inventory and module mapping.
- `frontend/src/App.tsx` — current route wiring and lazy imports.
- `frontend/src/hooks/useRouteProtection.ts` — current client guard.
- `frontend/src/lib/queryClient.ts` — API defaults and 401/error behaviour.
- `frontend/src/components/app-sidebar.tsx` and top-bar components — current shell.
- `frontend/vite.config.ts` — existing `/api` and asset proxy behaviour.
- `frontend/deploy.sh` — existing deployment and rollback reference.
- `frontend/shared/` — imports, aliases, runtime safety, and package dependencies.

Do not assume the route registry is fully authoritative until it is reconciled with `App.tsx`, sidebar links, redirects/aliases, feature flags, and Express authorization. Produce one reviewed route matrix before migration begins.

---

## 3. Scope and non-goals

### In scope

- New Next.js 16 frontend in `frontend-next/`.
- Preserve existing URLs where practical, including redirects for known aliases.
- Port existing UI and business flows incrementally.
- Centralize API access, route metadata, role-aware navigation, and shared UI conventions.
- Hybrid rendering, loading/error states, code splitting, accessibility and responsive improvements as modules are migrated.
- Tests, staging comparison, deployment plan, monitoring, and rollback rehearsal.

### Explicitly out of scope

- Rewriting Express.js or moving business logic into Next.js route handlers/server actions.
- Changing the database engine, schema, existing data, or ORM as part of this frontend project.
- Changing API contracts merely to suit the new frontend.
- Replacing authentication/session storage or introducing a new identity provider.
- Deleting or modifying the legacy Vite frontend before production sign-off and the agreed rollback window.
- A full visual redesign of all screens before functional parity is established. Improve UX incrementally within agreed shared templates and module work.

If a backend bug or API-contract change is discovered, log it as a separately reviewed backend task. Do not silently include it in this migration.

---

## 4. Target architecture

```text
Browser
  └── Nginx (TLS, request limits, routing)
       ├── Next.js 16 Node.js server (frontend-next; standalone build)
       │    ├── App Router / layouts / Server Components
       │    ├── Client Components / React Query / module screens
       │    └── Optional proxy.ts for lightweight redirects/checks only
       └── Existing Express.js API (/api/* and existing API routes)
             └── Existing database (unchanged)
```

### Architecture rules

1. **Express remains the system of record** for business logic, data access, session validation, and authorization.
2. **Next.js is the frontend and rendering layer.** Do not create duplicate business APIs in Next.js unless a separately approved need exists.
3. **One canonical route metadata source** should drive route audit, navigation metadata, migration status, and test expectations where feasible. It must not replace Express-side authorization.
4. **One API client convention** per execution environment: browser requests and server-side requests must account for different URL resolution and cookie-forwarding requirements.
5. **Feature modules own domain code.** Shared components should only contain genuinely reusable UI or cross-cutting functionality.
6. **Legacy remains a known-good fallback** until cutover gates are passed.

---

## 5. Recommended folder structure

The following is the target convention, not a claim that these files already exist. Use the App Router's file-system conventions for routes and keep route files thin.

```text
frontend-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # root HTML, fonts, global CSS
│   │   ├── (public)/
│   │   │   └── auth/
│   │   │       └── page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx             # authenticated shell composition
│   │   │   ├── page.tsx               # role-aware landing/redirect
│   │   │   ├── dashboard/...
│   │   │   ├── reports/...
│   │   │   ├── customers/...
│   │   │   └── ...                    # URL structure mirrors approved route map
│   │   ├── loading.tsx                # optional global loading fallback
│   │   ├── error.tsx                  # optional global error boundary
│   │   └── not-found.tsx
│   ├── modules/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── customer/
│   │   ├── lead/
│   │   ├── reports/
│   │   ├── service/
│   │   ├── pms/
│   │   ├── product-posting/
│   │   ├── accounts/
│   │   ├── office-accounts/
│   │   ├── drm/
│   │   ├── target/
│   │   ├── events/
│   │   ├── attendance-hr/
│   │   ├── analytics/
│   │   └── ...                        # one module per approved RouteModule
│   ├── components/
│   │   ├── ui/                        # shadcn/Radix primitives
│   │   └── layout/                    # sidebar, topbar, breadcrumbs, templates
│   ├── lib/
│   │   ├── api/
│   │   │   ├── browser-client.ts
│   │   │   ├── server-client.ts       # only if server-side API calls are needed
│   │   │   ├── errors.ts
│   │   │   └── query-client.ts
│   │   ├── auth/                      # safe session helpers/access utilities
│   │   └── utils/
│   ├── config/
│   │   ├── routes/                    # route registry, aliases, role-home mapping
│   │   ├── feature-flags.ts
│   │   └── env.ts                     # validated environment access
│   ├── providers/                     # QueryClient, theme, tooltip, toaster
│   └── types/
├── public/
├── proxy.ts                           # only if lightweight request checks/redirects needed
├── next.config.ts                     # standalone output, rewrites as appropriate
├── tsconfig.json                      # strict TS and aliases
├── package.json                       # browser-safe and Next-required dependencies only
└── README.md                           # setup, scripts, env vars, conventions
```

### Module convention

```text
src/modules/reports/
├── api/
│   └── reports.api.ts
├── components/                        # reports-only components
├── hooks/                             # report-specific hooks
├── screens/
│   └── report-day-target.screen.tsx
├── utils/                             # domain-specific formatters
├── constants.ts
├── types.ts
├── index.ts                           # intentional public exports
└── README.md                           # routes, APIs, quirks, test notes
```

### Folder and file rules

- `src/app/**/page.tsx` files should compose/export module screens, not contain large business implementations.
- Use route groups such as `(public)` and `(app)` for organization without changing the URL.
- Use actual route segments and dynamic segments (`[id]`) to preserve approved paths; avoid a single catch-all route for all business screens.
- Use `loading.tsx`, `error.tsx`, and `not-found.tsx` at appropriate route boundaries.
- Shared primitives go in `components/ui`; app-shell elements go in `components/layout`; domain-specific components stay in their module.
- Prefer named exports from module entry points and avoid deep imports across module internals unless explicitly agreed.
- Keep screens reasonably focused (target under ~400 lines where practical); extract components when this improves readability, not just to meet a number.
- Keep `frontend-next/package.json` free of backend-only Express/ORM dependencies unless a dependency is proven to be safe and needed by the frontend build.
- Verify `@shared` imports from `frontend/shared/` in TypeScript, lint, build, and deployment. Shared files must be browser-safe; do not import server-only code into client bundles.

---

## 6. Rendering and data-fetching policy: hybrid SSR/CSR

App Router pages and layouts are Server Components by default. Use Client Components only where interactivity or browser-only APIs require them. Do not apply `'use client'` to every route or entire module by default.

### Use Server Components for

- Static or mostly structural layout composition.
- Lightweight server-rendered page structure and metadata where useful.
- Server-side checks that safely use request context, when they do not duplicate authorization.
- Server-side API reads only when they provide a clear benefit and the session can be forwarded safely.

### Use Client Components for

- Existing React Query-driven dashboards and interactive tables.
- Forms, filters, charts, modals, tabs, toasts, event handlers, and client-side state.
- Browser APIs, local UI preferences, and components requiring effects.
- Screens whose current behaviour depends on client-side query caching/invalidation.

### Data-fetching rules

1. Keep TanStack React Query for interactive client data unless a module has a reviewed reason to change.
2. Namespace query keys consistently, for example `['reports', 'day-target', filters]`; query keys must include all relevant filter/identity scope.
3. Avoid fetching the same data independently in both Server Components and React Query without an explicit hydration/cache plan.
4. For server-side Express calls, use an explicit server API client with a configured private base URL and safe forwarding of the incoming session cookie when required. Do not assume browser-relative `/api` URLs work from a Node.js Server Component.
5. Never forward all incoming headers/cookies indiscriminately to an arbitrary destination. Only forward the minimum required session material to the trusted backend origin.
6. Do not cache user-specific, role-specific, financial, or otherwise sensitive responses as public/shared data. Explicitly test cache behaviour and headers for authenticated routes.
7. Do not expose secrets or private API base URLs through `NEXT_PUBLIC_*`. Use `NEXT_PUBLIC_` only for values intentionally exposed to browsers.
8. Use dynamic imports for heavy charts, PDF/export libraries, and spreadsheet libraries where this reduces initial route bundles.
9. Preserve existing loading, empty, error, pagination, sorting, and invalidation behaviour unless a change is explicitly approved.

### SSR is not a backend rewrite

Server rendering does not require changing Express or the database. If a route is client-heavy, it can remain a Client Component while the surrounding App Router layout is server-rendered. SSR/CSR choice must be recorded per pilot route based on behaviour, data sensitivity, and measured benefit.

Reference: [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).

---

## 7. API, session, authentication, and authorization rules

### API contracts

- Preserve existing Express endpoints, payloads, response envelopes, status codes, and validation rules.
- Preserve existing `/api/*` behaviour and any current upload/static asset paths that the frontend depends on.
- Centralize requests in `src/lib/api/` and module API files such as `modules/customer/api/customer.api.ts`.
- No ad hoc raw `fetch()` in screens. Exceptions must be documented and reviewed.
- Handle network errors, backend error envelopes, 401, 403, 404, validation errors, and server failures consistently.

### Cookie/session behaviour

- Preserve cookie/session authentication and current `credentials: 'include'` behaviour in browser requests.
- Verify cookie `Domain`, `Path`, `SameSite`, `Secure`, and HTTPS behaviour against the existing production setup; do not change cookie settings without an explicit backend/security review.
- Logout must invalidate the existing backend session using the existing API and clear client-side query/user state.
- A 401 should follow the agreed legacy-compatible redirect/notification flow; do not redirect on every transient API failure.
- Server-side calls must forward the relevant incoming cookie only to the configured trusted Express API origin and must not log cookie/token values.
- Avoid duplicate auth bootstrap calls and race conditions between `/api/auth/me`, layout rendering, and client guards.

### Authorization

- Express remains authoritative for actual API authorization and role checks.
- `proxy.ts` may perform lightweight optimistic redirects based on request/cookie presence, but must not be treated as full session validation or authorization.
- Client-side route guards and hidden sidebar links are UX controls, not security boundaries.
- Preserve `allowedRoles`, feature flags, role-specific dashboard destinations, aliases, and inactive-route behaviour.
- Test direct URL access and direct API requests for users with different roles, not only visible navigation.

### Next.js 16 request interception

- If request-level redirects/checks are required, use `src/proxy.ts` or project-root `proxy.ts` according to the chosen `src/` convention.
- Keep Proxy fast and simple; do not use it for slow backend data fetching or as the sole authorization layer.
- Prefer `next.config.ts` redirects/rewrites for static routing rules where suitable.

Reference: [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

---

## 8. Routing and migration registry

Create/maintain a route matrix based on `route-registry.ts`, reconciled with `App.tsx`, sidebar/navigation, redirects, feature flags, and Express-side role requirements.

Each route record should include at least:

```json
{
  "path": "/example/path",
  "module": "customer",
  "legacySource": "frontend/src/pages/example.tsx",
  "nextPath": "src/app/(app)/example/page.tsx",
  "allowedRoles": ["reviewed-from-source"],
  "status": "legacy",
  "owner": "unassigned",
  "apiDependencies": [],
  "testStatus": "not-started",
  "notes": ""
}
```

The values above are illustrative, not actual route metadata. Do not invent roles or API dependencies; extract and verify them from the source.

Allowed migration statuses: `legacy`, `in-progress`, `ready-for-review`, `verified-on-staging`, `next`, and `exception` (or another small agreed enum). Every exception needs a reason, owner, and decision date. Do not mark a route `next` merely because its page renders; required tests and parity checks must pass.

Rules:

- Preserve paths and aliases where possible.
- Use explicit redirects for approved aliases.
- Dynamic route parameters must be validated and invalid IDs must show correct not-found/error behaviour.
- Use one reviewed route metadata source to reduce drift between navigation, migration tracking, and tests. Do not attempt automatic code generation until the registry format and tests are proven.

---

## 9. Shared UI and design-system standards

- Copy/port only the shared UI primitives, global CSS tokens, fonts, and Tailwind configuration needed by Next.js; adjust Tailwind content globs for `src/app`, `src/modules`, and `src/components`.
- Keep one authenticated shell with sidebar, topbar, breadcrumbs, and responsive/collapsed navigation.
- Define shared page templates: `ListPage`, `FormPage`, `ReportPage`, and `DashboardPage` only where they reduce duplication.
- Maintain consistent spacing, typography, table density, page headings, filters, empty/loading/error states, and responsive behaviour.
- Avoid a one-time wholesale redesign of every route. Establish the shared system in the pilot and migrate the UI incrementally.
- Verify keyboard navigation, visible focus states, form labels, accessible dialog behaviour, and usable mobile layouts for the pilot.

Deliverable: `docs/frontend-next/UI_GUIDELINES.md` with short, practical examples.

---

## 10. Developer ownership and parallel-work model

### Phase A — shared foundation

**Habib: technical owner and integration owner**

- Own initial architecture decisions, Next.js scaffold review, aliases, TypeScript/lint/build standards, API client conventions, auth integration, route registry approach, shell integration, CI gates, and deployment/cutover plan.
- Review shared-folder changes and resolve architecture questions.
- Do not become the sole author of every feature module; once the foundation is stable, module work must be parallelized.

**Talha: migration-audit and module-preparation partner**

- Audit assigned legacy routes and their page/component dependencies.
- Prepare route/API inventories, role and permission test cases, shared-component candidates, and known edge cases.
- Review the foundation from the perspective of implementing a separate module and raise missing conventions before module work starts.
- May implement an agreed pilot subtask only after the shared contract is stable.

### Phase B — after foundation and pilot acceptance

Suggested initial ownership, to be confirmed against actual expertise and workload:

| Habib — primary owner | Talha — primary owner |
|---|---|
| Dashboard | Customer |
| Reports | Lead |
| Accounts / Office Accounts | Service |
| DRM / Target (coordinate overlapping dependencies) | PMS |
| Architecture, shared integration, release coordination | Product Posting |

Remaining modules (Attendance/HR, Analytics, IT/Domain, Support, Training, Settings, Users, Notice, Social Media, Portfolio, Misc, Events, and Copilot) are assigned after the pilot based on capacity, dependency graph, and risk. This is a proposal, not a claim that either developer has already agreed to these assignments.

### Ownership rules

- Each module has one primary owner and one reviewer. A reviewer can be the other developer.
- Shared foundation folders (`lib/api`, `lib/auth`, `config/routes`, `components/layout`, `providers`) have a designated owner; changes require review from that owner.
- Module owners may change their own module folders independently, but must not silently edit shared contracts.
- Shared UI changes should be discussed before parallel implementation to avoid duplicate components.
- API/backend changes are not part of this assignment unless separately approved.
- Each module README records route list, API dependencies, auth/role assumptions, test instructions, and known parity differences.

---

## 11. Git, branch, and pull-request workflow

Keep the team's current branch policy where possible, but verify the actual branch names and protections before execution. The existing document references `fix/upgrade_frontend_habib`, `habib-dev`, and `production`; do not assume they are all current without checking the repository.

### Proposed workflow

1. Production remains on its current release branch and legacy frontend.
2. Create/confirm an integration branch for the Next migration (for example, `next-migration-dev` or the team's approved equivalent).
3. Create short-lived feature branches from that integration branch, for example:
   - `feature/next-foundation`
   - `feature/next-auth-shell`
   - `feature/next-dashboard-habib`
   - `feature/next-customer-talha`
4. Open a PR for each coherent unit of work; avoid one giant migration PR.
5. Require a passing lint/typecheck/build and relevant tests before merge.
6. Require a second-person review for shared foundation, auth, route access, API client, and deployment changes.
7. Rebase/merge the latest integration branch into active feature branches regularly; resolve conflicts in the feature branch, not directly on production.
8. Do not let both developers edit the same shared files without coordination.
9. Tag or otherwise identify known-good pilot and release commits so rollback is reproducible.
10. Keep `frontend/` and its deployment path unchanged until production cutover is approved.

### PR checklist

- [ ] Scope and affected routes are listed.
- [ ] No unapproved Express/API/database changes.
- [ ] No secrets or private environment values committed.
- [ ] TypeScript, lint, build, and relevant tests pass.
- [ ] Route path, role behaviour, loading/error/empty states checked.
- [ ] API requests use the shared API client convention.
- [ ] Cookie/session and 401/403 behaviour checked where relevant.
- [ ] Screenshots or short test notes attached for UI changes.
- [ ] Migration status and module README updated.
- [ ] Shared-file owner has reviewed shared foundation changes.

---

## 12. Migration phases and exit criteria

No phase proceeds until its exit criteria are met or an explicit exception is approved.

### Phase 0 — plan and alignment

**Deliverables**
- This reviewed migration plan.
- Verified route matrix and module list.
- Agreed exact Next.js 16 patch, Node.js runtime, package manager, and lockfile strategy.
- Confirmed branch workflow and module owners.

**Exit criteria**
- Express and database no-change boundary accepted.
- Pilot module and pilot roles selected.
- Staging environment and rollback owner identified.

### Phase 1 — scaffold and build baseline

**Goals:** establish a separate Next.js app without porting business pages.

**Tasks**
- Create `frontend-next/` with App Router, TypeScript, ESLint, and agreed CSS/Tailwind setup.
- Pin compatible Next.js 16.x and Node.js versions; commit lockfile.
- Configure `@/*` aliases and test the `@shared/*` path to `frontend/shared/`.
- Add `output: 'standalone'` in `next.config.ts` after validating deployment approach.
- Configure development rewrites/proxy paths for `/api` and required upload/static paths without changing production routing.
- Port only required CSS tokens and shared primitives.
- Add scripts and README for dev, lint, typecheck, build, and start.
- Add a health/ping page that verifies the approved backend connectivity path.

**Exit criteria**
- Clean install and reproducible build.
- Next.js runs locally on port 3000; Express remains on its existing port.
- API connectivity works for a non-sensitive health endpoint.
- No backend-only dependency is copied into the Next frontend without justification.
- Legacy Vite build and deploy path remain unchanged.

### Phase 2 — auth and API foundation

**Tasks**
- Port the shared query client behaviour, error envelope, 401 handling, and role utilities.
- Implement the browser API client; add a server API client only if the pilot needs server-side API reads.
- Implement login/logout/session bootstrap with existing `/api/auth/*` contracts.
- Establish safe cookie forwarding for server-side calls where needed.
- Define route-access helpers and a minimal `proxy.ts` only if required.
- Add providers for React Query, theme, tooltip, and toaster with minimal client boundaries.

**Exit criteria**
- Login, logout, session expiry, 401, 403, and refresh behaviour verified against Express.
- At least two representative roles tested against role-specific destinations and direct URLs.
- Express remains the authorization authority.
- No duplicated auth/session logic outside the agreed auth/API utilities without documented reason.

### Phase 3 — shared app shell and pilot

**Pilot:** authentication + shared shell + one representative dashboard/report or other approved business flow. Choose the pilot based on business value, risk, and representative complexity; do not assume the chosen module before the team confirms it.

**Tasks**
- Implement sidebar, topbar, breadcrumbs, responsive/collapsed behaviour, and page templates.
- Wire navigation from the reviewed route metadata and existing role/feature-flag rules.
- Port the selected pilot flow end-to-end, including API interactions, filters/forms, empty/loading/error states, and permissions.
- Compare the pilot against legacy on the same backend and test accounts.
- Record the SSR/CSR choice and data-cache behaviour for each pilot route.
- Create `docs/frontend-next/UI_GUIDELINES.md` and module README.

**Exit criteria**
- Pilot build passes and has no critical console/runtime errors.
- Functional parity is verified for the pilot's critical path.
- Two or more relevant roles tested, including unauthorized direct URL/API attempts.
- No sensitive user-specific response is incorrectly shared/cached.
- Team accepts the folder/API/SSR conventions before parallel module migration begins.

### Phase 4 — Wave 1: Dashboard

Migrate dashboard and role-home routes first, including associated dashboard widgets. Keep the route inventory and role-home mapping synchronized.

**Exit criteria:** all approved dashboard routes work on Next; spot-check at least five representative roles or all roles if fewer; dashboard APIs load correctly; no unreviewed raw fetch calls in screens.

### Phase 5 — Wave 2: Customer and Lead

Migrate customer management, pools, tracing, invoice pool, quotations, and lead/GMBV pool flows according to the verified route matrix. Add correct dynamic `[id]`/`[customerId]` routes and invalid-ID handling.

**Exit criteria:** customer/lead routes and role behaviour verified; invalid IDs and empty states tested; critical create/update/view flows pass.

### Phase 6 — Wave 3: Reports

Migrate report families incrementally. Use module subfolders where helpful. Lazy-load heavy charts, PDF, and spreadsheet/export libraries. Preserve filters, date handling, export/print and permissions.

**Exit criteria:** all approved report paths work; smoke-test at least three representative heavy reports or all if fewer; compare calculations and exported output with legacy.

### Phase 7 — Wave 4: Service, PMS, Product Posting

Migrate service pools/executive flows, PMS workspace/task flows, and product posting. Port list/detail paths incrementally and document high-risk business workflows.

**Exit criteria:** end-to-end service executive flow verified; PMS task flow tested; product-posting uploads/assets and error states checked where applicable.

### Phase 8 — Wave 5: Accounts, Office Accounts, DRM/DD, Target, Events

Migrate financial and DRM-related routes with particular attention to validation, calculations, and access boundaries. Reuse existing shared validators where compatible. Do not change database schema or backend business rules.

**Exit criteria:** representative account posting and DRM flows match legacy; financial calculations and validation tested; relevant role permissions verified.

### Phase 9 — Wave 6: remaining modules

Includes Attendance/HR, Analytics, IT/Domain, Support, Training, Settings, Users, Notice, Social Media, Portfolio, Misc, and other verified modules. Port admin/super-admin routes under the agreed module convention. Document intentionally inactive/feature-flagged routes.

**Exit criteria:** every route is `verified-on-staging`, `next`, or an explicitly approved `exception`; full click-through checklist signed off.

### Phase 10 — Copilot and cross-cutting features

Port assistant/coplanar UI, screen context, tickets, complaint box, promotion banner, quotations widget, and related shared widgets. Keep the existing backend API and role boundaries.

**Exit criteria:** critical assistant/session/message flow works; assistant respects the same permissions and data access rules; parity comparison passes.

### Phase 11 — staging rehearsal and production cutover

**Tasks**
- Build standalone output and run the exact production start command under the intended Node.js runtime.
- Configure Nginx to route frontend requests to Next and `/api` to the existing Express backend, preserving all current API/static/upload paths.
- Verify cookie domain/path, TLS, request size limits, timeouts, caching headers, logs, health checks, and process restart behaviour.
- Rehearse cutover and rollback in staging using production-like configuration and representative test accounts.
- Prepare deployment notes, owner/contact, go/no-go checklist, and rollback commands/config.
- Switch production only after explicit sign-off.

**Exit criteria**
- Smoke tests pass on the staged production topology.
- Critical user flows and role access pass.
- Error rate and latency are not materially worse than the agreed baseline.
- Rollback to the legacy Vite build is tested and can be completed within the agreed recovery objective.
- Monitoring owner and first 24-hour observation window are assigned.

### Phase 12 — legacy decommission

Only after the agreed rollback window (proposed: 30 days after stable cutover) and sign-off:
- Archive or remove the old frontend only after confirming rollback is no longer required.
- Remove obsolete deployment/docs references carefully.
- Make Next the default frontend CI/build path.

**Exit criteria:** production stability accepted, no required dependency on legacy assets/deploy scripts remains, and archive/removal is approved.

---

## 13. Quality gates and testing strategy

### Automated checks

- Clean dependency install using the committed lockfile.
- ESLint.
- TypeScript `tsc --noEmit` or equivalent configured check.
- Production `next build`.
- Unit tests for API error handling, route-access helpers, formatting, and important utilities.
- React Testing Library tests for representative interactive components.
- Browser-based end-to-end tests for login/logout, role dashboard, critical module flows, and session expiry where test infrastructure permits.
- Dependency/security checks in CI if available.

### Manual parity checklist for every route

- [ ] URL/path and aliases match approved route matrix.
- [ ] Role access matches legacy and backend authorization.
- [ ] API requests, payloads, and response handling match existing contract.
- [ ] Loading, error, empty, validation, and not-found states exist.
- [ ] Forms, tables, filters, pagination, sorting, exports, uploads, and dialogs work as applicable.
- [ ] Session cookies, logout, 401/403 and refresh behaviour are verified as applicable.
- [ ] User-specific data is not cached/shared across users or roles.
- [ ] Responsive layout and keyboard/accessibility basics checked.
- [ ] Side-by-side comparison against legacy completed on the same backend.
- [ ] Route tracker, module README, and test evidence updated.

### Performance baseline

Before the pilot is accepted, record representative legacy baseline measurements (route load/interaction, API latency where observable, bundle size, browser errors). Compare Next results using the same environment and test data. Avoid setting arbitrary performance targets before measuring the existing baseline; agree thresholds during the pilot.

---

## 14. Security, environment, and operations

- Validate required environment variables at startup/build as appropriate; keep secrets server-only.
- Never commit `.env` files, credentials, session cookies, access tokens, or production dumps.
- Only expose deliberately public values using `NEXT_PUBLIC_*`; these are bundled into browser code at build time.
- Use `next.config.ts` rewrites only for approved paths. Avoid accidental exposure of internal backend endpoints.
- Ensure Nginx is the public reverse proxy; do not expose the Node process directly unless the infrastructure explicitly requires it.
- Set request body size limits and timeouts intentionally for uploads and large report/export routes.
- Ensure health/logging does not leak sensitive data; never log session cookies or authorization headers.
- Confirm upload, download, image, and static-file paths still work after cutover.
- Avoid broad caching of authenticated pages/API responses. Verify cache headers in staging.
- Document process supervision/restart, log location, disk usage, health checks, and deployment rollback.

References: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Next.js deployment options](https://nextjs.org/docs/app/getting-started/deploying).

---

## 15. Deployment design and rollback

### Proposed production topology

- Nginx terminates HTTPS and routes frontend page requests to the Next.js standalone Node.js server on a private/local port.
- Existing `/api/*` requests continue to reach the current Express service using the established route configuration.
- Preserve any existing upload/media/static paths and special API prefixes after inventory and staging verification.
- Run the Next process with the repository's agreed process manager/service configuration and controlled environment variables.
- Use a release directory or versioned artifact strategy so the currently deployed frontend can be restored without rebuilding under pressure.

### Standalone output

Configure `output: 'standalone'` and validate the generated output, runtime dependencies, static assets, and public assets in a staging environment. Standalone output does not remove the need to test the exact server startup command and file layout.

### Rollback safeguards

1. Keep the last known-good Vite build and Nginx config available.
2. Back up the active Nginx configuration before cutover.
3. Document the exact switch-back command/config and test it in staging.
4. Do not delete legacy assets or alter the database during cutover.
5. Define rollback triggers before release (for example, critical auth failure, role/data leak, repeated 5xx errors, broken critical business flow, or unacceptable latency).
6. Assign one person to make the go/no-go and rollback decision.
7. Observe critical flows and logs closely for the first 24 hours; keep the legacy fallback during the agreed stabilization period.

---

## 16. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Missing or altered URL | Reconcile registry, `App.tsx`, sidebar, aliases and backend guards; test every registered path |
| Cookie/session failures | Verify production cookie settings and Nginx topology in staging; test login/logout/expiry |
| Incorrect SSR/server API call | Separate browser/server API clients; explicitly forward only required cookies to trusted Express origin |
| Sensitive response cached/shared | Default to safe authenticated-data caching; verify response headers and cross-user tests |
| Permission drift | Express remains authoritative; direct URL and direct API role tests |
| Next.js 16 dependency/runtime incompatibility | Check Node.js >= 20.9, TypeScript >= 5.1, package support, build and lockfile before porting |
| Parallel merge conflicts | Module owners, shared-file owner, short-lived branches, PR review, regular integration sync |
| Shared code imported into browser accidentally | Audit `frontend/shared/` for server-only code; verify aliases/build and client bundle boundaries |
| Large report bundles | Dynamic imports and report-family migration; measure bundle and export behaviour |
| Double maintenance | Route migration tracker; freeze/mark migrated legacy pages only after parity and release policy allows |
| Production outage | Staging rehearsal, known-good Vite artifact, tested Nginx rollback, explicit go/no-go owner |
| Scope creep | Pilot first, shared templates, module-by-module acceptance, separately track backend fixes |

---

## 17. Indicative sequencing and timeline

The old estimate is directional only; a reliable schedule depends on the pilot outcome, route complexity, test coverage, and actual developer capacity.

| Stage | Indicative focus |
|---|---|
| Plan and audit | Confirm route matrix, runtime, ownership, pilot, and staging access |
| Scaffold + API/auth | Reproducible Next app, API client, session/role behaviour |
| Shared shell + pilot | Prove folder, rendering, UI, testing, and integration conventions |
| Parallel waves | Habib and Talha migrate separately owned modules after pilot sign-off |
| Stabilization | Parity, regression, performance, security, and deployment rehearsal |
| Cutover | Approved production switch and 24-hour close monitoring |
| Legacy retirement | After agreed stable window and explicit approval |

Do not commit to the previous 8–14 week range until the pilot establishes an observed throughput per module. Update the schedule after the pilot with route counts, complexity, test burden, and cross-module dependencies.

---

## 18. Immediate next steps after approval

1. Review and approve this document; no implementation before approval.
2. Verify current branch names, Node.js version, package manager, server topology, and the real route inventory.
3. Reconcile route registry, `App.tsx`, sidebar links, aliases, feature flags, and Express role guards into one route matrix.
4. Choose the exact pilot module and representative test roles.
5. Confirm Habib/Talha module allocation and shared-folder ownership.
6. Confirm staging environment, production-like Nginx/API routing, and rollback owner.
7. Approve Phase 1 only after these prerequisites are recorded.

### Approval checklist

- [ ] Next.js 16.x exact patch and runtime compatibility verified.
- [ ] Express API and database no-change boundary accepted.
- [ ] Route matrix and role/access source reconciled.
- [ ] Pilot module, pilot roles, and acceptance criteria agreed.
- [ ] Habib/Talha ownership and reviewer assignments agreed.
- [ ] Branch and PR workflow agreed.
- [ ] Staging and rollback approach verified.
- [ ] No production cutover before full parity and explicit sign-off.

---

## 19. Reference documentation

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [App Router documentation](https://nextjs.org/docs/app)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Self-hosting Next.js](https://nextjs.org/docs/app/guides/self-hosting)
- [Deployment options](https://nextjs.org/docs/app/getting-started/deploying)

---

**Final status:** Ready for team review. This document does not authorize implementation, production changes, database changes, or cutover.
