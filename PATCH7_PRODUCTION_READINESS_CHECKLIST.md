# PATCH 7 — Production Readiness Checklist (Stage 8, Section A · PROD-001)

**Date:** 2026-06-30. Companion to `PATCH7_DEPLOYMENT_SECRETS_RUNBOOK.md`.
Verifies secrets hardening, startup validation, MOCK_AUTH prod-block, and the
auth/CORS/cookie posture for a production deploy. Evidence is CODE (source) +
LIVE (executed this session) + AUTO (test suite).

## 1. No committed production secrets
- **Verified:** no real/production secret values are committed. Secrets resolve from
  `process.env` (e.g. `auth.service.ts` reads `process.env.JWT_SECRET`).
- **Known dev fallback (honest):** `server/auth.service.ts:6` has a weak development
  fallback — `const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production"`.
  This is a placeholder, **not** a leaked credential, and it is **blocked in
  production**: `validate-secrets.ts` treats a missing/placeholder/weak/`<32`-char
  `JWT_SECRET` as fatal under `NODE_ENV=production` (`process.exit(1)`), so the
  fallback can only ever take effect in development. **Recommendation:** remove the
  literal fallback and require `JWT_SECRET` unconditionally to eliminate the dev/prod
  divergence (tracked under SEC-002, Partial).
- **Policy:** secrets live in Replit-managed env (per `replit.md`); never hard-coded.

## 2. Required Replit Secrets (production)

| Secret | Required | Validation | Notes |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | fail-fast in prod if missing / weak / `< 32` chars | HS256 signing key; 7-day tokens |
| `DATABASE_URL` | **Yes** | host validated (`server/db.ts`) | Replit Postgres; `search_path=drm,public` |
| `SESSION_SECRET` | Optional | validated **only if set** (weak/short → fail in prod) | app is JWT-stateless; not required unless sessions enabled |
| `MOCK_AUTH` | **Must be unset/false** | prod-fatal if `=true` | dev-only auth bypass |
| `CORS_ORIGINS` | Recommended | — | comma-separated allowed origins |
| `FRONTEND_URL` | Recommended | — | influences cookie `sameSite`/`secure` |

## 3. Startup validation (fail-fast)
- `server/index.ts` calls **`assertSecretsOrExit()`** before binding any port.
- `server/config/validate-secrets.ts`:
  - `NODE_ENV=production` + missing/weak/`<32` `JWT_SECRET` → **`process.exit(1)`**.
  - `SESSION_SECRET` present but weak/short → fail in production.
  - `NODE_ENV=production` + `MOCK_AUTH=true` → **refuses to start**.
- **Defense-in-depth:** `server/routes.ts` independently aborts on
  `NODE_ENV=production && MOCK_AUTH=true` (FATAL).
- **Evidence:** AUTO — `server/validate-secrets.test.ts` (in the 227-test green run)
  covers missing/weak/short JWT, weak SESSION, and MOCK_AUTH-prod-fatal cases.

## 4. Production boot-failure behavior (expected)
| Condition | Behavior |
|---|---|
| `JWT_SECRET` missing in prod | process exits 1 (no port bind) |
| `JWT_SECRET` weak/placeholder/`<32` in prod | process exits 1 |
| `SESSION_SECRET` set but weak in prod | process exits 1 |
| `MOCK_AUTH=true` in prod | process exits 1 (validate-secrets **and** routes guard) |
| `DATABASE_URL` invalid host | `server/db.ts` rejects host; DB-dependent routes fail loudly |

> **Pending (honest):** a live production-environment boot drill (deploy with a
> deliberately bad secret to observe exit 1) is **not executed** in this dev session.
> Logic is code-verified + unit-tested; PROD-001 remains **Partial** until the prod
> drill is recorded.

## 5. Auth / CORS / cookie posture
- **Auth:** stateless JWT (HS256, 7-day expiry). Bearer `Authorization` header is the
  primary channel; `auth_token` cookie supported. Global JWT auth applied in
  `routes.ts` (public exceptions: `/api/auth/*`, health).
- **Cookie:** `auth_token` — `httpOnly:true`, `secure` in prod, `sameSite` resolves to
  `none` in prod when `FRONTEND_URL` is set (else `lax`).
- **CORS:** `server/index.ts` uses `CORS_ORIGINS` (or default frontend URLs),
  `credentials:true`, allows `Authorization` / `X-Request-Id`.

## 6. Secret rotation
1. Generate a new high-entropy value (≥32 chars): `openssl rand -base64 48`.
2. Update the Replit Secret; redeploy. Existing JWTs remain valid until 7-day expiry —
   rotation invalidates **new** signatures only. For immediate revocation, rotate +
   shorten `JWT_EXPIRES_IN` or add a token blacklist (future work; not in scope).
3. `DATABASE_URL` rotation: update secret, redeploy; verify boot `schema maintenance`
   log and a probe query.

## 7. Schema / table expectations
- Schema of record: `shared/schema.ts` (Drizzle), schema name **`drm`**.
- Live `drm` schema currently has **641 tables** (verified this session).
- Schema is applied at boot via additive runtime ensure-DDL (see
  `PATCH7_DATABASE_MIGRATION_PLAN.md`); boot log confirms
  `[accounts] schema maintenance completed successfully`.

## 8. Audit / logging expectations
- Sensitive mutations write to `drm.activity_logs` (rich `AuditLogService` —
  actor/time/before/after/reason/ip/userAgent).
- Read-only viewer **`GET /api/audit-logs`** gated to `admin/super_admin/super_hod`
  with actor/module/entityType/entityId/action/date-range filters + pagination.
- **LIVE (this session):** admin/super_hod → 200; hod/account_manager/sales_executive
  → 403; invalid date → 400. See `PATCH7_FINAL_QA_SCENARIOS.md` (scenarios 1, 2, 18).

## Readiness verdict
Security/secrets/auth posture is **release-grade and evidenced** (code + unit tests +
live RBAC probes). **PROD-001 = Partial** pending one item only: a recorded
**production boot drill** with a bad secret. No code change required to deploy.
