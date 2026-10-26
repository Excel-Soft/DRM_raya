# Phase 6 — Shared UI Foundation and Component Architecture

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Scope:** `frontend-next/` only · **Date:** 2026-10-15  
**Status:** Implementation complete pending Habib review (not deployment / broad migration ready)

---

## 1. Dependency audit and design decisions

### Runtime dependencies (unchanged)

| Package | Present | Notes |
|---------|---------|--------|
| `next`, `react`, `react-dom` | Yes | App shell, pilots |
| `zod` | Yes | Auth/login validation only today |
| shadcn / Radix | **No** | Deferred; legacy Vite has components — bulk port not justified in Phase 6 |
| `@tanstack/react-query` | **No** | **Deferred** (see data-fetching below) |
| react-hook-form | **No** | Login uses controlled fields + zod; add when write-heavy modules migrate |
| Toast library | **No** | `FormBanner` + inline `PageError` until cross-route notifications are required |

### Styling stack

- **Tailwind CSS v4** with `@theme inline` in `src/app/globals.css` (added `--color-brand`, `--color-brand-muted`).
- **PostCSS** only when `TAILWIND_POSTCSS=1` (production webpack build); Turbopack dev unchanged from Phase 4.3.
- **Design tokens:** `src/styles/tokens.ts` — shared focus ring, input/label/validation class recipes (emerald + zinc).

### Data-fetching decision

**React Query not added.** Rationale:

- Only two read-only pilots; no shared cache invalidation or optimistic writes yet.
- `apiFetch` already centralizes auth headers, cookies, and `ApiError` / 403 handling.

**Alternative (adopted):** `useApiResource` (`src/lib/hooks/use-api-resource.ts`) — minimal read hook with `refetch()`, 403 → `forbidden`, all traffic through `apiFetch`. Demonstrated on **Notice Board** only. **Audit Logs** keeps explicit `useCallback` + `useEffect` because query string depends on applied filters + server `page` (clearer than encoding full URL in the hook for this phase).

### Component inventory (Phase 6)

| Area | Components |
|------|------------|
| Actions | `Button` (variants/sizes) |
| Forms | `Input`, `Textarea`, `Select`, `Label`, `Field`, `FormError`, `SubmitButton`, `FormBanner` |
| Layout | `Card`, `CardHeader`, `PageHeader`, `ContentContainer`, `Separator` |
| Data display | `Badge`, `DataTable`, `PaginationBar` |
| Feedback | `PageLoading`, `PageEmpty`, `PageError`, `PageForbidden`, `ConfirmDialog` (native `<dialog>`) |
| Utilities | `cn`, `lib/pagination.ts` |

Gap list (intentionally deferred): icon-button variant, breadcrumbs component, global toast host, shadcn port, client-side sortable columns (no API contract), React Query provider.

---

## 2. Reusable components created or improved

**New:** `button`, `input`, `textarea`, `select`, `label`, `field`, `card`, `badge`, `separator`, `page-header`, `content-container`, `data-table`, `pagination-bar`, `confirm-dialog`, `form-feedback`, `styles/tokens.ts`, `lib/pagination.ts`, `lib/hooks/use-api-resource.ts`.

**Improved:** `page-states.tsx` (dark mode, `role`/`aria-live`, retry via `Button`).

**Documented:** `src/components/ui/README.md`.

---

## 3. Files changed

### New

- `src/styles/tokens.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/field.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/page-header.tsx`
- `src/components/ui/content-container.tsx`
- `src/components/ui/data-table.tsx`
- `src/components/ui/pagination-bar.tsx`
- `src/components/ui/confirm-dialog.tsx`
- `src/components/ui/form-feedback.tsx`
- `src/lib/pagination.ts`
- `src/lib/pagination.test.ts`
- `src/lib/hooks/use-api-resource.ts`
- `docs/PHASE6_STATUS.md`

### Modified

- `src/components/ui/page-states.tsx`
- `src/components/ui/README.md`
- `src/modules/notice-board/notice-board-pilot.tsx`
- `src/modules/audit-logs/audit-logs-view.tsx`
- `src/app/globals.css`
- `package.json` (unit test script includes pagination tests)

### Regenerated (validation run; not required for UI — may differ by `generatedAt` only)

- `docs/route-matrix/route-matrix.json`
- `docs/route-matrix/route-matrix.csv`
- `src/config/routes/migration-routes.json`

**Not modified:** Express routes, DB, legacy `frontend/`, auth behavior, route exclusions (`/approvals`, `/sales/active-clients`).

---

## 4. Test commands and results

Run from `frontend-next/`:

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 13 unit + 14 route-access + 7 route-access-policy |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** (0 errors; pre-existing warning in `postcss.config.mjs`) |
| `npm run build` | **Pass** — routes: `/`, `/auth`, `/notice-board`, `/admin/audit-logs`, `/api-health` |
| `npm run build:standalone` | **Pass** — `.next/static` copied to `.next/standalone/.next/static`, `public` copied |
| `node frontend-next/scripts/build-route-matrix.mjs` (repo root) | **Pass** — 207 routes, artifacts written |

**New unit coverage:** `src/lib/pagination.test.ts` (clamp, total pages, summary text).

**E2E:** Not re-run in this phase session. Phase 5 still applies: authenticated sign-off requires `E2E_EMAIL` / `E2E_PASSWORD` (optional restricted user for audit 403 test).

---

## 5. Accessibility and responsive checks

**Code-level (not live browser audit):**

- Focus visible rings on `Button`, `Input`, `Textarea`, `Select`, `ConfirmDialog`.
- Filter inputs on Audit Logs use `aria-label`; table uses `<caption class="sr-only">`, `<th scope="col">`.
- Loading state uses `role="status"` / `aria-live="polite"`; errors/forbidden use `role="alert"`.
- Pagination: `nav` + `aria-label="Pagination"`, Previous/Next `aria-label`, page summary `aria-live="polite"`.
- `Field` wires `aria-describedby` for hint/error.

**Responsive:**

- Audit filter grid: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-4`.
- `DataTable` wrapper: `overflow-x-auto` (Audit Logs retains `min-w-[720px]` table width).

**Not executed:** Manual keyboard walkthrough or Playwright a11y scan in this session.

---

## 6. Impact on existing pilot pages

### Notice Board

- Uses `useApiResource`, `PageHeader`, `Card`, `DataTable`, shared page states.
- Still **read-only**; same `GET /api/notice-board` via `apiFetch`.
- UI copy: removed inline API/route-access documentation strings; product-facing description only.
- Presentation: list → responsive table (same data fields).

### Audit Logs

- Uses `PageHeader`, `Badge`, `Card`, `Input`, `Button`, `DataTable`, `PaginationBar`, `PageForbidden`.
- Unchanged: filter apply/reset, `page` + `pageSize=50`, Express `total`, 403 handling, role restrictions (client guard + Express authority).
- UI copy: shortened admin description (no `requireRole` code block in page body).
- Pagination summary now includes explicit range (`1–50 of N`) via `paginationSummary`.

---

## 7. Remaining foundation and E2E blockers

| Blocker | Notes |
|---------|--------|
| Authenticated E2E sign-off | Needs secure `E2E_EMAIL` / `E2E_PASSWORD` (Phase 5) |
| shadcn/Radix parity with legacy | Large port; wait until shell + 2–3 modules prove patterns |
| React Query | Add when multiple modules need shared cache/invalidation |
| Global toasts | No cross-route notification requirement yet |
| Breadcrumbs | Not used on current pilots; add with next admin module |
| Visual QA on `:3001` standalone | Habib/staging review recommended after UI change |
| Route matrix artifact drift | Regenerator may touch JSON/CSV timestamps — commit only when Habib wants matrix refresh bundled |

---

## 8. Recommendation for next phase (Phase 7 — for Habib review)

1. **Habib review** this foundation on standalone (`npm run build:standalone`, `PORT=3001 BACKEND_URL=…`) with real roles (notice board + audit allowed/denied).
2. **Run Phase 5 E2E** with credentials to lock authenticated flows after UI refactor.
3. **Optionally adopt React Query** when migrating the first write-heavy or frequently invalidated module; keep `apiFetch` as the transport layer.
4. **Migrate one small business module** (not `/approvals` or `/sales/active-clients`) using `DataTable` / form patterns — still no Talha assignment until Habib approves scope.
5. Do **not** declare production cutover or assign broad module migration until staging acceptance.

---

*No commit, push, merge, or deploy performed in Phase 6 unless explicitly requested.*
