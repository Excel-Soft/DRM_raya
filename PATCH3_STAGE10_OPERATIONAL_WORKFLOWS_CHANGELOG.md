# Patch 3 — Stage 10: P1 Operational Workflow Completion

Scope: complete the P1 operational workflows across six modules —
**A) CRM / Sales / Leads**, **B) GM / BV lifecycle + reconciliation**,
**C) Service Department**, **D) DRM / DD operational pages**, **E) Events**, and
**F) Allowed IP**.

This is predominantly a **verification + test + documentation** stage. A recon
pass (five explorers) plus an architect plan confirmed that the operational
surfaces in Parts **A, B, C, E, F** were already built and hardened in prior
patches/stages and already satisfy the Stage 10 hard rules. In line with the
user preference to run the imported app **as-is with minimal changes** (no
rewrites of business workflows, approval logic, roles, permissions, UI, or DB
business structure), Stage 10 does **not** rewrite that working code.

The single endorsed **additive** gap was in **Part D**: the DRM / DD operational
mutations (promotions, today-posts, social accounts, commission verifications,
late-coming) wrote **no audit rows**, while the spec requires those create /
update / delete / approve actions to be auditable. Stage 10 closes that gap with
best-effort audit logging, and locks the operational gates down with an automated
test suite.

**Hard rules honoured:** no mock/placeholder data, no duplicate engines, no
weakened permissions (audit is additive and never replaces an authz gate), no
external WhatsApp / SMS / email, no destructive DB changes, no schema migration.

---

## Modules completed

- **A) CRM / Sales / Leads** — already present (lead import + duplicate
  enforcement, sales pipeline, CRM duplicates). Verified, unchanged.
- **B) GM / BV lifecycle + reconciliation** — already present. The read-only
  financial reconciliation `GET /api/reports/gm-bv-reconciliation` exists exactly
  as specced (Stage 8) and the BV report lifecycle/approval/export was unified and
  hardened in Stage 9. Verified, unchanged.
- **C) Service Department** — already present (service dashboard bound to real
  endpoints with honest empty fallbacks, complaints). Verified, unchanged.
- **D) DRM / DD operational pages** — **changed (additive)**: best-effort audit
  logging added to every operational mutation across the five DRM route files.
- **E) Events** — already present (event reception, speakers, menu-items, duties).
  Verified, unchanged.
- **F) Allowed IP** — already present (allowed-IP CRUD under `/api/settings`
  behind `authMiddleware`, plus the `checkAllowedIp` enforcement middleware).
  Verified, unchanged.

---

## Files changed

- `server/promotion-routes.ts` — **changed**. Added `ActivityLogService` import +
  a module-scoped best-effort `audit()` helper (`resourceType: drm_promotion`).
  Audit calls added after each successful mutation: create, update, approve,
  reject, soft-delete.
- `server/today-post-routes.ts` — **changed**. `audit()` helper
  (`resourceType: drm_today_post`). Audit calls after: create, update, complete.
  (No delete handler exists on this resource.)
- `server/social-accounts-routes.ts` — **changed**. `audit()` helper
  (`resourceType: drm_social_account`). Audit calls after: create, update, verify,
  soft-delete.
- `server/commission-verification-routes.ts` — **changed**. `audit()` helper
  (`resourceType: drm_commission_verification`). Audit calls after: create,
  approve, reject. (No standalone update handler exists on this resource.)
- `server/late-coming-routes.ts` — **changed**. `audit()` helper
  (`resourceType: drm_late_coming`). Audit call after the manual create.
- `server/stage10-operational.test.ts` — **new**. DB-backed integration suite
  that drives the real wiring through `registerRoutes()` (the same entrypoint as
  `server/index.ts`); mirrors the Stage 9 harness (seeds throwaway users, mints
  real JWTs via `authService`, soft-skips when Postgres is unreachable, cleans up
  seeded rows/users; `activity_logs` rows cascade-delete with their user).
- `PATCH3_STAGE10_OPERATIONAL_WORKFLOWS_CHANGELOG.md` — this file.

**No client/UI source files were changed. No business-logic, approval, role, or
permission code was changed.**

---

## APIs added / modified

- **No new endpoints; no request/response contracts changed.** The audit calls
  are an internal side effect on the existing handlers — they run only on the
  success path and do not alter status codes or response bodies.
- Audit-affected handlers (behaviour otherwise unchanged):
  - `POST /api/drm/promotions`, `PATCH /api/drm/promotions/:id`,
    `POST /api/drm/promotions/:id/approve`, `POST /api/drm/promotions/:id/reject`,
    `DELETE /api/drm/promotions/:id`
  - `POST /api/drm/today-posts`, `PATCH /api/drm/today-posts/:id`,
    `PATCH /api/drm/today-posts/:id/complete`
  - `POST /api/drm/social-accounts`, `PATCH /api/drm/social-accounts/:id`,
    `PATCH /api/drm/social-accounts/:id/verify`,
    `DELETE /api/drm/social-accounts/:id`
  - `POST /api/drm/commission-verifications`,
    `PATCH /api/drm/commission-verifications/:id/approve`,
    `PATCH /api/drm/commission-verifications/:id/reject`
  - `POST /api/drm/late-coming`

---

## Audit behaviour (Part D)

- Logs are written **only after a successful DB mutation**, keyed by the affected
  row id.
- `action` follows `drm.<entity>.<verb>` (e.g. `drm.promotion.create`,
  `drm.social_account.verify`, `drm.commission_verification.reject`).
- `details` is a **small, safe JSON** of metadata only — status transitions,
  reject reasons, changed **column names** (never values), and target ids. The
  full `req.body` is **never** logged; no secrets / PII / password hashes / tokens.
- Logging is **best-effort**: `ActivityLogService.log()` is internally
  try/caught and never throws, so an audit failure can never break or roll back a
  mutation.
- Audit is **additive** — it does not replace or relax any existing role / scope
  gate. Every audited handler keeps its original authz check.

---

## DB changes

- **None.** No schema migration, no new table, no new column. Audit rows reuse the
  existing `drm.activity_logs` table (columns: `user_id`, `action`,
  `resource_type`, `resource_id`, `details`, `created_at`, `updated_at`).

---

## Validation / tests run

- `npx tsc --noEmit` (`npm run check`) — **56 pre-existing baseline errors,
  unchanged; 0 new errors** in any changed file (including the new test).
- `npx vitest run` (`npm test`) — **full suite green: 10 files / 154 tests
  passing**, including the new `server/stage10-operational.test.ts` (9 tests):
  - DRM operational mutations are gated — unauthenticated promotion
    create/update/delete, today-post create, social-account create + delete,
    commission-verification create, and late-coming manual create all return
    **401/403 (never 404)**.
  - `GET /api/reports/gm-bv-reconciliation` read is gated (401/403, not 404).
  - `POST /api/events` and `POST /api/settings/allowed-ips` persistence endpoints
    are gated (401/403, not 404).
  - **Part D proof**: an authorized promotion create (admin) **persists a
    `drm.activity_logs` row** for that exact resource, tagged with
    `action = drm.promotion.create`, `resourceType = drm_promotion`, and the
    acting user id.
- `npm run dev` smoke — dev server boots clean, DB connects, serves on port 5000,
  auth gate active (`GET /api/auth/me` → 401 without a token).
- Architect review (`evaluate_task`, with git diff) — **PASS**: audit calls are on
  success paths only, no secret/PII leakage, best-effort logging cannot break a
  mutation, no missing mutation handler, no rule/permission violations.

---

## Unresolved issues / out-of-scope limitations (documented, intentionally not built)

Per the architect plan and the "run as-is / minimal changes" preference, the
following were **explicitly deferred** and are NOT implemented in this stage:

- **Server-side CSV export** for DRM/operational lists — a client-side export
  already exists; no new server export endpoint was added.
- **Service complaint category / severity** fields and an **escalated** complaint
  status — not present in the current schema; adding them would be a schema +
  workflow change.
- **GM / VAS / BV automated bridges** (auto-cross-posting between modules) — not
  built; reconciliation remains the read-only Stage 8 report.
- **Event scheduling conflict detection** — not built; events persist without an
  overlap check.
- **Private-pool follow-up metric** — remains an honest empty/null stub rather
  than a fabricated value (consistent with the Stage 9 metric-honesty rule).
