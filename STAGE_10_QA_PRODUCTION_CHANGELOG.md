# Stage 10 — QA & Production Hardening Changelog (Task J)

Scope: QA automation, typecheck/build gates, route lazy-loading verification,
production hardening, request-ID logging, seed/UAT docs. **No** app redesign,
**no** architecture rewrite, **no** business-workflow changes, **no** heavy deps.
Stages 1–9 left intact.

> A prior Stage 10 non-functional pass already landed lazy loading, the API error
> envelope, shared validators, the contract inventory, vitest smoke tests, and
> export utilities (see `STAGE_10_NFR_CHANGELOG.md`). This pass adds the request-ID
> middleware, an IPv4 listen fallback, and the remaining QA/production docs, and
> re-verifies check/build/test.

## Code changes
- **Request-ID middleware (task F)** — new `server/middleware/request-id.ts`:
  generates a UUID per request (or reuses a *safe* inbound `X-Request-Id`,
  sanitized + length-capped), sets `req.id`, and echoes `X-Request-Id` on the
  response. Wired in `server/index.ts` before the logger; `X-Request-Id` added to
  CORS `allowedHeaders` + `exposedHeaders`.
- **Logging (task F)** — `server/logger.middleware.ts` and the global error
  handler now include `rid=<request id>` in their log lines. **No** request/
  response bodies, auth headers, or secrets are logged.
- **Listen fallback (boot-blocker fix)** — `server/index.ts` now falls back to
  binding `0.0.0.0` when the IPv6 `::` bind fails with `EAFNOSUPPORT` /
  `EADDRNOTAVAIL` (this environment intermittently rejects IPv6), so the server
  reliably serves on port 5000.

## Tests added / status (task C, I)
- Existing vitest API smoke suite (`server/stage10-smoke.test.ts`) +
  `performance-routes.team.test.ts`: **14 tests pass** (`npm test`).
  - Coverage: auth gate → 401 on protected GETs across modules; bad login → 401
    sanitized; malformed login → 400; unknown routes handled with no stack leak.
- New `scripts/manual-smoke-test.md` — 12-scenario manual UI checklist (login,
  invalid-token redirect, sidebar nav, unauthorized block, customer/lead/PMS/
  product-posting/service/report/attendance/user pages) + cross-cutting checks.
- No Playwright/Cypress added (heavier than warranted; vitest+supertest already
  present is the lighter sanctioned path).

## Typecheck / build result (task A, I)
- `npm run check`: **57 baseline errors, 0 new** (none in Stage 10 files).
- `npm run build`: **passes**; per-page lazy chunks emitted; one large eager
  `index` chunk warned (expected). Details in `TYPECHECK_BUILD_REPORT.md`.
- `npm run dev`: boots clean on port 5000 (via the IPv4 fallback).

## Lazy-loading changes (task B)
- Verified already implemented in `client/src/App.tsx`: **85** `React.lazy()`
  route imports behind a single `<Suspense fallback={<PageLoader/>}>` boundary
  (dashboards, reports, service, PMS, product-posting, DRM/DD, analytics-heavy
  pages). Auth page / app shell / NotFound remain eager. No route behavior or
  imports changed in this pass.

## Production hardening (task E)
- New `PRODUCTION_HARDENING_CHECKLIST.md`: MOCK_AUTH/DEBUG_AUTH/DEBUG_ERRORS off,
  JWT_SECRET + DATABASE_URL as managed secrets, CORS restricted, secure cookie
  flags, auth rate-limit check, upload limits, no stack/SQL/secrets in API or
  logs, migrations + backup/restore + admin provisioning + allowed-IP + audit
  logging, and the request-ID observability item.

## Request ID / logging behavior (task F)
- Every `/api/*` (and other) response carries `X-Request-Id`. Logs include
  `rid=...` for correlation. Verified live: generated UUID, safe inbound id
  echoed, unsafe inbound id replaced with a fresh UUID, header CORS-exposed.

## Permission matrix QA (task D)
- New `PERMISSION_MATRIX_QA.md`: per-role visible/blocked routes and approve/
  delete/export expectations for all listed roles + cross-cutting RBAC assertions.
  Complements `ROUTE_PERMISSION_MATRIX.md`.

## Seed / test data (task G)
- New `QA_SEED_DATA_GUIDE.md`: required roles, sample users/customers/GM/BV/
  project-task/product-posting/service/attendance/report data, mapped to the
  existing `scripts/seed-*` helpers. Guardrail: never auto-seed production.

## UAT matrix (task H)
- New `UAT_SIGNOFF_MATRIX.md`: module / scenario / role / route / expected /
  tested-by / status / notes across Auth/RBAC, Navigation, CRM/Sales/Leads,
  GM/BV/Accounts, Attendance/HR/Salary, PMS, Product Posting/Software/QA/
  Verification, Service, DRM/DD, Reports, Events/Training/Notices, Admin/Settings,
  Notifications/Support.

## Files changed
**New:** `server/middleware/request-id.ts`, `TYPECHECK_BUILD_REPORT.md`,
`scripts/manual-smoke-test.md`, `PERMISSION_MATRIX_QA.md`,
`PRODUCTION_HARDENING_CHECKLIST.md`, `QA_SEED_DATA_GUIDE.md`,
`UAT_SIGNOFF_MATRIX.md`, `STAGE_10_QA_PRODUCTION_CHANGELOG.md`.
**Edited:** `server/index.ts` (request-id wiring, CORS expose, IPv4 listen
fallback), `server/logger.middleware.ts` (rid in log line).

## Dependencies changed
- None. `crypto.randomUUID` is built into Node.

## Unresolved / known limitations
- Large eager `index` JS chunk remains (~3.15 MB); route-level splitting is in
  place but vendor/eager-page chunking was intentionally not refactored (risk vs.
  reward). Optional future `manualChunks` tuning noted in
  `TYPECHECK_BUILD_REPORT.md`.
- 57 pre-existing tsc baseline errors remain in `reports-routes.ts` /
  `repositories/*` (business-logic typings; out of scope).
- Auth-endpoint rate limiting must be confirmed/added in the deploy topology
  (flagged in `PRODUCTION_HARDENING_CHECKLIST.md`).
- Three service exports still emit mock data (commission/dropout/due-VAS) per
  `EXPORT_STANDARD.md` — pre-existing, untouched.
- No automated E2E (Playwright/Cypress); manual checklist + API smoke used instead.
