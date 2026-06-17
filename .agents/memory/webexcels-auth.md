---
name: WebExcels DRM auth/session model
description: Durable, non-obvious decisions and gotchas for the WebExcels DRM auth model (server/ + client/).
---

- **Authorization authority is the verified JWT** (`activeRoleId` in
  `server/auth.middleware.ts`), never a client header or `sessionStorage`. Role
  switches re-issue a JWT after verifying the role is assigned. So editing client
  storage cannot escalate access; client route gating is cosmetic.
  **Why:** answers any "can the client fake a role?" question — no.

- **Unmatched `/api/*` routes do NOT return JSON 404 in dev** — they fall through to
  the Vite SPA middleware and return `index.html` (HTTP 200, `text/html`). A removed
  API endpoint therefore returns 401 (unauthenticated, behind the `/api` gate) or
  200-HTML (authenticated), never a clean 404.
  **How to apply:** when verifying a *removed* endpoint, assert "no handler / SPA HTML
  / no side effect", not a 404 status.

- **Secrets policy is violated by `.replit`'s `[userenv.shared]`.** That block commits
  env values (incl. `JWT_SECRET`) into the repo, contradicting the "secrets never
  hard-coded in source" preference. Proper home is the Replit Secrets store. Rotating
  `JWT_SECRET` invalidates all active sessions — treat as a user-approved action, not a
  silent change.

- **`password` column is deprecated legacy plaintext; auth uses `password_hash`
  (bcrypt) only.** Schema marks it nullable and a forward migration drops NOT NULL.
  **Why:** the drizzle baseline snapshot still declares it NOT NULL, so a forward
  migration is required for fresh provisioning — editing the baseline is unsafe.

- **`npm run check` baseline is now zero** (see `tsc-baseline-errors.md`). The old
  large baseline was fully resolved; treat any `tsc` error as a real regression
  from your own change, not pre-existing noise.
