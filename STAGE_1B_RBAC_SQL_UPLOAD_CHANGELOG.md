# Stage 1B — RBAC, SQL & Upload Security Changelog

P0 security hardening for WebExcels DRM. Scope was strictly access-control and
input-safety: **no UI redesign, no new modules, no approval-workflow changes
beyond access enforcement, no destructive DB commands.** Several intended
hardening items were found to already be in place from earlier work and only
needed verification (noted below).

## A. URL permission middleware tightened (`server/settings.middleware.ts`)
**Decision: pragmatic (user-approved).** The `drm.url_permissions` table is empty
and only ever modelled menu segments; the authoritative access control for API
routes is the per-route role guards (see C). A hard default-deny on unmatched
routes would lock every non-admin role out of the entire API, so unmatched routes
still **allow** (documented inline + listed as follow-up).

- Removed the broad "admin bypass" list (which let `service_manager`,
  `sales_manager`, `hod`, `*_executive`, posting roles, etc. skip URL-permission
  checks entirely). **Only true platform admins** (`admin` / `super_admin`, both
  of which normalize to `ROLES.ADMIN`) now bypass.
- Roles are normalized via `normalizeRole()` on both sides of the comparison
  (caller role and each stored `allowed_role_ids` entry), matching either the raw
  stored value or its normalized alias.
- Unauthenticated API requests already fail closed with 401; `/api/auth/*` remains
  public by design (login / forgot / reset). Non-`/api/*` paths are skipped.
- Rule-exists-but-disallows-role still returns 403 with safe logging
  (user id + normalized role + path only — no secrets/tokens).

## C. Approval role guards + segregation of duties + audit logging
Files: `server/leave-routes.ts`, `server/overtime-routes.ts`, `server/loan-routes.ts`.

- **Pre-existing (verified):** managerial/HOD role guards already returned 403 for
  unauthorized callers, and the approver id was already recorded
  (`approved_by` / manager / hod columns); timestamps use the repos' `updated_at`.
- **Added — self-approval prevention:** on every approve/reject path
  (leave approve+reject, overtime approve+reject, loan manager-approve +
  hod-approve + reject) the target record is fetched and, if the caller is the
  record owner, the action is rejected with 403 — **except** for `admin`/`super_admin`,
  who are exempt so a single-admin setup is not bricked.
- **Added — broken-access-control fix on "all records" list endpoints
  (code-review follow-up):** `GET /api/admin/leaves`, `GET /api/admin/overtime`,
  and `GET /api/overtime/all` returned *every employee's* records but had no
  in-handler role check, so under the pragmatic default-allow URL layer any
  authenticated user could read them. Each now requires `isManagerialRole` and
  returns 403 otherwise. (`GET /api/admin/loans` already had a guard and was left
  as-is; the self-scoped `/api/leave`, `/api/overtime`, `/api/loans` endpoints are
  correctly limited to the caller's own records / role.)
- **Added — audit logging:** each approve/reject now writes an
  `ActivityLogService.log(...)` entry (`LEAVE_APPROVED`/`_REJECTED`,
  `OVERTIME_APPROVED`/`_REJECTED`, `LOAN_MANAGER_APPROVED`/`LOAN_HOD_APPROVED`/
  `LOAN_REJECTED`) with the actor id, resource type/id, and the actor's normalized
  role. `ActivityLogService.log` swallows its own errors, so logging never blocks
  the business action.

## D. SQL safety in workflow routes
Files: `server/routes/product-posting-workflow-routes.ts`,
`server/routes/software-workflow-routes.ts`.

- **Verified:** all DB access in these routes is already parameterized — Drizzle
  `eq()` and `sql\`... ${value}\`` template tags (bound parameters), and raw
  `pool.query("... WHERE id = $1", [id])`. No string-interpolated SQL exists, so
  the SQL-injection risk is not present.
- **Added (defense-in-depth):** UUID format validation (`isUuid`) on `:projectId`
  for the `transition` and `assign-task` routes, returning 400 on malformed ids
  before any DB call.

## B. Sidebar fail-closed (`client/src/components/app-sidebar.tsx`) — VERIFIED, no change
Already fail-closed: while permissions load, permissioned items are hidden; if the
permissions fetch errors (the query throws on non-OK responses), only minimal nav
is shown. No change required.

## E. DRM debug endpoint (`server/drm-routes.ts`) — VERIFIED, no change
Already returns 404 in production and is admin-only; the table name is a hardcoded
constant (not user input). No change required.

## F. Todo DB error sanitization (`server/todo-routes.ts`) — VERIFIED, no change
Already uses the standard error envelope in all catch paths; raw PostgreSQL error
detail is not leaked to clients. No change required.

## G. Upload security — VERIFIED, nothing to apply
A hardened upload helper (`server/middleware/secure-upload.ts`) already exists
(multer 2.x, in-memory storage, mime+extension allowlist, dangerous-extension
denylist, safe filename, error handler). There are currently **no active file
upload routes** in the app (e.g. portfolio stores text only), so there is nothing
to wire it into. Documented for when an upload route is added.

## Files changed
- `server/settings.middleware.ts` (A)
- `server/leave-routes.ts` (C)
- `server/overtime-routes.ts` (C)
- `server/loan-routes.ts` (C)
- `server/routes/product-posting-workflow-routes.ts` (D)
- `server/routes/software-workflow-routes.ts` (D)
- `STAGE_1B_RBAC_SQL_UPLOAD_CHANGELOG.md` (this file)

## Risks fixed
- Privilege escalation via URL-permission bypass: managers/executives/posting/HOD
  roles no longer skip URL-permission checks; only platform admins do.
- Self-approval (segregation-of-duties gap): users can no longer approve/reject
  their own leave, overtime, or loan requests (admin-exempt).
- Broken access control on "all records" HR list endpoints: `/api/admin/leaves`,
  `/api/admin/overtime`, `/api/overtime/all` now require a managerial role, so
  ordinary employees can no longer read every colleague's leave/overtime data.
- IDOR on overtime creation: `POST /api/overtime` accepted `req.body.userId` and
  created records for arbitrary users. It now forces self-only creation; submitting
  on behalf of another user requires a managerial role (else 403).
- Missing audit trail for approval decisions: approve/reject actions are now logged.
- Malformed identifiers reach workflow DB calls: rejected early with 400
  (defense-in-depth on top of already-parameterized queries).

## Test results
- `npm run check`: **58 TypeScript errors, all pre-existing** (reports-routes and
  several repositories) — **0 in any file changed in this stage**. 58 matches the
  established baseline.
- App boots cleanly on port 5000 (no crash, no new errors in logs).
- Smoke tests (curl):
  1. App serving on :5000 — PASS
  2. `GET /api/customers` unauthenticated → 401 — PASS
  3. `PATCH /api/leaves/:id/approve` unauthenticated → 401 — PASS
  4. `PATCH /api/loans/:id/manager-approve` unauthenticated → 401 — PASS
  5. `POST /api/auth/login` (bad creds) → 400 from handler (public, not blocked by
     URL guard) — PASS
  6. `POST /api/product-posting/workflows/:id/transition` unauthenticated → 401 — PASS
  7. `npm run check` baseline (58, none in changed files) — PASS
  8. No crashes/errors in workflow logs during the above — PASS

## Unresolved / follow-ups
- **Authenticated-path runtime tests not executed:** the dev admin password is held
  privately (not in the runbook/repo), so admin-bypass, the non-admin allow path,
  the self-approval 403, the audit-log rows, and the workflow invalid-id 400 were
  verified by code review only, not by a logged-in HTTP run.
- **Full URL-permission default-deny** remains a follow-up: requires first
  populating `drm.url_permissions` for every API route/role; until then unmatched
  routes intentionally allow and per-route guards are the enforcement boundary.
- **Approval timestamps** reuse `updated_at`; dedicated `approvedAt`/`reviewedAt`
  columns were intentionally NOT added (out of scope: no destructive/schema DB
  changes this stage).
- **Upload helper unused:** wire `secure-upload.ts` into any future file-upload route.
- **P0 — committed JWT secret (pre-existing, outside this stage's diff):** `.replit`
  contains a literal `JWT_SECRET` under `[userenv.shared]`, i.e. a credential stored
  in source/VCS — contrary to the project rule that secrets live only in
  Replit-managed env. It was NOT changed here because remediation is an operational
  action with user-visible impact (rotating the secret invalidates every existing
  session/token) and should be done deliberately. Recommended: move `JWT_SECRET`
  into Replit Secrets, remove it from `.replit`, and rotate it (treat the current
  value as compromised).
