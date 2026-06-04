# Production Checklist

Pre-deploy checklist and operational reference for the active app
(`server/` + `client/` + `shared/`).

## Environment variables

### Required

| Var | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | App and tests use the same pool (`server/db.ts`). Must be reachable at boot; DB-dependent routes fail if absent. |
| `JWT_SECRET` | Signs/verifies auth tokens | Used by `server/auth.service.ts`. Set a strong, unique value. App must reject if missing in production. |
| `NODE_ENV` | `production` for prod | Enables prod cookie behaviour; disables public signup; refuses to start if `MOCK_AUTH=true`. |
| `PORT` | Listen port | Defaults to `5000`. Only this port is exposed. |

### Recommended / optional

| Var | Purpose | Notes |
|---|---|---|
| `CORS_ORIGINS` | Comma-separated allowed origins | Falls back to `FRONTEND_URL`/`CLIENT_ORIGIN`/`VITE_ORIGIN`/`VITE_APP_URL`. If none set, CORS allows all origins (`true`) — set explicitly in prod. |
| `FRONTEND_URL` | Frontend base URL | Also influences cookie `SameSite=none` selection in prod. |
| `AUTH_COOKIE_NAME` | Auth cookie name | Defaults to `auth_token`. |
| `AUTH_COOKIE_SECURE` / `AUTH_COOKIE_SAMESITE` / `AUTH_COOKIE_DOMAIN` / `AUTH_COOKIE_MAX_AGE_MS` | Cookie hardening | Defaults: secure in prod, `lax` (or `none` with `FRONTEND_URL`), 7-day max age. |
| `IP_RESTRICTION_ENABLED` | Enable allowed-IP gate | `checkAllowedIp` only enforces when `true`. |
| `DEBUG_ERRORS` | Log stack traces | When `true`, the global error handler logs `err.stack` server-side. Never sent to clients. Leave off in prod. |
| `DEBUG_AUTH` | Verbose auth logging | Optional. |
| `MOCK_AUTH` | **Dev only** auth bypass | MUST be unset/`false` in prod — the server refuses to boot if `MOCK_AUTH=true` while `NODE_ENV=production`. |

## Build & start

```bash
npm ci            # install exact deps
npm run check     # type-check (known baseline errors in debug/reports routes)
npm test          # vitest (needs reachable DATABASE_URL for DB-backed tests)
npm run build     # vite build (client) + esbuild bundle (server) → dist/
npm start         # NODE_ENV=production node dist/index.js
```

`prestart` verifies `dist/index.js` and `dist/public/index.html` exist and
rebuilds if missing. The server serves both the API and the built client on
`PORT`.

## Security status

### Error envelope

- Global error handler (`server/index.ts`) returns a sanitized
  `{ success:false, message }` body; stack traces are only logged server-side
  (and only when `DEBUG_ERRORS=true`). No SQL/secrets are sent to clients.
- Auth/validation error paths return `{ error }` (and, where the Stage 10
  envelope is adopted, `{ success:false, error:{ code, message }, message }`).
  See `API_CONTRACT_INVENTORY.md`.

### Upload security

- The active app stores all "uploads" (product docs, service docs, todo
  attachments, meeting files) as **URL/string** fields — there is **no binary
  file storage** path in the active server, which limits the attack surface.
- A reusable hardened multer (2.x) factory exists for future binary uploads with
  MIME + extension allowlists, size/count limits, executable/script rejection,
  and filename sanitization. See `UPLOAD_SECURITY_NOTES.md`.
- **Limitation: no virus scanning.** If binary storage is introduced, add a
  scanner (e.g. ClamAV or a 3rd-party service) per `UPLOAD_SECURITY_NOTES.md`.

### Auth / access control

- All `/api/*` routes (except public auth + health) are behind JWT
  `authMiddleware` → 401 when unauthenticated.
- Role/URL access control is enforced centrally by `checkUrlPermission` (DB
  driven) plus a few explicit per-route guards.
- Optional IP allowlist via `IP_RESTRICTION_ENABLED`.

## Known limitations

- **No virus scanning** for any future binary uploads.
- **Legacy `src/` tree is unused at runtime** — it is NOT mounted by
  `server/index.ts`/`server/routes.ts`. Do not rely on it for runtime behaviour.
- `npm run check` has known pre-existing baseline type errors in
  `server/debug-routes.ts` and `server/reports-routes.ts`.
- If `CORS_ORIGINS`/`FRONTEND_URL` are unset, CORS defaults to allow-all — set
  explicitly for production.
- Some route registrars run idempotent table DDL on startup (awaited in
  `registerRoutes`); the first boot against a fresh DB may take longer.

## Deployment notes

- Expose only `PORT` (default 5000); the same process serves API + static client.
- Ensure `DATABASE_URL` is reachable from the runtime before/at boot; transient
  DB connectivity errors are suppressed from crashing the process and retried on
  request (`server/index.ts`).
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and explicit `CORS_ORIGINS`.
- Confirm `MOCK_AUTH` is not enabled — the server will refuse to start otherwise.
- Run `npm run build` in CI; verify the client chunk output (lazy-loaded route
  chunks) is emitted.
