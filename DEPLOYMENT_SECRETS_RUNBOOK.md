# Deployment Secrets Runbook

This app validates its security-critical secrets at startup
(`server/config/validate-secrets.ts`, called from `server/index.ts`). In
**production** (`NODE_ENV=production`) a missing, weak, or placeholder secret
causes the process to **exit(1) before it binds a port or signs any token**. In
development it only logs warnings so local work keeps running on the in-repo
fallback.

Secret **values are never printed** by the validator or the app — only the
variable name and the reason it failed.

---

## Required / validated secrets

| Variable         | Required in prod | Rules                                                           | Notes |
|------------------|------------------|----------------------------------------------------------------|-------|
| `JWT_SECRET`     | **Yes**          | Must be set, not a known weak/placeholder, ≥ 32 chars          | Signs auth JWTs. No safe default in prod. |
| `SESSION_SECRET` | No (validated if set) | If set: not weak/placeholder, ≥ 32 chars                  | Only validated when present. |
| `MOCK_AUTH`      | Must be unset/false | `MOCK_AUTH=true` is **rejected** in production               | Bypasses auth; dev-only. |
| `DATABASE_URL`   | Yes (app needs a DB) | Not parsed by this validator                                | Use the Replit-provided PostgreSQL unless an explicit prod URL is given. |

"Weak/placeholder" includes values such as `secret`, `jwt_secret`, `changeme`,
`password`, `test`, `default`, and the development fallback
`dev-secret-key-change-in-production` (full list in `validate-secrets.ts`).

---

## Generating a strong secret

Use a high-entropy random value (≥ 32 chars). Any of:

```bash
# Node
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# OpenSSL
openssl rand -base64 48
```

---

## Setting secrets on Replit

Set secrets via the Replit **Secrets** pane (managed environment) — never commit
them to source. The deployment reads them from the environment at startup.

1. Open the Secrets / environment-variables pane.
2. Add `JWT_SECRET` with a freshly generated value (≥ 32 chars).
3. (Optional) Add `SESSION_SECRET` the same way if/when sessions are used.
4. Ensure `MOCK_AUTH` is **not** set to `true` for production.
5. Re-deploy. If a secret is missing/weak in production, the deploy logs the
   exact reason (e.g. `[secrets] ERROR: JWT_SECRET is not set...`) and the
   process exits — fix the secret and redeploy.

---

## Behavior summary

- **Production (`NODE_ENV=production`)**: any error → log reason → `process.exit(1)`
  before listening. No token is ever signed with a weak/placeholder secret.
- **Development**: issues are logged as warnings; the app continues using the
  development JWT fallback. These same issues WILL block a production deploy.

---

## Rotating `JWT_SECRET`

Rotating the JWT secret invalidates all currently-issued tokens (users must log
in again). To rotate:

1. Generate a new strong value.
2. Replace `JWT_SECRET` in the Secrets pane.
3. Re-deploy. Active sessions will be signed out and must re-authenticate.
