# PATCH 7 — Deployment Secrets Runbook (SEC-002)

_Last updated: 2026-06-29 (Patch 7 Stage 1)._

This runbook is the authoritative, Patch-7 view of the secrets the WebExcels DRM
server requires, how they are validated at boot, and how to configure them safely
on Replit. It supersedes the older `DEPLOYMENT_SECRETS_RUNBOOK.md` for Stage-1
purposes; that file remains for historical reference.

## 1. Boot-time enforcement (fail closed)

Secret validation lives in `server/config/validate-secrets.ts` and is invoked at
the very top of `server/index.ts` via `assertSecretsOrExit(process.env)`.

- In **production** (`NODE_ENV=production`) a missing or unsafe secret is a
  **fatal error**: the process logs the problem (never the value) and calls
  `process.exit(1)` so a misconfigured build cannot serve traffic.
- In **non-production** the same problems are logged as **warnings** only, so
  local/dev work is never blocked.
- Secret **values are never printed** — only the variable name and the reason.

The pure `validateSecrets(env)` function returns
`{ ok, isProduction, errors, warnings }` and is unit-tested in
`server/validate-secrets.test.ts`.

## 2. Required / validated secrets

| Variable | Required | Rules enforced |
| --- | --- | --- |
| `JWT_SECRET` | **Yes (production)** | Must be set; must not be a known weak/placeholder value; must be **≥ 32 chars**. Used to sign/verify JWTs (`server/auth.*`). |
| `SESSION_SECRET` | Optional | Validated **only when set**: not a weak/placeholder value; **≥ 32 chars**. |
| `MOCK_AUTH` | Must be off in prod | If `MOCK_AUTH=true` while `NODE_ENV=production`, boot is **fatal** — this flag disables authentication entirely and is for local dev only. |
| `DATABASE_URL` | Yes (runtime) | Replit-provided PostgreSQL connection string. Use the Replit DB unless an explicit production `DATABASE_URL` is provided (see `replit.md`). |

`MIN_SECRET_LENGTH` is exported from `validate-secrets.ts` (currently `32`).

### Weak/placeholder blacklist
Values such as `secret`, `jwt_secret`, `changeme`, `test`, `password`,
`dev_secret` (case-insensitive) are rejected. Pick a unique, high-entropy value.

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Configuring secrets on Replit (never hard-code)

Secrets must live in **Replit-managed environment variables**, never in source
(`replit.md` user preference). Use the Secrets pane / environment tooling:

1. Open the workspace **Secrets** panel.
2. Add `JWT_SECRET` (and `SESSION_SECRET` if you use sessions) with strong values.
3. Ensure `MOCK_AUTH` is **unset** (or `false`) for any production deployment.
4. For Deployments, set the same secrets in the deployment's environment so the
   published app boots with valid configuration.

## 4. Pre-deploy checklist

- [ ] `JWT_SECRET` set, unique, ≥ 32 chars, not a placeholder.
- [ ] `SESSION_SECRET` set (if used) and equally strong.
- [ ] `MOCK_AUTH` not enabled.
- [ ] `DATABASE_URL` points at the intended database.
- [ ] `npm run check` passes (type clean).
- [ ] `npm test` green (includes `validate-secrets.test.ts`).
- [ ] Boot logs show no secret warnings/errors.

## 5. Verifying locally

```bash
# Fails closed in prod with a weak secret (expect a fatal secret error in logs):
NODE_ENV=production JWT_SECRET=changeme npm run dev

# Boots in prod with a strong secret:
NODE_ENV=production JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" npm run dev
```

Automated evidence: `npm test` runs `server/validate-secrets.test.ts`, which
asserts the missing / weak / short JWT, weak SESSION_SECRET, and
`MOCK_AUTH=true`-in-prod cases all fail, while a strong production config and all
non-production cases pass.
