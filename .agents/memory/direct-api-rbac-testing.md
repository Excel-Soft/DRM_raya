---
name: Direct-API RBAC testing via signed JWTs
description: How to test per-role API permissions in this app without seeding DB users
---

Role is derived from the **JWT only** (`auth.middleware.ts` reads
`activeRoleId`/`roleId`/`role`/`role_id` → `normalizeRole`); a valid HS256 token signed
with `JWT_SECRET` passes auth with **no DB user lookup**. So you can exercise the full
RBAC layer per-role by minting tokens, without seeding role accounts.

**Why:** Stage-10 UAT needed executed cross-role permission evidence but there are no
seeded credentials for all ~22 roles. Minting tokens gives real 401/403/allow results.

**How to apply:**
- Mint `jwt.sign({ id, roleId: <role> }, process.env.JWT_SECRET, { algorithm: "HS256" })`
  per role, then hit `http://localhost:5000/api/...` and read status codes:
  401=auth-fail, 403=RBAC-denied, 200/400/404/409=passed-guard (allowed).
- Run helper scripts placed in `/tmp` with
  `NODE_PATH=/home/runner/workspace/node_modules node /tmp/script.cjs` — `/tmp` is
  outside the project so `require('jsonwebtoken')` won't resolve without `NODE_PATH`.
- Anonymous (no token) → global `app.use("/api", authMiddleware)` returns **401**
  (`missing-token`), not 403. Disabled modules (Support, flag OFF) return **404**.
- This tests the API permission layer only; it is NOT a substitute for live browser UAT
  (sidebar/route visibility, end-to-end workflow) — record those as PENDING if unrun.
