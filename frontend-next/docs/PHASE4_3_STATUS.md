# Phase 4.3 — Login UI and CSS loading fix

**Date:** 2026-10-23  
**Branch:** `fix/upgrade_frontend_habib`  
**Scope:** `frontend-next/` only. Not committed or pushed.

---

## Proven root cause (diagnosis)

The unstyled `/auth` on **port 3001** was **not** missing `globals.css` import (root layout already imports it). Three verified issues combined:

### 1. Stale standalone server + missing static assets (primary for `:3001`)

| Evidence | Finding |
|----------|---------|
| `curl http://localhost:3001/auth` (before fix) | HTML from **pre–Phase 4.2** login (old copy, no gradient/`login-card`) |
| CSS href `/_next/static/css/04d3925754631c46.css` | **HTTP 500** `Internal Server Error` |
| `.next/standalone/.next/static` | **Missing** until `scripts/prepare-standalone.mjs` runs |

Standalone `server.js` does not bundle `/_next/static/*`; without copying `.next/static` into `.next/standalone/.next/static`, the browser receives HTML with Tailwind class names but **no stylesheet**.

### 2. Webpack production CSS did not emit Tailwind utilities (primary for production build)

| Evidence | Finding |
|----------|---------|
| `npm run build` used `next build --webpack` | Dev uses **Turbopack** + `@tailwindcss/turbopack`; production used **Webpack** without PostCSS |
| Pre-fix `.next/static/css/*.css` | Contained `@layer utilities{@tailwind utilities}` **without** generated `.rounded-lg`, `.bg-emerald-600`, etc. |
| Post-fix with `TAILWIND_POSTCSS=1` | `ef47b39f9d2429be.css` (~32KB) includes full Tailwind v4 utilities |

### 3. PostCSS + Turbopack dev conflict (regression during fix attempt)

Adding an always-on `postcss.config.mjs` with `@tailwindcss/postcss` caused **`next dev` (Turbopack) to 500** (native `lightningcss` / `@tailwindcss/oxide` not loadable in Turbopack’s PostCSS runner).

**Resolution:** PostCSS plugins only when `TAILWIND_POSTCSS=1` (build script); Turbopack dev keeps `@tailwindcss/turbopack` CSS rules in `next.config.ts`.

---

## Files changed

| File | Purpose |
|------|---------|
| `postcss.config.mjs` | Tailwind PostCSS **only** when `TAILWIND_POSTCSS=1` |
| `next.config.ts` | Restored Turbopack `*.css` → `@tailwindcss/turbopack` |
| `package.json` | `build` → `TAILWIND_POSTCSS=1 next build --webpack`; `build:standalone`, `start:standalone` |
| `scripts/prepare-standalone.mjs` | Copy `.next/static` + `public` into standalone output |
| `src/app/(public)/auth/page.tsx` | Polished card; removed API health link + technical footer copy; `data-testid="login-card"` |
| `src/components/auth/login-form.tsx` | Minor cleanup (removed extra email hint); auth logic unchanged |
| `src/app/layout.tsx` | `font-sans` on body |
| `e2e/auth.spec.ts` | Visual smoke: login card `borderRadius` + `boxShadow` |

Auth contract unchanged: `auth-api.ts`, `auth-provider.tsx`, `auth-gate.tsx`, `session.ts`.

---

## Standalone procedure (documented)

```bash
cd frontend-next
npm run build:standalone          # build + copy static assets
PORT=3001 BACKEND_URL=http://localhost:5001 node .next/standalone/server.js
# or: PORT=3001 BACKEND_URL=http://localhost:5001 npm run start:standalone
```

---

## Validation commands and results

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** |
| `npm test` | **Pass** (31 unit/policy tests) |
| `npm run build:standalone` | **Pass** |

### Dev server — `http://localhost:3000/auth`

| Check | Result |
|-------|--------|
| HTTP status | **200** |
| Markup | `data-testid="login-card"`, DRM WebExcels gradient layout |
| CSS | Turbopack chunk loads (dev pipeline) |
| Playwright (`PLAYWRIGHT_BASE_URL=http://localhost:3000`, 4 no-credential tests) | **4 passed** |

### Standalone — `http://localhost:3001/auth`

| Check | Result |
|-------|--------|
| HTTP status | **200** |
| Markup | Current Phase 4.2/4.3 login (gradient + `login-card`) |
| CSS `/_next/static/css/ef47b39f9d2429be.css` | **200**, ~32KB |
| Playwright visual smoke (`login page renders`) | **Pass** (border-radius & box-shadow asserted) |

### CSS asset summary

| Server | Port | Stylesheet | Status |
|--------|------|------------|--------|
| Standalone (fixed) | 3001 | `/_next/static/css/ef47b39f9d2429be.css` | **200** |
| Standalone (before fix) | 3001 | `/_next/static/css/04d3925754631c46.css` | **500** |

---

## Login UX (post-fix)

- Full-height emerald/zinc gradient background  
- Centered card with shadow, ring, rounded corners  
- DRM WebExcels wordmark (no logo asset in repo)  
- Email/password fields, visibility toggle, loading/disabled states, `role="alert"` errors  
- Removed user-facing Express/sessionStorage explanation and `/api-health` link from login screen (`/api-health` route remains for diagnostics)

---

## Authentication

Unchanged — Express `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`; Bearer in `sessionStorage`. No authenticated browser tests run in this phase (per instruction to fix UI/CSS first).

---

## Verdicts

| Area | Verdict |
|------|---------|
| **Login UX / CSS** | **Fixed** on dev `:3000` and standalone `:3001` after rebuild + static copy |
| **Auth behavior** | **Unchanged** (code inspection) |
| **Local build** | **Ready** — utilities compile when `TAILWIND_POSTCSS=1` |
| **Module migration** | **Not ready** — authenticated journeys still blocked |
| **Deployment readiness** | **Not ready** — operators must run `build:standalone` and copy static assets before `node server.js` |

---

## Operator notes

1. **Do not** run an old `.next/standalone/server.js` without re-running `npm run build:standalone`.  
2. **Do not** expect production CSS utilities if `TAILWIND_POSTCSS=1` is omitted from the build command.  
3. For local dev, use `npm run dev` (Turbopack). Use `next dev --webpack` only if debugging webpack-specific issues.
