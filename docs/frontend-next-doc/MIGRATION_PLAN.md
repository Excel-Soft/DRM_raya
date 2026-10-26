# DRM WebExcels — Frontend Next.js Migration Plan

**Target folder:** `frontend-next/`  
**Legacy (unchanged until cutover):** `frontend/` (Vite + React + wouter)  
**Working branch:** `fix/upgrade_frontend_habib`  
**Backend:** `backend/` (Express API — **no rewrite**; Next app is a client + optional middleware only)  
**Authoritative route inventory:** `frontend/src/routes/route-registry.ts` (~195 registered paths)

---

## 1. Purpose

Move the DRM UI to **Next.js (App Router)** with a **module-first folder structure** so that:

- Production keeps running on Vite until we deliberately cut over.
- Each business area lives in its **own module folder** (easy to find, debug, and test).
- URL paths and permissions stay aligned with today’s app (`route-registry`, backend guards).
- UI quality improves via **one shared app shell**, page templates, and consistent layout — not by rewriting backend logic.

---

## 2. Current frontend audit (as of branch sync with production)

### 2.1 Stack

| Layer | Current |
|--------|---------|
| Build | Vite 5 → `frontend/dist/public` |
| UI | React 18, TypeScript (`.tsx`), Tailwind, shadcn/Radix |
| Routing | **wouter** — routes declared in `App.tsx` (~**190** `lazy()` imports) |
| Data | TanStack React Query — `lib/queryClient.ts` (`credentials: "include"`, `/api/*`) |
| Auth | Cookie/session via `/api/auth/*`; client guard `hooks/useRouteProtection.ts` |
| Deploy | `frontend/deploy.sh` — production branch, `vite build`, nginx serves static |

### 2.2 Size & shape

| Metric | Count / note |
|--------|----------------|
| Page files | ~**203** under `frontend/src/pages/` |
| Route registry entries | **195** across **24** logical modules |
| `src/lib/` | 11 files (API helpers, flags, roles, exports) |
| `src/hooks/` | 6 hooks |
| `src/contexts/` | 2 (assistant, screen) |
| `components/` | Many at **root** of `components/`; subfolders: `ui`, `copilot`, `gm`, `invoice`, `report`, `communication`, `examples` |
| Shared with backend | `frontend/shared/` (schema, validators, constants) — keep importing via alias in Next |

### 2.3 Routes by module (migration waves)

| Module | Routes | Suggested wave |
|--------|--------|----------------|
| Reports | 28 | Wave 3 |
| Dashboard | 25 | Wave 1 (shell + role homes) |
| DRM/DD | 20 | Wave 5 |
| Customer | 19 | Wave 2 |
| Service | 17 | Wave 4 |
| PMS | 13 | Wave 4 |
| Product Posting | 12 | Wave 4 |
| Office Accounts | 9 | Wave 5 |
| Accounts | 8 | Wave 5 |
| Target System | 6 | Wave 5 |
| Attendance/HR | 5 | Wave 6 |
| Analytics | 5 | Wave 6 |
| IT/Domain | 4 | Wave 6 |
| Support, Settings, Users, Events, … | remainder | Wave 6 |

### 2.4 Pain points (why UI feels “flat”)

1. **`App.tsx` is a monolith** — all routing and providers in one file; hard to navigate while debugging.
2. **Pages are mostly flat files** — only `pages/drm`, `pages/sales`, `pages/admin`; little co-location of module-specific components.
3. **Cross-cutting widgets** (tickets, copilot, sidebars) mixed with domain components at `components/` root.
4. **`frontend/package.json` lists server deps** (Express, Drizzle, etc.) — legacy noise; **`frontend-next` must not copy this**; only browser-safe dependencies.
5. **Three sources of truth for navigation/access** — `App.tsx`, `app-sidebar.tsx`, `useRouteProtection.ts`, plus `route-registry.ts` (documented as non-authoritative but essential for audits).

### 2.5 What we keep unchanged during migration

- All **API contracts** and backend route guards.
- **URL paths** where possible (users bookmarks, docs, nginx rules).
- **Session cookies** — same `fetch(..., { credentials: "include" })` pattern.
- **Legacy `frontend/`** build and `deploy.sh` until Phase 9 sign-off.

---

## 3. Target architecture — `frontend-next/`

### 3.1 Principles

1. **Feature modules first** — business code lives under `src/modules/<name>/`, not loose in `pages/`.
2. **App Router = URLs only** — thin `app/**/page.tsx` files re-export or compose module screens.
3. **One HTTP layer** — `src/lib/api/client.ts` + per-module `*.api.ts` files (no raw `fetch` scattered in pages).
4. **Registry-driven** — port `route-registry` to `src/config/routes/` and generate sidebar + middleware rules from it over time.
5. **Debuggability** — each module contains `README.md` (optional) listing routes, main API endpoints, and known quirks.
6. **Client-heavy app** — default `'use client'` for screens; use Server Components only where they clearly help (layouts, static shells).

### 3.2 Proposed folder tree

```text
frontend-next/
├── app/
│   ├── layout.tsx                 # root: fonts, theme, providers
│   ├── (public)/
│   │   └── auth/
│   │       └── page.tsx
│   └── (app)/                     # authenticated shell
│       ├── layout.tsx             # sidebar + topbar + breadcrumbs
│       ├── page.tsx               # role-aware home redirect
│       ├── dashboard/[...slug]/page.tsx
│       ├── reports/...
│       ├── sales/...
│       └── ...                    # mirrors URL paths from registry
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── api/
│   │   │   ├── screens/
│   │   │   └── index.ts
│   │   ├── dashboard/
│   │   ├── customer/
│   │   ├── reports/
│   │   ├── service/
│   │   ├── pms/
│   │   ├── accounts/
│   │   ├── drm/
│   │   ├── events/
│   │   ├── copilot/
│   │   └── ...                    # one folder per RouteModule
│   ├── components/
│   │   ├── ui/                    # shadcn (copied once from legacy)
│   │   └── layout/                # shell-only pieces
│   ├── lib/
│   │   ├── api/                   # client, errors, queryClient
│   │   ├── auth/
│   │   └── utils/
│   ├── config/
│   │   ├── routes/                # registry, role dashboards, redirects
│   │   ├── feature-flags.ts
│   │   └── env.ts
│   ├── providers/                 # QueryClient, Theme, Assistant, etc.
│   └── types/
├── public/
├── next.config.ts                 # rewrites: /api → backend
├── tailwind.config.ts
├── tsconfig.json                  # paths: @/*, @shared/*
└── package.json                   # browser-only deps
```

### 3.3 Module internal convention (repeat for every module)

```text
modules/reports/
├── api/              # reports.api.ts — all /api/reports/* calls
├── components/       # reports-only UI
├── hooks/            # useReportFilters, etc.
├── screens/          # large page bodies (ReportDayTargetScreen.tsx)
├── utils/            # formatters specific to reports
├── constants.ts
└── index.ts          # public exports for app routes
```

**Debugging rule:** If a Reports bug is reported, open `src/modules/reports/` only — no hunting across 200 root-level pages.

### 3.4 Path & alias mapping

| Legacy | Next |
|--------|------|
| `@/` → `frontend/src` | `@/` → `frontend-next/src` |
| `@shared/` | `@shared/` → `frontend/shared` or `../frontend/shared` (monorepo path in tsconfig) |
| wouter `useLocation` | `next/navigation` (`usePathname`, `useRouter`) |
| Vite proxy `/api` | `next.config` `rewrites()` to `http://localhost:5001` in dev |

### 3.5 Dev workflow (both frontends in parallel)

```text
Terminal 1: backend (port 5001)
Terminal 2: legacy frontend — optional reference (port 5173)
Terminal 3: frontend-next (port 3000)
```

No change to team git flow: commits on `fix/upgrade_frontend_habib` until PR to `habib-dev` / `production` when ready.

---

## 4. Migration phases (read → approve → execute)

Each phase has **Deliverables**, **Exit criteria**, and **Risk**. Do not start the next phase until exit criteria are met.

---

### Phase 0 — Plan & alignment (this document)

**Deliverables**

- [x] Audit of legacy `frontend/`
- [x] Module list aligned with `route-registry` `RouteModule` enum
- [ ] Your review: confirm module names, wave order, and cutover appetite

**Exit criteria**

- Team agrees: **parallel `frontend-next/`**, no in-place Vite replacement.
- Priority modules for first user-facing pilot (default: **Auth + Dashboard + 1 report**).

---

### Phase 1 — Scaffold `frontend-next`

**Goals:** Empty Next app that builds, lints, and talks to backend.

**Tasks**

1. `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `src/` dir).
2. Configure `@/*`, `@shared/*`, strict TypeScript.
3. `next.config.ts`: dev rewrites for `/api` and `/uploads`.
4. Copy **only** `components/ui`, `index.css` tokens, and `tailwind` config from legacy (adjust content paths).
5. Add scripts in root or README: `dev:next`, document env vars.
6. **Do not** copy `pages/` or `App.tsx` yet.

**Deliverables**

- `frontend-next/` builds with `npm run build`
- Health page at `(app)/` or `/health` showing API ping

**Exit criteria**

- `curl http://localhost:3000/api/...` proxies to backend in dev
- Zero dependency on Express/Drizzle in `frontend-next/package.json`

---

### Phase 2 — Core platform (auth, API, providers)

**Goals:** Shared foundation every module will use.

**Tasks**

1. Port `lib/queryClient.ts` → `src/lib/api/query-client.ts` (401 handling, error envelope).
2. Port `lib/role-utils.ts`, session helpers.
3. Auth module: login/signup/forgot flows from `pages/auth.tsx` → `modules/auth/screens/`.
4. `AuthProvider` + `/api/auth/me` bootstrap (same as legacy top-level flow).
5. Next **middleware**: redirect unauthenticated users from `(app)/*` → `/auth` (mirror legacy behavior).
6. Port `useRouteProtection` logic → `src/lib/auth/route-access.ts` + hook for client-side redirects.
7. Root providers: QueryClient, Theme, Tooltip, Toaster (match legacy stack).

**Deliverables**

- Working login → lands on role dashboard URL
- Logout and 401 redirect to `/auth`

**Exit criteria**

- Manual test: 2 roles with different `ROLE_DASHBOARDS` paths
- No duplicate fetch/auth logic outside `modules/auth` and `lib/api`

---

### Phase 3 — App shell & design system

**Goals:** Fix the “UI feel” with one consistent layout before migrating 200 pages.

**Tasks**

1. Port `app-sidebar.tsx`, `top-bar.tsx` → `components/layout/` (split into smaller files).
2. Breadcrumbs from registry (`getBreadcrumbsForPath`) → `modules/navigation/`.
3. Define **page templates**: `ListPage`, `ReportPage`, `FormPage`, `DashboardPage` in `components/layout/templates/`.
4. Wire sidebar menu from `route-registry` (filter by role + feature flags).
5. Port global widgets that attach to shell: ticket popups, AI button (stub if copilot not ready).
6. Document spacing, typography, and card patterns in `docs/frontend-next/UI_GUIDELINES.md` (short).

**Deliverables**

- Authenticated shell with sidebar + topbar on a **placeholder** home page
- One example page using each template (Storybook optional later)

**Exit criteria**

- Sidebar groups match legacy groups for a test admin user
- Mobile / collapse behavior acceptable (port `use-mobile`)

---

### Phase 4 — Wave 1: Dashboard module

**Goals:** ~25 dashboard routes live on Next.

**Tasks**

1. Create `modules/dashboard/screens/*` — one screen file per legacy `*-dashboard.tsx` where feasible.
2. Map URLs under `app/(app)/dashboard/**` and related (`/product-posting`, `/qa`, `/verification`).
3. Shared dashboard widgets → `modules/dashboard/components/`.
4. Mark each route in `config/routes/migration-status.json`: `{ path, status: "next" | "legacy" }`.

**Deliverables**

- All registry **Dashboard** + role entry URLs working on port 3000

**Exit criteria**

- Spot-check 5 roles against legacy behavior (widgets load, APIs 200)
- No new raw `fetch` in screen files — only `modules/dashboard/api`

---

### Phase 5 — Wave 2: Customer + Lead

**Registry:** Customer (19) + Lead (2) routes.

**Tasks**

1. `modules/customer/` — management, pools, tracing, invoice pool, quotation, etc.
2. `modules/lead/` — lead pools, GMBV pool.
3. Dynamic routes: `[id]`, `[customerId]` with loading/error UI.
4. Port shared customer components (`FollowCustomerServicesPanel`, GM dialogs) into module or `modules/customer/components`.

**Exit criteria**

- Sidebar “Customer” and “Lead” groups fully on Next
- Dynamic routes tested with invalid id (not-found)

---

### Phase 6 — Wave 3: Reports

**Registry:** 28 routes — largest single module.

**Tasks**

1. `modules/reports/` with subfolders per report family if needed (`day-target`, `diagnose`, `event`, …).
2. Port `lib/reportApi.ts` → `modules/reports/api/`.
3. Heavy pages (charts, export) — use dynamic import for `recharts`, `jspdf`, `xlsx` as legacy does.
4. Standardize filters toolbar via `ReportPage` template.

**Exit criteria**

- All `/reports/*` paths on Next
- Export/print flows smoke-tested on 3 heaviest reports

---

### Phase 7 — Wave 4: Service, PMS, Product Posting

**Registry:** Service (17), PMS (13), Product Posting (12).

**Tasks**

1. Three modules with clear API boundaries.
2. Service pool / private pool / executive flows — high regression risk; add module README with flow diagrams.
3. PMS team workspace and task flows — port incrementally (list before detail).

**Exit criteria**

- Sidebar groups Service, PMS, Product Posting marked `next` in migration status
- Service executive smoke path end-to-end

---

### Phase 8 — Wave 5: Accounts, Office Accounts, DRM/DD, Target, Events

**Registry:** Accounts (8), Office Accounts (9), DRM/DD (20), Target (6), Events (3).

**Tasks**

1. `modules/accounts/`, `modules/office-accounts/`, `modules/drm/`, `modules/target/`, `modules/events/`.
2. Financial forms — strict validation port from legacy + shared validators from `@shared`.
3. Events menu (large file in legacy) — split into sub-screens inside module.

**Exit criteria**

- GM/dollar/increment/penalty routes reachable (DRM)
- At least one account posting flow verified against legacy

---

### Phase 9 — Wave 6: Remaining modules

**Includes:** Attendance/HR, Analytics, IT/Domain, Support, Training, Settings, Users, Notice, Social Media, Portfolio, Misc.

**Tasks**

1. One module folder per remaining `RouteModule`.
2. Feature-flagged inactive pages (`support-inactive`, etc.) — port `lib/feature-flags.ts`.
3. Admin/super-admin routes under `modules/admin/`.

**Exit criteria**

- `migration-status.json`: 100% paths `"next"` OR explicit exceptions documented
- Full click-through checklist (spreadsheet) signed off

---

### Phase 10 — Copilot & cross-cutting features

**Goals:** Parity with production copilot and assistant UX.

**Tasks**

1. `modules/copilot/` — port `copilot-api.ts`, `copilot-panel.tsx`, `assistant-context`, `screen-context`.
2. Ensure assistant respects same auth and role boundaries.
3. Port remaining root-level widgets (complaint box, promotion banner, quotations widget).

**Exit criteria**

- Copilot panel opens, session/create/message flow works against backend
- No regression on legacy copilot behavior (compare staging)

---

### Phase 11 — Production cutover

**Goals:** Serve Next app to users; retire Vite deploy path.

**Tasks**

1. Add `frontend-next/deploy.sh` (or extend monorepo deploy): `next build` + static export **or** Node standalone behind nginx — **decision required**:
   - **Option A:** `output: 'standalone'` + reverse proxy (recommended for middleware).
   - **Option B:** static export if middleware constraints acceptable.
2. Nginx: point `app.excels.com.pk` to Next output; keep `/api` proxied to backend.
3. Staging rehearsal on `habib-dev` or staging branch.
4. Rollback plan: nginx snippet to flip back to `frontend/dist/public` within minutes.

**Exit criteria**

- Production health check passes
- 24h monitoring — error rate not worse than baseline

---

### Phase 12 — Legacy decommission

**Tasks**

1. Archive `frontend/` → rename to `frontend-legacy/` or delete after 30-day window.
2. Remove duplicate deps from docs; single README entry point.
3. Optional: CI job only builds `frontend-next`.

**Exit criteria**

- No reference to Vite in deploy scripts
- Team default dev command is Next-only

---

## 5. Per-page migration checklist (use for every route)

When moving one route from `frontend/src/pages/...` to Next:

- [ ] Path matches `route-registry` (including aliases → `redirect()` in Next)
- [ ] `allowedRoles` / middleware / client guard aligned
- [ ] API calls moved to `modules/<x>/api/`
- [ ] Screen uses a layout template (not one-off padding)
- [ ] Loading + error + empty states
- [ ] `migration-status.json` updated
- [ ] Compare side-by-side with legacy on same backend (3000 vs 5173)

---

## 6. Quality & optimization standards

| Area | Rule |
|------|------|
| Bundle size | Dynamic `import()` for charts, PDF, xlsx (same as legacy `App.tsx` lazy strategy) |
| Data fetching | React Query keys namespaced: `['reports', 'day-target', filters]` |
| Forms | react-hook-form + zod; shared schemas from `@shared` where possible |
| Styling | Tailwind + shadcn; no inline style except dynamic values |
| Files | Prefer **&lt; 400 lines** per screen; extract components when exceeded |
| Naming | `*.screen.tsx` for route bodies, `*.api.ts` for HTTP, `use-*.ts` for hooks |
| Tests | Phase 2+: add Vitest/RTL for `lib/api` and auth; module tests as you touch code |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| URL mismatch breaks bookmarks | Registry-first; redirects for aliases |
| Auth cookie domain/path issues | Same site, nginx `/api` proxy; test staging first |
| Double maintenance | Migration status file; freeze legacy pages once ported |
| Huge reports bundle | Code-split per report screen |
| Permission drift | Single `route-access.ts`; generate tests from registry later |
| Scope creep (“redesign everything”) | Templates + shell first; visual refresh inside modules incrementally |

---

## 8. Suggested timeline (indicative)

| Phase | Duration (focus) |
|-------|------------------|
| 1–2 | 1–2 weeks — scaffold + auth |
| 3 | 1 week — shell + templates |
| 4 | 1–2 weeks — dashboards |
| 5–6 | 2–4 weeks — customer + reports |
| 7–9 | 4–8 weeks — remaining modules (parallel devs possible) |
| 10–12 | 1–2 weeks — copilot + deploy + cleanup |

Adjust based on team size; modules can be parallelized after Phase 3.

---

## 9. Immediate next steps (after you approve this plan)

1. Confirm **Phase 1** start and Next.js version (recommend **15.x**, App Router).
2. Confirm cutover style: **standalone Node** vs static export.
3. Pick **pilot users** for first Next-only week (internal QA).
4. Execute Phase 1 on `fix/upgrade_frontend_habib` — no changes to `frontend/deploy.sh` yet.

---

## 10. Reference files (legacy)

| Concern | Path |
|---------|------|
| Routes / modules | `frontend/src/routes/route-registry.ts` |
| Route wiring | `frontend/src/App.tsx` |
| Client auth guard | `frontend/src/hooks/useRouteProtection.ts` |
| API client | `frontend/src/lib/queryClient.ts` |
| Sidebar | `frontend/src/components/app-sidebar.tsx` |
| Deploy | `frontend/deploy.sh` |
| Vite proxy | `frontend/vite.config.ts` |

---

*Document version: 1.0 — generated for review before any `frontend-next/` code is written.*
