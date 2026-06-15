# Production Hardening Checklist — Stage 10 (Task E)

Pre-deploy hardening checklist for the active app (`server/` + `client/` +
`shared/`). Complements the operational `PRODUCTION_CHECKLIST.md` (env-var
reference) with a security-focused go/no-go list. Tick each before publishing.

## Auth / debug flags
- [ ] **`MOCK_AUTH` disabled** — must be unset/`false`. The server **refuses to
      boot** if `MOCK_AUTH=true` while `NODE_ENV=production` (defense in depth).
- [ ] **`DEBUG_AUTH` disabled** — unset/`false` in prod (no verbose auth logging).
- [ ] **`DEBUG_ERRORS` disabled unless actively debugging** — when `true` the
      global handler logs `err.stack` **server-side only** (never sent to clients).
- [ ] **`NODE_ENV=production`** — enables prod cookie behaviour, disables public
      signup.

## Secrets / config
- [ ] **`JWT_SECRET` set** to a strong unique value (Replit-managed secret, never
      in source). App signs/verifies tokens with it.
- [ ] **`DATABASE_URL` secured** — Replit-managed secret; not logged, not in
      client bundle, not committed.
- [ ] No secrets hard-coded in source (grep for keys/passwords before deploy).

## Network / transport
- [ ] **CORS restricted** — set `CORS_ORIGINS` (or `FRONTEND_URL`) explicitly. If
      none set, CORS falls back to allow-all (`true`) — **not acceptable in prod**.
- [ ] **Secure cookie flags** (cookie auth path): `AUTH_COOKIE_SECURE` true in
      prod, `SameSite` `lax`/`none` as appropriate, optional `AUTH_COOKIE_DOMAIN`,
      sane `MAX_AGE`. `trust proxy` is enabled for correct secure-cookie/IP behind
      the Replit proxy.
- [ ] **Rate-limit auth endpoints** — confirm/raise limits on `/api/auth/login`
      (and any token endpoints) to slow brute force. *(If no limiter is wired yet,
      record as a follow-up; see Unresolved.)*

## Input / upload safety
- [ ] **Upload file limits** — JSON/body limit is 50 MB. The active app stores
      "uploads" as URL/string (no binary disk writes). A hardened multer 2.x
      factory (`server/middleware/secure-upload.ts`) with MIME+ext allowlist and
      size/count caps exists for any future binary upload — wire it if enabled.
- [ ] Request validation via `shared/validators.ts` on new/changed endpoints.

## API response hygiene
- [ ] **No stack traces in API responses** — global handler returns the sanitized
      envelope; 5xx → fixed `"Internal server error"`. Verified by smoke tests.
- [ ] **No SQL errors / internals in API responses** — error mapping strips DB
      detail. Verified by `server/stage10-smoke.test.ts` (`isSanitized`).
- [ ] **No secrets in logs** — request logger logs only method/path/status/
      duration/query + request id; **never** bodies, auth headers, or passwords.
      Audit logging strips `password`.

## Data / operations
- [ ] **Migrations documented** — schema is Drizzle (`shared/schema.ts`, schema
      `drm`); `npm run db:push` / scripts in `scripts/`. See `REPLIT_RUNBOOK.md`.
- [ ] **Backup / restore procedure** — document DB snapshot/restore (Replit
      checkpoint + Postgres dump) before each release.
- [ ] **Admin user provisioning** — provision the initial admin via the documented
      seed/admin flow (not a hard-coded default in prod).
- [ ] **Allowed-IP behaviour** — `IP_RESTRICTION_ENABLED=true` to enforce the
      allowed-IP gate; changes are audited.
- [ ] **Audit logging enabled** — `drm.activity_logs` + `recordAuditLog` capture
      create/update/status/delete/approve/export with actor, IP, user-agent, and
      now the request id. See `AUDIT_LOG_EVENTS.md`.

## Observability
- [ ] **Request ID** active (`X-Request-Id` response header + `rid=` in logs) for
      incident correlation. (Stage 10, task F.)

## Verify before publish
```bash
npm run check    # 56 baseline, 0 new
npm test         # 154 passing (10 files)
npm run build    # passes
npm start        # NODE_ENV=production smoke on the built bundle
```

## Unresolved / confirm at deploy time
- Confirm an auth-endpoint **rate limiter** is wired in the chosen deploy
  topology; add one if absent (out of Stage 10 code scope).
- Error envelope is fully adopted in the global handler + key routes; some legacy
  routes still return `{ error }` (backward-compatible, gradual migration).

## Stage 10 — UI / QA / UAT additions
- [x] **No mock screens in production navigation.** Routed mock pages were
      converted to real APIs or honest empty states in Stage 9. `performance-graph.tsx`
      is not production-routed (example-only). See `REPORT_CATALOG.md` /
      `MOCK_STATIC_SCREEN_INVENTORY.md`.

## Stage 11 — Reports / Exports / QA / UAT additions
- [x] **Service Commission Verifications corrected.** This screen is reachable
      from the Service Manager dashboard (earlier docs wrongly called it
      "unrouted"). It previously showed a hardcoded `108962` total and
      `alert()`-based Copy/Excel/PDF over empty mock data. Converted to an honest
      empty state: no fabricated total, no mock/empty export. (Patch 3 Stage 11, Task A.)
- [x] **`/api/debug/fakhar` dormant.** `server/debug-routes.ts` defines
      `setupDebugRoutes()` but it is **never mounted** (no caller in `server/`), so
      the debug endpoint is not reachable in any environment. If it is ever wired,
      gate it behind non-production + admin or remove it.
- [x] **Report exports verified.** Server export endpoints (raw-attendance,
      salary, day-target, diagnose, reception) re-apply list filters + role/row
      scope and are permission-gated; the event export is a client CSV of
      already-visible scoped rows. No export emits mock/hidden data. See
      `REPORT_CATALOG.md` / `EXPORT_STANDARD.md` / `PATCH3_PERMISSION_QA_MATRIX.md`.
- [ ] **`npm run check` / `npm run build` pass** before publish (Stage 11 §
      `PATCH3_FINAL_IMPLEMENTATION_REPORT.md`): 56 baseline tsc errors, 0 new; build succeeds.
- [x] **Audit log viewer gated.** `GET /api/audit-logs` is restricted to
      `admin` / `super_admin` / `super_hod` and is read-only over
      `drm.activity_logs` (no schema change). Filters are parameterized.
- [x] **`alert()` removed from converted screens** (top-bar, product-posting and
      HOD dashboards) in favour of toast / inline messages. Remaining `alert()`
      sites are tracked in `STAGE_10_UI_QA_UAT_CHANGELOG.md` (Unresolved).
- [x] **Reusable validation / approval / table primitives** added
      (`ui/field-error.tsx`, `approval-action-modal.tsx`, `data-table-state.tsx`)
      so future screens share consistent states; backend remains the enforcement
      boundary.
- [x] **Smoke test** `scripts/api-smoke-test.ts` verifies auth gating,
      required-reason validation, and the audit viewer (8/8 passing).
- [ ] **KPI drill-downs:** placeholder KPIs (training/engagement/data-entry) must
      stay non-clickable until backed by a real query — see `KPI_DEFINITIONS.md`.
