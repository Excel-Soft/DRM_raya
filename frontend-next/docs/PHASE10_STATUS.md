# Phase 10 — First Business Module Migration (DRM Policies)

**Project:** DRM WebExcels · **Branch:** `fix/upgrade_frontend_habib` · **Owner:** Habib  
**Date:** 2026-10-24

---

## 1. Selected module and rationale

| Item | Detail |
|------|--------|
| **Module** | DRM Policies |
| **Legacy route** | `/policies` |
| **Legacy page** | `frontend/src/pages/policies-settings.tsx` (`PoliciesSettings`) |
| **Registry** | `frontend/src/routes/route-registry.ts` — module **Notice**, permission **DRM Policies** |
| **Sidebar** | `frontend/src/components/app-sidebar.tsx` — “DRM Policies” → `/policies` |
| **Next route** | `/policies` → `frontend-next/src/app/(app)/policies/page.tsx` |

**Why this module**

- Real business workflow (company policy registry), not auth/audit/settings/health.
- Existing Express API at **`/api/policies`** with list, create, and delete — no schema change required.
- Clear role split: any authenticated user may **read**; **writes** require managerial roles (backend `canManage` / `isManagerialRole`).
- Manageable surface: search, table, create form, delete — without the full legacy export/column-toggle stack in v1.
- Distinct from Phase 8 read-only DRM IP pilot (includes write paths guarded by backend).

**Not chosen:** login, audit logs, API health, allowed-IP list (already migrated as read-only pilot), generic settings dashboards.

---

## 2. Legacy workflow trace (source of truth)

| Area | Legacy behavior |
|------|-----------------|
| **Data** | `GET /api/policies` — array of `DrmPolicy` rows, newest first |
| **Create** | `POST /api/policies` — body validated by `insertDrmPolicySchema`; `createdBy` set server-side |
| **Delete** | `DELETE /api/policies/:id` — 204 on success |
| **Route access (UI)** | `frontend/src/lib/route-access.ts` prefix `/policies` (admin, super_hod, reception_manager, software_manager, lead_*, marketing_manager, account_manager, …) |
| **Write access (API)** | Managerial roles only (`backend/src/server/routes/policy-routes.ts` + `isManagerialRole`) |
| **UX** | Client search; table with head, type, penalty, min/max, description, file link; create form; delete; loading via React Query |
| **Extra legacy** | Excel/PDF export, clipboard copy, column visibility toggles, rich description editor styling |

Backend implementation: `backend/src/server/routes/policy-routes.ts` (mounted at `/api/policies`). No backend changes in Phase 10.

---

## 3. Legacy → Next mapping

| Legacy | Next.js |
|--------|---------|
| `/policies` → `PoliciesSettings` | `/policies` → `PoliciesPage` → `PoliciesView` |
| React Query + `apiRequest` | `useApiResource` + `apiFetch` |
| shadcn cards/tables (Vite) | Shared `PageHeader`, `DataTable`, `Field`, `FormBanner`, `ConfirmDialog`, `PageLoading` / `PageError` / `PageForbidden` |
| Toast feedback | `FormBanner` success/error |
| Manager-only create/delete UI | `userCanManagePolicies` (mirrors backend managerial set for affordances only) |
| `AuthGate` / route registry | Existing `(app)` layout + `route-access.ts` prefix `/policies` |

**Navigation:** App shell link “DRM Policies”; home page quick link updated.

---

## 4. API endpoints reused

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/api/policies` | JWT (`authMiddleware`) | List all policies |
| `POST` | `/api/policies` | JWT + managerial | Create; 403 if not managerial |
| `DELETE` | `/api/policies/:id` | JWT + managerial | 403 if not managerial |

Proxy: Next rewrites/browser client to Express (unchanged from prior phases).

---

## 5. Functionality implemented

- Authenticated list with loading, empty, error, and forbidden states (`useApiResource`).
- Client-side search (head, type, description).
- Table columns: policy head, type, penalty, min/max, description snippet, file URL link, created date, status badge.
- **Managers:** create form (head required; type select; penalty; min/max; description; optional `fileUrl`).
- **Managers:** delete with confirmation dialog; list refetch after create/delete.
- Route-level access via existing `/policies` prefix in `route-access.ts` (tests: allow `account_manager`, deny `sales_executive`).

## 6. Intentionally deferred (legacy parity)

- Excel and PDF export (`xlsx`, `jspdf`).
- Copy-to-clipboard actions.
- Per-column visibility dropdown.
- Rich-text description editor (Next uses plain `Textarea`; optional file URL only).
- Edit/update flow (legacy also had no PATCH on `/api/policies`).

---

## 7. Files touched (Phase 10 — policies module)

| File | Change |
|------|--------|
| `src/app/(app)/policies/page.tsx` | New route entry |
| `src/modules/policies/policies-view.tsx` | Main UI + API integration |
| `src/lib/auth/role-utils.ts` | `isManagerialRole`, `userCanManagePolicies` |
| `src/lib/auth/role-utils.test.ts` | Unit tests for managerial / policy manage helpers |
| `src/lib/auth/route-access.test.ts` | `/policies` allow/deny cases |
| `package.json` | Include `role-utils.test.ts` in `test:unit` |
| `src/components/layout/app-shell.tsx` | Nav: DRM Policies |
| `src/app/(app)/page.tsx` | Home link to `/policies` |

**Not modified:** `frontend/src/pages/policies-settings.tsx`, Express routes, database schema, legacy Vite routes.

---

## 8. Verification

**Commands (this session):**

```bash
cd frontend-next
npm test          # unit + route-access + route-access-policy
npm run typecheck
npm run lint
npm run build
```

| Check | Result |
|-------|--------|
| Unit tests | **16/16** pass |
| Route access tests | **25/25** pass (includes `/policies`) |
| Route access policy tests | **7/7** pass |
| Typecheck | Pass |
| Lint | **0 errors**, 2 warnings (existing postcss default export; `react-hooks/exhaustive-deps` on `rows` in `policies-view.tsx`) |
| Production build | Pass — static route **`/policies`** emitted |

**Browser E2E:** Not run — `E2E_EMAIL` / `E2E_PASSWORD` not configured in this session. Authenticated create/delete/list flow in browser remains **unverified** until creds or a seeded Playwright pattern is added.

**Manual smoke (recommended for Habib):**

1. Express: `cd backend && PORT=5001 npm run dev`
2. Next standalone: `cd frontend-next && npm run build` (postbuild copies static) then restart `PORT=3001 BACKEND_URL=http://127.0.0.1:5001 npm run start:standalone` — or `node .next/standalone/server.js` after `prepare-standalone.mjs`
3. Log in as a role with `/policies` access; open `/policies`; confirm list loads.
4. Log in as managerial role; create and delete a test policy; confirm non-manager gets 403 on POST/DELETE if UI is bypassed.

---

## 9. Remaining blockers / follow-ups

| Item | Severity |
|------|----------|
| No authenticated Playwright spec for `/policies` | Medium — document until E2E creds available |
| Legacy export/copy/column toggles not ported | Low — explicit deferral |
| `route-access.ts` `/policies` role list is wider than `route-registry.ts` `allowedRoles` | Info — matches legacy `route-access.ts`; align deliberately if product wants stricter Next gate |
| Stage 10 DB integration flakiness (prior phases) | Out of scope unless it blocks local API smoke |

---

## 10. Stop point

**Deliverable:** One working migrated business module (**DRM Policies**) on Next App Router, legacy Vite page unchanged, backend unchanged.

**Next step:** Habib review; pick the second business module after approval — do not start another migration in this phase.
