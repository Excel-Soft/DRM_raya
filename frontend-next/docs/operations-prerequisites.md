# Operations prerequisites — Next.js cutover (evidence from repository)

**Production readiness is not claimed.** Current Vite static frontend deployment remains authoritative until staging rehearsal passes.

---

## Verified in repository

| Topic | Evidence | Finding |
|-------|----------|---------|
| Next standalone build | `frontend-next/next.config.ts` `output: "standalone"` | Config present |
| Local build | `frontend-next/docs/FOUNDATION_STATUS.md` | `npm run build` produced `.next/standalone/server.js` in prior validation |
| API proxy pattern | `frontend-next/next.config.ts` rewrites `/api`, `/uploads` → `BACKEND_URL` | Dev/staging pattern documented; Express unchanged |
| Legacy frontend deploy | `frontend/deploy.sh` | Pull + Vite build — **unchanged in this migration work** |
| Node for Next (local) | FOUNDATION_STATUS | Node 23.11.0 with `engine-strict=false`; README recommends 20.19+ / 22.13+ / 24+ |

---

## Not verified in repository (blockers for cutover rehearsal)

| Topic | Gap |
|-------|-----|
| Production Node version for Next standalone | No CI/deploy manifest specifying runtime for Next server |
| Staging Node version | Same |
| Nginx routing to Next Node process | No in-repo Nginx config for Next; README describes intent only |
| Rollback procedure document | Rollback to Vite static implied by parallel deploy but not scripted for Next |
| TLS / cookie / SameSite for split origins | Backend cookie notes in `auth.middleware.ts`; Next production pairing not validated |

---

## Phase 2 local run (Next-only)

```bash
cd frontend-next
export BACKEND_URL=http://localhost:5001   # Express API
npm run dev                                 # Next on :3000, /api rewritten to Express
```

Cookie/auth smoke (manual): sign in at `/auth`, confirm `GET /api/auth/me` via browser network tab, open `/notice-board`.

## Required before staging rehearsal

1. Pin Node LTS version on staging host for `next start` or container entrypoint.
2. Nginx: route `/` (or app prefix) → Next standalone; preserve `/api` → Express upstream.
3. Smoke: auth cookie/header flow through Next rewrites to Express.
4. Document rollback: switch upstream back to Vite `dist` static root.
5. Confirm `BACKEND_URL` / env for standalone server in staging.

---

## Explicit non-goals in Phase 0

- No production or staging Nginx edits in migration branch.
- No change to Express listen port or API contract.
