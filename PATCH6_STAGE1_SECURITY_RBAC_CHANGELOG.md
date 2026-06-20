# PATCH 6 — Stage 1: P0 Security / RBAC Hardening (Changelog)

Scope: close real authorization gaps and add production secret validation
**without** UI redesign, business-workflow changes (except to secure), destructive
DB changes, secret exposure, or weakening of any existing permission.

---

## A. Attributes API — auth + RBAC + validation + audit

**Problem:** `attributesRoutes` was mounted at `server/routes.ts` **before** the
global auth chain (`authMiddleware`, IP, `checkUrlPermission`), so
`GET/POST/DELETE /api/attributes*` were reachable **fully unauthenticated**, with
no input validation and no audit.

**Fix:**
- **Moved the mount** to *after* `checkAllowedIp` + `checkUrlPermission` in
  `server/routes.ts`, so every attributes endpoint now sits behind auth → IP →
  URL-permission.
- **Rewrote `server/attributes-routes.ts`** with per-endpoint guards:
  - `GET /api/attributes/:category` → `requireActionPermission("attributes.view")`
    (authenticated-only; these lists feed dropdowns app-wide) + zod-validated
    category param.
  - `POST /api/attributes` → `requireActionPermission("attributes.create")`
    (FULL_ACCESS = admin/super_hod, adminOverride) + zod body validation +
    `AuditLogService.record`.
  - `DELETE /api/attributes/:id` → `requireActionPermission("attributes.delete")`
    (FULL_ACCESS) + `AuditLogService.record` (captures the deleted row's
    category/name as `before`).

## B. Production secret validation + runbook

- **New `server/config/validate-secrets.ts`:**
  - `validateSecrets(env)` — pure/testable. In production, **errors** on: missing
    `JWT_SECRET`, a known weak/placeholder value, or length `< 32`. Validates
    `SESSION_SECRET` the same way **only when set**. Refuses `MOCK_AUTH=true` in
    production. In non-production these are **warnings** only.
  - `assertSecretsOrExit(env)` — logs warnings, and in production logs errors and
    `process.exit(1)` **before** the app binds a port or signs a token. Never
    prints secret values (only the variable name + reason).
- **Wired into `server/index.ts`** — called immediately after imports, before the
  Express app is constructed / listens.
- **New `DEPLOYMENT_SECRETS_RUNBOOK.md`** — required vars, generation commands,
  how to set them on Replit, prod-vs-dev behavior, and rotation notes.

## C. Action-permission registry + engine hardening

- **Enhanced `server/middleware/action-permission.ts`** (backward-compatible):
  - Added `adminOverride` (default **false**) — a normalized `admin` bypasses the
    **role gate only**, never the `predicate` / segregation-of-duties gate.
  - Added `auditDenied` / `auditEntityType` / `module` — denied 401/403 attempts
    recorded best-effort under action `"<key>.denied"`.
  - Made the guard **config-driven**: when `actionKey` exists in the registry,
    its policy supplies defaults for roles/allowRole/adminOverride/audit/
    entityType/module/message; explicit `options` still **override** the registry
    (so existing call sites are unaffected).
- **New `server/config/action-permissions.ts`** — the reviewable registry of all
  named action keys (attributes, invoice, service.*) with role groups
  (FULL_ACCESS, INVOICE_WRITE, SERVICE_WRITE via `isServiceWriteRole`). See
  `PATCH6_ACTION_PERMISSION_MATRIX.md`.
- **New `server/middleware/action-permission.middleware.ts`** — canonical import
  path; a thin **one-way re-export** of the engine + registry (no second
  implementation, no circular import). The original module stays in place so the
  eight existing importers keep working.

## C (applied). Guards on the real gaps

- **`server/account-routes.ts`** invoice routes (previously only `if(!req.user)`):
  - `PATCH /api/account/invoices/:id` → `invoice.update` + audit (`before`/`after`).
  - `PATCH /api/account/invoices/:id/status` → `invoice.update_status` + **zod
    enum** validation (`Draft|Pending|Sent|Paid|Overdue|Cancelled`, matching the
    DB enum; `paidAt` still set on `Paid`) + `AuditLogService.recordTransition`.
  - `DELETE /api/account/invoices/:id` → `invoice.delete` + audit.
- **`server/service-core-routes.ts`** — 11 previously-ungated write routes now
  carry `requireActionPermission("service.*")` (followups create/complete;
  complaints create/update/assign/resolve/close/reopen; dropouts create/recover;
  renewals create). No handler logic changed — guard added in front only.
- **Documented (not modified)** already-guarded domains: GM sales create
  (`requireGmSalesActionPermission`), Office/Accounts (`requireFinancialPermission`),
  Reports (`requireReportPermission`), and Penalty (handler-level
  canCreate/canDecide/canVoid + audit, incl. segregation-of-duties). Re-encoding
  these would risk role-map drift, so they are left untouched.

## D. Sidebar fail-closed during permission load

- **`client/src/components/app-sidebar.tsx`** — sub-items (`renderSubItems`) now
  fail **closed** while DB permissions are loading or errored: a `permKey`'d
  sub-item is hidden unless the caller is a real admin or the DB permissions have
  resolved. This mirrors the existing top-level nav behavior and removes the
  fail-open-during-load window where the hardcoded fallback map could briefly
  reveal items. No change to the resolved-state permission logic.

## E. Client API 401/403 consistency

- `client/src/lib/queryClient.ts` (verified, unchanged): `apiRequest` /
  `mutationRequest` throw on non-2xx and surface the server error envelope
  message; a 401 clears auth state consistently.
- **`client/src/pages/drm/attributes.tsx`** — add/delete mutations switched from
  `apiRequest` to `mutationRequest` and now surface `error.message` in the toast,
  so the new 403 messages (e.g. "You are not authorized to manage attributes.")
  are shown honestly instead of a generic "Failed to…".

## F. Docs

- `PATCH6_STAGE1_SECURITY_RBAC_CHANGELOG.md` (this file).
- `PATCH6_ACTION_PERMISSION_MATRIX.md` — full action → roles → enforcement matrix
  and the list of already-guarded routes left as-is.
- `DEPLOYMENT_SECRETS_RUNBOOK.md` — secret requirements and deployment steps.

---

## Backward compatibility & safety

- `requireActionPermission(actionKey, options?)` signature unchanged; explicit
  options override the registry, so the 8 existing importers are unaffected.
- No DB schema changes (audit uses the existing best-effort `recordAuditLog`).
- No secret values are ever logged. Dev keeps working on the in-repo JWT fallback
  (with a warning); production refuses to start on an invalid secret config.
- No existing permission was widened; gaps were closed (fail-closed everywhere).
