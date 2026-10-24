# Phase 9 — DRM IP List Security Alignment and Pilot Acceptance

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Date:** 2026-10-23  
**Express changes in this phase:** **None** (proposal only — awaiting approval)

---

## 1. Confirmed role policy (evidence-based)

| Source | Roles allowed to use DRM IP List |
|--------|----------------------------------|
| **`frontend/src/routes/route-registry.ts`** | `ADMIN_ONLY` = `admin`, `super_admin`, `administrator`, `super_hod` for `/allowed-ip/drm-ip-list` |
| **`frontend-next/src/lib/auth/route-access.ts`** | Same four roles on prefix `/allowed-ip/drm-ip-list` (Phase 8) |
| **`frontend/src/components/app-sidebar.tsx`** | Menu group **Allowed IP** visible for `admin`, `super_admin` only (`DEPT_NAME_TO_ROLES`) — **navigation visibility**, not the page registry contract |
| **Legacy URL guard** | `frontend/src/lib/route-access.ts` has **no** `/allowed-ip` prefix — any authenticated user could open the URL in Vite if known (client gap) |
| **Express today** | `app.use("/api/settings", authMiddleware)` then unguarded handlers for **all** `/allowed-ips` verbs — **any authenticated role** can read/write via API |

**Policy recommendation for backend (and product sign-off):**

Apply **`requireRole("admin", "super_admin", "administrator", "super_hod")`** to **all** `/api/settings/allowed-ips*` routes (including **GET** list/detail). This matches registry `ADMIN_ONLY`, matches Next, does **not** add roles, and aligns with sensitive security configuration (same class as audit log read gating).

**Open product question (non-blocking for proposal):** Should `administrator` / `super_hod` see the sidebar item when the menu map only lists `admin` / `super_admin`? Registry + Next already allow those roles on the route; sidebar-only narrowing is a separate UX decision.

---

## 2. Backend audit summary

### Mount chain

1. `registerSettingsRoutes(app)` in `settings-routes.ts`
2. `app.use("/api/settings", authMiddleware)` — 401 if no valid JWT
3. `settingsRouter` routes; mounted on app (see end of file)
4. Allowed IP handlers: lines 286–387 — **no `requireRole`**

### Repository

`allowedIpsRepository.findAll()` returns full Drizzle rows (`id`, `ip_cidr`, `description`, `is_active`, `createdAt`, `updatedAt`).

### Existing tests

- `backend/src/server/tests/stage10-operational.test.ts` — POST `/api/settings/allowed-ips` without auth → 401/403 (not 404). **No** test that non-admin authenticated users are denied on GET.

### Reference pattern

`audit-log-routes.ts`: `router.get("/", requireRole(...ROLES), …)` for read-only sensitive data.

---

## 3. Proposed backend fix (NOT applied — approval required)

**Scope:** `backend/src/server/routes/settings-routes.ts` only. **No schema changes.**

```typescript
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

/** Align with legacy registry ADMIN_ONLY and Next DRM_IP_LIST_ROUTE. */
const ALLOWED_IP_CONFIG_ROLES = ["admin", "super_admin", "administrator", "super_hod"] as const;
const allowedIpRoleGate = requireRole(...ALLOWED_IP_CONFIG_ROLES);

// Option A — gate each handler (minimal diff):
settingsRouter.get("/allowed-ips", allowedIpRoleGate, async (req, res) => { ... });
settingsRouter.get("/allowed-ips/:id", allowedIpRoleGate, async (req, res) => { ... });
settingsRouter.post("/allowed-ips", allowedIpRoleGate, async (req, res) => { ... });
settingsRouter.patch("/allowed-ips/:id", allowedIpRoleGate, async (req, res) => { ... });
settingsRouter.delete("/allowed-ips/:id", allowedIpRoleGate, async (req, res) => { ... });

// Option B — sub-router (cleaner if more settings routes need different roles):
// settingsRouter.use("/allowed-ips", allowedIpRoleGate);
// then register GET/POST/PATCH/DELETE without repeating gate on each line
```

**Proposed tests** (new file or extend `stage10-operational.test.ts`):

| Case | Expect |
|------|--------|
| GET `/api/settings/allowed-ips` no token | 401 |
| GET with token for `admin` (or fixture admin) | 200 |
| GET with token for role **outside** ADMIN_ONLY (e.g. `account_manager` fixture) | **403** |
| POST/PATCH/DELETE non-admin | **403** (after gate on write routes too) |

Use existing test auth helpers (`auth(admin.token)` pattern in stage10 tests).

**Risk if approved:** Legacy Vite page and super-admin dashboard widgets that call `/api/settings/allowed-ips` under non-admin active roles would start receiving 403 — consistent with registry `ADMIN_ONLY`, but verify no workflow depends on a wider role in production.

---

## 4. Frontend verification (read-only page unchanged)

| Behavior | Mechanism |
|----------|-----------|
| Admin-class UI access | `AuthGate` + `isRouteAccessAllowed(DRM_IP_LIST_ROUTE, …)` |
| List load | `useApiResource` → `GET /api/settings/allowed-ips` |
| 401 | `apiFetch` / session → unauthenticated redirect to `/auth` |
| 403 | `useApiResource` sets `forbidden` → `PageForbidden` |
| Error + retry | `PageError` + `refetch` |
| Notice Board / Audit Logs | No code changes this phase |

**New acceptance tests (skipped without credentials):**

- `e2e/drm-ip-phase9.spec.ts`
- `e2e/helpers/admin-roles.ts`

---

## 5. Regression results (this session)

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 43 tests (13 + 23 + 7) |
| `npm run typecheck` | **Pass** |
| `npm run lint` | **Pass** (0 errors; PostCSS warning) |
| `npm run build` | **Pass** (included in standalone) |
| `npm run build:standalone` | **Pass** |
| `BACKEND_URL=http://localhost:5001 node scripts/smoke-api.mjs` | **Pass** (allowed-ips → 401 unauthenticated) |
| `node frontend-next/scripts/build-route-matrix.mjs` | Not re-run this session (Phase 8 run still valid; regen resets `migrationStatus` to `legacy`) |
| Legacy `frontend` route-access tests | Not re-run this session (unchanged) |

### Playwright (`npm run test:e2e`)

| Outcome | Count |
|---------|------:|
| Passed | 2 |
| Skipped | 11 (no `E2E_EMAIL` / `E2E_PASSWORD`; optional restricted user) |
| Failed | 3 |

Failures were **unauthenticated** auth specs (login card styling / redirect timeout) — consistent with **stale or misaligned `:3001` standalone** (HTML/CSS hash mismatch) documented in Phase 7/4.3, not DRM IP code changes.

**Phase 9 DRM IP specs:** **2 skipped** (credentials not set in agent environment).

**Authenticated pilot acceptance:** **Blocked** until Habib runs E2E with env credentials and restarts standalone after `build:standalone`:

```bash
cd frontend-next
npm run build:standalone
PORT=3001 BACKEND_URL=http://localhost:5001 node .next/standalone/server.js
# separate shell — set E2E_EMAIL / E2E_PASSWORD via environment only
npm run test:e2e
```

After backend approval + deploy, re-run Phase 9 restricted test: non-admin should get **403** from API (spec annotates gap if API still returns 200).

---

## 6. Migration tracker (evidence table)

`migration-routes.json` is **generator-owned** (`migrationStatus: "legacy"` for all routes). Manual JSON edits are overwritten by `build-route-matrix.mjs`. Pilot maturity is recorded here instead:

| Route | UI ported (read-only) | API integrated | Client auth verified | Express auth aligned | Browser acceptance | Production ready |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| `/allowed-ip/drm-ip-list` | Yes | Yes (GET) | Yes (unit) | **No — proposal pending** | **Blocked** (E2E creds) | **No** |
| `/notice-board` | Yes | Yes | Yes | Yes (authMiddleware) | Blocked | No |
| `/admin/audit-logs` | Yes | Yes | Yes | Yes (requireRole) | Blocked | No |

---

## 7. Remaining blockers

1. **Habib approval** to apply Express `requireRole` on allowed-ips routes (Section 3).
2. **Backend tests** for 403 non-admin GET (proposed, not written until scope approved).
3. **Authenticated E2E** for admin + restricted accounts.
4. **Standalone restart** discipline for reliable Playwright.
5. CRUD still out of scope; legacy Vite remains write path and deployment authority.

---

## 8. Request for Habib

Please confirm:

1. **Role policy:** `admin`, `super_admin`, `administrator`, `super_hod` for **read and write** on `/api/settings/allowed-ips*` (recommended).
2. **Approval to implement** the proposed Express change + backend tests in a follow-up commit (not part of Phase 9 deliverable).
3. Optional: run Phase 9 E2E locally with credentials and share pass/fail (no secrets in repo).

**Verdict:** Security **misalignment documented**; Next client guard is correct per registry; **API must be gated** before calling DRM IP List “authorization verified” or production-ready. Phase 9 stops here per instructions.

---

## 9. Files touched in Phase 9

| File | Change |
|------|--------|
| `e2e/helpers/admin-roles.ts` | New — ADMIN_ONLY helper for E2E |
| `e2e/drm-ip-phase9.spec.ts` | New — acceptance specs (credential-gated) |
| `docs/PHASE9_STATUS.md` | This document |

**Not modified:** Express, DB, legacy `frontend/`, DRM IP view component, Notice Board, Audit Logs.

---

*No commit, push, merge, or deploy.*
